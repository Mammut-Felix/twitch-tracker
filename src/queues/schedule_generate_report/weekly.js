const { db } = require('../../utils/database')
const moment = require('moment')
const { mailSendQueue } = require('../../queues')
const path = require('node:path')
const fs = require('node:fs')

module.exports = async function (job) {
  let startDate = moment().subtract(1, 'year').startOf('week').add(6, 'hours').toDate()
  const endDate = moment().toDate()

  if (job.data.startDate) {
    startDate = moment(job.data.startDate).toDate()
  }

  const data = await generateData({ startDate, endDate })

  const html = buildHtml({
    startDate,
    endDate,
    data
  })

  const users = await db.user.findMany()
  const emails = users.map(user => user.email)

  const report = await db.report.create({
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
      subject: 'Twitch wöchentlicher Report',
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
    tables += buildChannelTable(channel)

    tables += buildStatsTable({
      channel: channel.channel,
      streams: channel.streams,
      raids: channel.raids
    })

    if (channel.streams.length > 0) {
      tables += buildStreamTable({
        streams: channel.streams,
        broadcaster_user_id: channel.channel.broadcaster_user_id
      })
    }

    if (channel.raids.length > 0) {
      tables += buildRaidTableIncoming({
        raids: channel.raids,
        broadcaster_user_id: channel.broadcaster_user_id
      })

      tables += buildRaidTableOutgoing({
        raids: channel.raids,
        broadcaster_user_id: channel.broadcaster_user_id
      })
    }

    tables += buildFooter()
  }

  const html = template
    .replace('{{ dev_notice }}', '')
    .replace('{{ data_table }}', tables)
    .replace('{{ date_from }}', startDate)
    .replace('{{ date_to }}', endDate)
    .replace('{{ report_url }}', url)

  return html
}

const buildChannelTable = channel => {
  console.log(channel)
  return `
  <tr>
    <td>
      <div class="channel">
        <div class="heading">
          <img
            alt="${channel.channel.broadcaster_user_name}"
            src="${channel.channel.profile_image_url}"
          />
          <h2>
            <a
              href="https://twitch.tv/${channel.channel.broadcaster_user_login}"
              target="_blank"
              >${channel.channel.broadcaster_user_name}</a
            >
          </h2>
        </div>
        <div class="content">
  `
}

const buildStatsTable = ({ channel, streams, raids }) => {
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

  const startFollowers = streams[0]?.stats[0]?.follower_count
  const endFollowers =
    streams[streams.length - 1]?.stats[streams[streams.length - 1]?.stats.length - 1]
      ?.follower_count
  const follower_change_total = endFollowers - startFollowers

  const durations = streams.map(stream => {
    const duration = moment.duration(moment(stream.ended_at).diff(moment(stream.started_at)))
    return duration.asMilliseconds()
  })

  const durationTotal = durations.reduce((a, b) => a + b, 0)
  const on_time = moment.utc(durationTotal).format('HH:mm:ss')

  const avgViewers = streams.map(stream => {
    const viewers = stream.stats.map(stat => stat.viewer_count)
    return viewers.reduce((a, b) => a + b, 0) / viewers.length
  })
  const averageViewers_total = avgViewers.reduce((a, b) => a + b, 0) / avgViewers.length
  const stream_count = streams.length

  const topics = streams.map(stream => stream.game_name)
  const top_topic = topics
    .sort((a, b) => topics.filter(v => v === a).length - topics.filter(v => v === b).length)
    .pop()

  const raids_incoming = raids.filter(
    raid => raid.event.to_broadcaster_user_id === channel.broadcaster_user_id
  ).length
  const raids_outgoing = raids.filter(
    raid => raid.event.from_broadcaster_user_id === channel.broadcaster_user_id
  ).length

  html += `
    <tr>
      <td>${stream_count}</td>
      <td>${on_time}</td>
      <td>${averageViewers_total}</td>
      <td>${follower_change_total}</td>
      <td>${top_topic}</td>
      <td>${raids_incoming}</td>
      <td>${raids_outgoing}</td>
    </tr>
  </tbody>
</table>
`

  return html
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

const buildRaidTableIncoming = ({ raids, broadcaster_user_id }) => {
  let html = `
  <h3>TOP 5 Raids (zum Streamer)</h3>
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

  const incomingRaids = raids.filter(
    raid => raid.event.to_broadcaster_user_id === broadcaster_user_id
  )

  const top5Raids = incomingRaids
    .sort((a, b) => b.event.viewer_count - a.event.viewer_count)
    .slice(0, 5)

  for (const raid of top5Raids) {
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

const buildRaidTableOutgoing = ({ raids, broadcaster_user_id }) => {
  let html = `
  <h3>TOP 5 Raids (vom Streamer)</h3>
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

  const outgoingRaids = raids.filter(
    raid => raid.event.from_broadcaster_user_id === broadcaster_user_id
  )

  const top5Raids = outgoingRaids
    .sort((a, b) => b.event.viewer_count - a.event.viewer_count)
    .slice(0, 5)

  for (const raid of top5Raids) {
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
