const express = require('express')
const { verifyTwitchSignature } = require('../../middlewares')
const { handleNotification } = require('./twitch.services')

const router = express.Router()

// Notification request headers
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase()

// Notification message types
const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification'
const MESSAGE_TYPE_NOTIFICATION = 'notification'
const MESSAGE_TYPE_REVOCATION = 'revocation'

router.use('/eventsub', verifyTwitchSignature, async (request, response, next) => {
  try {
    const notification = request.body
    const messageType = request.headers[MESSAGE_TYPE]

    switch (messageType) {
      case MESSAGE_TYPE_NOTIFICATION: {
        handleNotification({ notification, eventId: request.headers['twitch-eventsub-message-id'] })
        response.sendStatus(204)
        break
      }
      case MESSAGE_TYPE_VERIFICATION: {
        response.writeHeader(200, { 'Content-Type': 'text/plain' })
        response.write(notification.challenge)
        response.end()
        break
      }
      case MESSAGE_TYPE_REVOCATION: {
        response.sendStatus(204)
        break
      }
      default: {
        console.log(`Unknown message type: ${messageType}`)
        response.sendStatus(204)
      }
    }
  } catch (error) {
    next(error)
  }
})

module.exports = router
