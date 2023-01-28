const express = require('express')
const { isAuthenticated, isAdmin, isModerator } = require('../../middlewares')
const { findUserById, findAllUsers } = require('./users.services')

const router = express.Router()

router.get('/me', [isAuthenticated, isModerator], async (request, response, next) => {
  try {
    const { userId } = request.payload
    const user = await findUserById(userId)
    delete user.password
    response.json(user)
  } catch (error) {
    next(error)
  }
})

router.get('/', [isAuthenticated, isAdmin], async (request, response, next) => {
  try {
    const users = await findAllUsers()
    const sanitizedUsers = users.map(user => {
      delete user.password
      return user
    })
    response.json(sanitizedUsers)
  } catch (error) {
    next(error)
  }
})

router.get('/:id', [isAuthenticated, isAdmin], async (request, response, next) => {
  try {
    const { id } = request.params
    const user = await findUserById(id)

    if (!user) {
      response.status(404)
      return next(new Error(`🔍 - Not Found - ${request.originalUrl}`))
    }

    delete user.password
    response.json(user)
  } catch (error) {
    next(error)
  }
})

module.exports = router
