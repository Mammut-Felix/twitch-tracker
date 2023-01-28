const axios = require('axios')
const { accessToken } = require('../../utils/twitch')
const { db } = require('../../utils/database')

module.exports = async function (job) {
  job.progress(0)

  const { type, condition, user_id } = job.data
  const payload = {
    type,
    version: '1',
    condition,
    transport: {
      method: 'webhook',
      callback: 'https://prod.tracker.twitch.mammut-cluster.de/api/v1/twitch/eventsub',
      secret: process.env.TWITCH_SIGNING_SECRET
    }
  }

  let webhookData
  if (process.env.NODE_ENV === 'development') {
    webhookData = {
      data: [
        {
          id: 'f1c2a387-161a-49f9-a165-0f21d7a4e1c4',
          status: 'webhook_callback_verification_pending',
          type,
          version: '1',
          cost: 1,
          condition,
          transport: {
            method: 'webhook',
            callback: 'https://example.com/webhooks/callback'
          },
          created_at: '2019-11-16T10:11:12.123Z'
        }
      ],
      total: 1,
      total_cost: 1,
      max_total_cost: 10_000
    }
  } else {
    console.log('Registering webhook...')
    console.log('Payload:', payload)
    const { data } = await axios.post(
      'https://api.twitch.tv/helix/eventsub/subscriptions',
      payload,
      {
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          'Client-ID': process.env.TWITCH_CLIENT_ID
        }
      }
    )
    webhookData = data
  }

  if (webhookData.data.length === 0) {
    return
  }

  const webhook = webhookData.data[0]

  const data = {
    webhooks: {}
  }
  data.webhooks[type] = {
    id: webhook.id,
    cost: webhook.cost
  }

  const result = await db.channel.update({
    where: {
      broadcaster_user_id: user_id
    },
    data
  })

  job.progress(100)

  return result
}
