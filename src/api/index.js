const express = require('express')

const auth = require('./auth/auth.routes')
const channel = require('./channel/channel.routes')
const dashboard = require('./dashboard/dashboard.routes')
const job = require('./job/job.routes')
const report = require('./report/report.routes')
const twitch = require('./twitch/twitch.routes')
const users = require('./users/users.routes')

const router = express.Router()

router.get('/', (request, response) => {
  response.json({
    message: 'API - 👋🌎🌍🌏'
  })
})

router.get('/healthz', (request, response) => {
  response.sendStatus(200)
})

router.use('/auth', auth)
router.use('/channel', channel)
router.use('/dashboard', dashboard)
router.use('/job', job)
router.use('/report', report)
router.use('/twitch', twitch)
router.use('/users', users)

module.exports = router
