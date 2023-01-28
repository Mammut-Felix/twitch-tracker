const express = require('express')
const { isAdmin } = require('../../middlewares')
const { scheduleJob } = require('./job.services')

const router = express.Router()

router.post('/schedule', [isAdmin], async (request, response, next) => {
  try {
    const { queue, handler } = request.body

    if (!queue) {
      throw new Error('Missing queue')
    }

    const job = await scheduleJob(queue, handler)
    response.json(job)
  } catch (error) {
    next(error)
  }
})

module.exports = router
