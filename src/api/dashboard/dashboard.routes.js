const { createBullBoard } = require('@bull-board/api')
const { BullAdapter } = require('@bull-board/api/bullAdapter')
const { ExpressAdapter } = require('@bull-board/express')
const {
  twitchRegisterWebhookQueue,
  twitchFetchProfileQueue,
  twitchFetchStreamQueue,
  mailSendQueue,
  databaseWriteEventQueue,
  queues
} = require('../../queues')
const express = require('express')

const router = express.Router()

const scheduledQueues = queues.map(queue => new BullAdapter(queue))

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath(
  process.env.NODE_ENV === 'development' ? '/dashboard' : '/api/v1/dashboard'
)

createBullBoard({
  queues: [
    new BullAdapter(databaseWriteEventQueue),
    new BullAdapter(mailSendQueue),
    ...scheduledQueues,
    new BullAdapter(twitchFetchProfileQueue),
    new BullAdapter(twitchFetchStreamQueue),
    new BullAdapter(twitchRegisterWebhookQueue)
  ],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'Twitch-Tracker'
    }
  }
})

router.use(
  '/',
  (request, response, next) => {
    response.setHeader('Content-Security-Policy', '')
    next()
  },
  serverAdapter.getRouter()
)

module.exports = router
