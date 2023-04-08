const crypto = require('node:crypto')
const Redis = require('ioredis')
const { config, nodes } = require('./redis')
const axios = require('axios')

const prefix =
  process.env.REDIS_MODE === 'cluster' ? '{twitch-tracker:twitch}' : 'twitch-tracker:twitch'

const redisClient = () => {
  return nodes.length > 0 && process.env.REDIS_MODE === 'cluster'
    ? new Redis.Cluster(nodes, config)
    : new Redis({
        ...config
      })
}

const getSecret = () => {
  return process.env.TWITCH_SIGNING_SECRET
}
exports.getSecret = getSecret

exports.verifyTwitchSignature = (request, response, buf, encoding) => {
  const messageId = request.header('Twitch-Eventsub-Message-Id')
  const timestamp = request.header('Twitch-Eventsub-Message-Timestamp')
  const messageSignature = request.header('Twitch-Eventsub-Message-Signature')
  const time = Math.floor(Date.now() / 1000)
  console.log(`Message ${messageId} Signature:`, messageSignature)

  if (Math.abs(time - timestamp) > 600) {
    // needs to be < 10 minutes
    console.log(`Verification Failed: timestamp > 10 minutes. Message Id: ${messageId}.`)
    throw new Error('Ignore this request.')
  }

  if (!getSecret()) {
    console.log('Twitch signing secret is empty.')
    throw new Error('Twitch signing secret is empty.')
  }

  const computedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', getSecret())
      .update(messageId + timestamp + buf)
      .digest('hex')
  console.log(`Message ${messageId} Computed Signature:`, computedSignature)

  if (messageSignature === computedSignature) {
    console.log('Verification successful')
  } else {
    throw new Error('Invalid signature.')
  }
}

exports.accessToken = async () => {
  let token = await redisClient().get(`${prefix}:access_token`)

  if (!token) {
    const { data } = await axios.post('https://id.twitch.tv/oauth2/token', {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })

    await redisClient().set(
      `${prefix}:access_token`,
      data.access_token,
      'EX',
      data.expires_in - 300
    )
    token = data.access_token
  }

  return token
}
