const jwt = require('jsonwebtoken')
const crypto = require('node:crypto')
const { db } = require('./utils/database')

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
  notFound,
  errorHandler,
  isAuthenticated,
  verifyTwitchSignature,
  isAdmin,
  isModerator,
  validApiKey
}
