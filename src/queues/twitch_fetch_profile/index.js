const axios = require('axios')
const { accessToken } = require('../../utils/twitch')
const { db } = require('../../utils/database')
const moment = require('moment')

module.exports = async function (job) {
  job.progress(0)

  const { user_id, user_login } = job.data

  let parameter

  if (user_id) {
    parameter = `id=${user_id}`
  } else if (user_login) {
    parameter = `login=${user_login}`
  } else {
    throw new Error('No user_id or user_login provided')
  }

  const { data } = await axios.get(`https://api.twitch.tv/helix/users?${parameter}`, {
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Client-ID': process.env.TWITCH_CLIENT_ID
    }
  })

  if (data.data.length === 0) {
    return new Error('No user found')
  }

  const user = data.data[0]

  const result = await db.channel.upsert({
    where: {
      broadcaster_user_id: user.id
    },
    update: {
      broadcaster_user_name: user.login,
      broadcaster_user_login: user.login,
      type: user.type,
      broadcaster_type: user.broadcaster_type,
      description: user.description,
      profile_image_url: user.profile_image_url,
      offline_image_url: user.offline_image_url,
      account_createdAt: moment(user.created_at).toDate()
    },
    create: {
      broadcaster_user_id: user.id,
      broadcaster_user_name: user.login,
      broadcaster_user_login: user.login,
      type: user.type,
      broadcaster_type: user.broadcaster_type,
      description: user.description,
      profile_image_url: user.profile_image_url,
      offline_image_url: user.offline_image_url,
      account_createdAt: moment(user.created_at).toDate()
    }
  })

  if (!result || !result.id) {
    throw new Error('Failed to update user')
  }

  job.progress(100)
  return result
}
