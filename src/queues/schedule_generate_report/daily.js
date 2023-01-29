const { db } = require('../../utils/database')
const moment = require('moment')
const { mailSendQueue } = require('../../queues')
const path = require('node:path')
const fs = require('node:fs')

module.exports = async function (job) {
  let startDate = moment().subtract(1, 'days').startOf('day').add(6, 'hours').toDate()
  const endDate = moment().toDate()

  if (job.data.startDate) {
    startDate = moment(job.data.startDate).toDate()
  }

  let report = await db.report.create({
    data: {
      recipients: '',
      content: '',
      status: 'PENDING',
      result: undefined
    }
  })

  const data = await generateData({ startDate, endDate })

  const html = buildHtml({
    startDate,
    endDate,
    data,
    url: `https://twitch-tracker.mammut-cluster.de/api/v1/report/${report.id}`
  })

  const users = await db.user.findMany()
  const emails = users.map(user => user.email)

  report = await db.report.update({
    where: {
      id: report.id
    },
    data: {
      recipients: emails,
      content: html,
      status: 'PENDING',
      result: undefined
    }
  })

  job.progress(100)

  await mailSendQueue.add(
    'send',
    {
      to: emails,
      subject: 'Twitch täglicher Report',
      html,
      report: {
        id: report.id
      }
    },
    {
      removeOnComplete: {
        age: 1000 * 60 * 60 * 24 * 7
      },
      removeOnFail: false
    }
  )
}

const generateData = async ({ startDate, endDate }) => {
  const raids = await db.twitchEvent.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate
      },
      eventType: 'channel.raid'
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  const streamUps = await db.twitchEvent.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate
      },
      eventType: 'stream.online'
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  const streamDowns = await db.twitchEvent.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate
      },
      eventType: 'stream.offline'
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  const streamStats = await db.streamStatistic.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  const streams = []
  for (const streamUp of streamUps) {
    const streamDown = streamDowns.find(
      streamDown =>
        streamDown.event.broadcaster_user_id === streamUp.event.broadcaster_user_id &&
        streamDown.createdAt > streamUp.createdAt
    )

    let stats = []
    if (streamDown) {
      stats = streamStats.filter(
        stat =>
          stat.broadcaster_user_id === streamUp.event.broadcaster_user_id &&
          moment(stat.createdAt).toDate() >= moment(streamUp.event.started_at).toDate() &&
          moment(stat.createdAt).toDate() <= moment(streamDown.createdAt).toDate()
      )
    }

    streams.push({
      broadcaster_user_id: streamUp.event.broadcaster_user_id,
      broadcaster_user_name: streamUp.event.broadcaster_user_name,
      broadcaster_user_login: streamUp.event.broadcaster_user_login,
      started_at: streamUp.createdAt,
      ended_at: streamDown ? streamDown.createdAt : undefined,
      stats
    })
  }

  const channels = await db.channel.findMany()
  const result = []

  for (const channel of channels) {
    const channelRaids = raids.filter(
      raid =>
        raid.event.from_broadcaster_user_id === channel.broadcaster_user_id ||
        raid.event.to_broadcaster_user_id === channel.broadcaster_user_id
    )

    const channelStreams = streams.filter(
      stream => stream.broadcaster_user_id === channel.broadcaster_user_id
    )

    if (channelRaids.length > 0 || channelStreams.length > 0) {
      result.push({
        channel: {
          broadcaster_user_id: channel.broadcaster_user_id,
          broadcaster_user_name: channel.broadcaster_user_name,
          broadcaster_user_login: channel.broadcaster_user_login,
          profile_image_url: channel.profile_image_url
        },
        raids: channelRaids,
        streams: channelStreams
      })
    }
  }

  return result
}

const buildHtml = ({ data, startDate, endDate, url }) => {
  const template = fs.readFileSync(path.join(__dirname, 'daily.html'), 'utf8')
  let tables = ''

  for (const channel of data) {
    tables += buildChannelTable(channel.channel)

    if (channel.streams.length > 0) {
      tables += buildStreamTable({
        streams: channel.streams,
        broadcaster_user_login: channel.channel.broadcaster_user_login
      })
    }

    if (channel.raids.length > 0) {
      tables += buildRaidTable(channel.raids)
    }

    tables += buildFooter()
  }

  const html = template
    .replace('{{ dev_notice }}', '')
    .replace('{{ data_table }}', tables)
    .replace('{{ date_from }}', moment(startDate).format('DD.MM.YYYY HH:mm'))
    .replace('{{ date_to }}', moment(endDate).format('DD.MM.YYYY HH:mm'))
    .replace('{{ report_url }}', url)

  return html
}

const buildChannelTable = channel => {
  return `
  <tr>
    <td>
      <div class="channel">
        <div class="heading">
          <img
            alt="${channel.broadcaster_user_name}"
            src="${channel.profile_image_url}"
          />
          <h2>
            <a
              href="https://twitch.tv/${channel.broadcaster_user_login}"
              target="_blank"
              >${channel.broadcaster_user_name}</a
            >
          </h2>
        </div>
        <div class="content">
  `
}

const buildStreamTable = ({ streams, broadcaster_user_login }) => {
  let html = `
  <h3>Streams</h3>
  <table class="stream-data" role="presentation">
    <thead>
      <tr>
        <th>Online</th>
        <th>Offline</th>
        <th>Dauer</th>
        <th>Thema</th>
        <th>&Oslash; Viewer</th>
        <th>Follower</th>
        <th>Tracker</th>
      </tr>
    </thead>
    <tbody>
  `
  for (const stream of streams) {
    const start = moment(stream.started_at).format('HH:mm')
    const end = stream.ended_at ? moment(stream.ended_at).format('HH:mm') : 'läuft noch'
    const minutes = stream.ended_at ? moment(stream.ended_at).diff(stream.started_at, 'minutes') : 0
    const duration = stream.ended_at
      ? moment.utc(moment.duration(minutes, 'minutes').asMilliseconds()).format('HH:mm')
      : '-'
    const stream_id = stream.stats?.[0]?.streamId
    const trackerUrl = stream_id
      ? `https://twitchtracker.com/${broadcaster_user_login}/streams/${stream_id}`
      : '#'
    const stats = stream.stats
    const averageViewers =
      stats.length > 0
        ? Math.round(stats.reduce((a, b) => a + b.viewer_count, 0) / stats.length).toLocaleString(
            'de-DE'
          )
        : 0
    const followerChange =
      stats.length > 0
        ? (stats[0].follower_count - stats[stats.length - 1].follower_count).toLocaleString('de-DE')
        : 0
    const topics = [...new Set(stats.map(stat => stat.game_name))].join(', ')
    html += `
    <tr>
        <td>${start}</td>
        <td>${end}</td>
        <td>${duration}</td>
        <td>${topics}</td>
        <td>${averageViewers}</td>
        <td>${followerChange}</td>
        <td>
          <a
            href="${trackerUrl}"
            >Link</a
          >
        </td>
      </tr>
      `
  }

  html += `
    </tbody>
  </table>
  `

  return html
}

const buildRaidTable = raids => {
  let html = `
  <h3>Raids</h3>
  <table class="raid-data" role="presentation">
    <thead>
      <tr>
        <th>Zeit</th>
        <th>Von</th>
        <th>Nach</th>
        <th>Viewer</th>
      </tr>
    </thead>
    <tbody>
    `

  for (const raid of raids) {
    const from = raid.event.from_broadcaster_user_name
    const to = raid.event.to_broadcaster_user_name
    const time = moment(raid.createdAt).format('HH:mm')
    const viewer = raid.event.viewers.toLocaleString('de-DE')

    html += `
    <tr>
      <td>${time}</td>
      <td>${from}</td>
      <td>${to}</td>
      <td>${viewer}</td>
    </tr>
    `
  }

  html += `
    </tbody>
  </table>
  `

  return html
}

const buildFooter = () => {
  return `
        </div>
      </div>
    </td>
  </tr>
`
}
