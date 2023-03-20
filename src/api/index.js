const express = require('express')
const { rateLimit } = require('../middlewares')

const auth = require('./auth/auth.routes')
const channel = require('./channel/channel.routes')
const dashboard = require('./dashboard/dashboard.routes')
const job = require('./job/job.routes')
const report = require('./report/report.routes')
const twitch = require('./twitch/twitch.routes')
const users = require('./users/users.routes')
const functions = require('./functions/functions.routes')

const router = express.Router()

router.get('/healthz', (request, response) => {
  response.sendStatus(200)
})

router.get('/', rateLimit, (request, response) => {
  response.json({
    message: 'API - 👋🌎🌍🌏'
  })
})

router.use('/auth', rateLimit, auth)
router.use('/channel', rateLimit, channel)
router.use('/dashboard', rateLimit, dashboard)
router.use('/functions', rateLimit, functions)
router.use('/job', rateLimit, job)
router.use('/report', rateLimit, report)
router.use('/twitch', twitch)
router.use('/users', rateLimit, users)

module.exports = router
