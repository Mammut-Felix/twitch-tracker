const express = require('express')
const { findReportById } = require('./report.services')

const router = express.Router()

router.get('/:id', async (request, response, next) => {
  try {
    const report = await findReportById(request.params.id)
    response.send(report.content)
  } catch (error) {
    next(error)
  }
})

module.exports = router
