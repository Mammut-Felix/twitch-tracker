const axios = require('axios')
const { accessToken } = require('../../utils/twitch')
const { db } = require('../../utils/database')
const moment = require('moment')

module.exports = async function (job) {
  job.progress(0)

  const { user_id, trigger } = job.data

  const { data: streamData } = await axios.get(
    `https://api.twitch.tv/helix/streams?user_id=${user_id}`,
    {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${await accessToken()}`
      }
    }
  )

  job.progress(50)

  const { data: followData } = await axios.get(
    `https://api.twitch.tv/helix/users/follows?to_id=${user_id}&first=1`,
    {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${await accessToken()}`
      }
    }
  )

  job.progress(99)

  if (streamData.data.length === 0 || !streamData.data[0].type) {
    throw new Error('No stream found')
  }

  const stream = streamData.data[0]

  const data = {
    streamId: stream.id,
    broadcaster_user_id: stream.user_id,
    broadcaster_user_name: stream.user_name,
    broadcaster_user_login: stream.user_login,
    game_id: stream.game_id,
    game_name: stream.game_name,
    type: stream.type,
    title: stream.title,
    viewer_count: stream.viewer_count,
    started_at: moment(stream.started_at).toDate(),
    language: stream.language,
    thumbnail_url: stream.thumbnail_url,
    tag_ids: stream.tag_ids,
    is_mature: stream.is_mature,
    follower_count: followData.total,
    trigger
  }

  return db.streamStatistic.create({
    data
  })
}
