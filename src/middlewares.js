const jwt = require('jsonwebtoken')
const moment = require('moment')
const crypto = require('node:crypto')
const { db } = require('./utils/database')
const Redis = require('ioredis')
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible')
const { config, nodes } = require('./utils/redis')

const redisClient =
  nodes.length > 0 && process.env.REDIS_MODE === 'cluster'
    ? new Redis.Cluster(nodes, config)
    : new Redis({
        ...config
      })

const rateLimiterMemory = new RateLimiterMemory({
  points: 10, // if there are 5 workers
  duration: 1
})

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 10, // 10 requests
  duration: 1, // per 1 second by IP
  rejectIfRedisNotReady: true,
  insuranceLimiter: rateLimiterMemory
})

function rateLimit(request, response, next) {
  console.log(request.clientIp)
  rateLimiter
    .consume(request.clientIp)
    .then(rateLimiterResult => {
      const headers = {
        'Retry-After': rateLimiterResult.msBeforeNext / 1000,
        'X-RateLimit-Limit': 10,
        'X-RateLimit-Remaining': rateLimiterResult.remainingPoints,
        'X-RateLimit-Reset': moment().add(rateLimiterResult.msBeforeNext, 'ms').toISOString()
      }
      response.set(headers)
      next()
    })
    .catch(error => {
      const headers = {
        'Retry-After': error.msBeforeNext / 1000,
        'X-RateLimit-Limit': 10,
        'X-RateLimit-Remaining': error.remainingPoints,
        'X-RateLimit-Reset': moment().add(error.msBeforeNext, 'ms').toISOString()
      }
      response.set(headers)
      response.status(429)
      next(new Error('Too Many Requests'))
    })
}

function notFound(request, response, next) {
  response.status(404)
  const error = new Error(`🔍 - Not Found - ${request.originalUrl}`)
  next(error)
}

/* eslint-disable no-unused-vars */
function errorHandler(error, request, response, next) {
  /* eslint-enable no-unused-vars */
  const statusCode = response.statusCode === 200 ? 500 : response.statusCode
  response.status(statusCode)
  response.json({
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : '🥞'
  })
}

async function validApiKey(request, response, next) {
  const apiKey = request.headers['x-api-key']

  if (!apiKey) {
    response.status(401)
    next(new Error('🚫 Un-Authorized 🚫'))
  }

  try {
    const key = await db.apiKey.findFirstOrThrow({
      where: {
        key: apiKey
      }
    })

    if (key.revoked) {
      response.status(401)
      next(new Error('🚫 Un-Authorized 🚫'))
    }
  } catch {
    response.status(401)
    next(new Error('🚫 Un-Authorized 🚫'))
  }

  return next()
}

function isAuthenticated(request, response, next) {
  const { authorization } = request.headers

  if (!authorization) {
    response.status(401)
    throw new Error('🚫 Un-Authorized 🚫')
  }

  try {
    const token = authorization.split(' ')[1]
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    request.payload = payload
  } catch (error) {
    response.status(401)
    if (error.name === 'TokenExpiredError') {
      throw new Error(error.name)
    }
    throw new Error('🚫 Un-Authorized 🚫')
  }

  return next()
}

async function isModerator(request, response, next) {
  if (!request.payload.userId) {
    response.status(401)
    next(new Error('🚫 Un-Authorized 🚫'))
  }

  try {
    const user = await db.user.findFirst({
      where: {
        id: request.payload.userId
      }
    })

    if (user.role !== 'MODERATOR' && user.role !== 'ADMINISTRATOR') {
      response.status(401)
      next(new Error('🚫 Un-Authorized 🚫'))
    }
  } catch (error) {
    next(error)
  }

  return next()
}

async function isAdmin(request, response, next) {
  if (!request.payload.userId) {
    response.status(401)
    next(new Error('🚫 Un-Authorized 🚫'))
  }

  try {
    const user = await db.user.findFirst({
      where: {
        id: request.payload.userId
      }
    })

    if (user.role !== 'ADMINISTRATOR') {
      response.status(401)
      next(new Error('🚫 Un-Authorized 🚫'))
    }
  } catch (error) {
    next(error)
  }

  return next()
}

const verifyTwitchSignature = (request, response, next) => {
  const buf = Buffer.from(JSON.stringify(request.body))
  const messageId = request.header('Twitch-Eventsub-Message-Id')
  const timestamp = request.header('Twitch-Eventsub-Message-Timestamp')
  const messageSignature = request.header('Twitch-Eventsub-Message-Signature')
  const time = Math.floor(Date.now() / 1000)

  if (Math.abs(time - timestamp) > 600) {
    // needs to be < 10 minutes
    throw new Error('Ignore this request.')
  }

  if (!process.env.TWITCH_SIGNING_SECRET) {
    throw new Error('Twitch signing secret is empty.')
  }

  const computedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', process.env.TWITCH_SIGNING_SECRET)
      .update(messageId + timestamp + buf)
      .digest('hex')
  if (messageSignature === computedSignature) {
    return next()
  } else {
    throw new Error('Invalid signature.')
  }
}

module.exports = {
  errorHandler,
  isAdmin,
  isAuthenticated,
  isModerator,
  notFound,
  rateLimit,
  validApiKey,
  verifyTwitchSignature
}
