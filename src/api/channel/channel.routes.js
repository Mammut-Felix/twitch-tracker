const express = require('express')
const { isAuthenticated } = require('../../middlewares')
const { findAll, findChannelById, createChannel, deleteChannel } = require('./channel.services')

const router = express.Router()

router.get('/', [isAuthenticated], async (request, response, next) => {
  try {
    const channels = await findAll()
    response.json(channels)
  } catch (error) {
    next(error)
  }
})
router.get('/:id', [isAuthenticated], async (request, response, next) => {
  try {
    const { id } = request.params
    const channel = await findChannelById(id)

    if (!channel) {
      response.status(404)
      return next(new Error(`🔍 - Not Found - ${request.originalUrl}`))
    }

    response.json(channel)
  } catch (error) {
    next(error)
  }
})
router.post('/', [isAuthenticated], async (request, response, next) => {
  try {
    const { broadcaster_user_id, broadcaster_user_login } = request.body
    const channel = await createChannel({ broadcaster_user_id, broadcaster_user_login })
    response.json(channel)
  } catch (error) {
    next(error)
  }
})
router.delete('/:id', [isAuthenticated], async (request, response, next) => {
  try {
    const { id } = request.params
    const channel = await deleteChannel(Number.parseInt(id))
    response.json(channel)
  } catch (error) {
    next(error)
  }
})

module.exports = router
