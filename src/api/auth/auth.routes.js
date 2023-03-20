const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const {
  findUserByEmail,
  createUserByEmailAndPassword,
  findUserById
} = require('../users/users.services')
const { generateTokens } = require('../../utils/jwt')
const {
  addRefreshTokenToWhitelist,
  findRefreshTokenById,
  deleteRefreshToken,
  revokeTokens
} = require('./auth.services')
const { hashToken } = require('../../utils/hashToken')

const router = express.Router()

router.post('/register', async (request, response, next) => {
  try {
    const { email, password } = request.body
    if (!email || !password) {
      response.status(400)
      throw new Error('You must provide an email and a password.')
    }

    const existingUser = await findUserByEmail(email)

    if (existingUser) {
      response.status(400)
      throw new Error('Email already in use.')
    }

    const user = await createUserByEmailAndPassword({ email, password })
    const jti = uuidv4()
    const { accessToken, refreshToken } = generateTokens(user, jti)
    await addRefreshTokenToWhitelist({ jti, refreshToken, userId: user.id })

    response.json({
      accessToken,
      refreshToken
    })
  } catch (error) {
    next(error)
  }
})

router.post('/login', async (request, response, next) => {
  try {
    const { email, password } = request.body
    if (!email || !password) {
      response.status(400)
      throw new Error('You must provide an email and a password.')
    }

    const existingUser = await findUserByEmail(email)

    if (!existingUser) {
      response.status(403)
      throw new Error('Invalid login credentials.')
    }

    // deepcode ignore NoRateLimitingForLogin: it is rate limited
    const validPassword = await bcrypt.compare(password, existingUser.password)
    if (!validPassword) {
      response.status(403)
      throw new Error('Invalid login credentials.')
    }

    const jti = uuidv4()
    const { accessToken, refreshToken } = generateTokens(existingUser, jti)
    await addRefreshTokenToWhitelist({ jti, refreshToken, userId: existingUser.id })

    response.json({
      accessToken,
      refreshToken
    })
  } catch (error) {
    next(error)
  }
})

router.post('/refreshToken', async (request, response, next) => {
  try {
    const { refreshToken } = request.body
    if (!refreshToken) {
      response.status(400)
      throw new Error('Missing refresh token.')
    }
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
    const savedRefreshToken = await findRefreshTokenById(payload.jti)

    console.log(savedRefreshToken)

    if (!savedRefreshToken || savedRefreshToken.revoked === true) {
      response.status(401)
      throw new Error('Unauthorized')
    }

    const hashedToken = hashToken(refreshToken)
    if (hashedToken !== savedRefreshToken.hashedToken) {
      response.status(401)
      throw new Error('Unauthorized')
    }

    const user = await findUserById(payload.userId)
    if (!user) {
      response.status(401)
      throw new Error('Unauthorized')
    }

    await deleteRefreshToken(savedRefreshToken.id)
    const jti = uuidv4()
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user, jti)
    await addRefreshTokenToWhitelist({
      jti,
      refreshToken: newRefreshToken,
      userId: user.id
    })

    response.json({
      accessToken,
      refreshToken: newRefreshToken
    })
  } catch (error) {
    next(error)
  }
})

// This endpoint is only for demo purpose.
// Move this logic where you need to revoke the tokens( for ex, on password reset)
router.post('/revokeRefreshTokens', async (request, response, next) => {
  try {
    const { userId } = request.body
    await revokeTokens(userId)
    response.json({ message: `Tokens revoked for user with id #${userId}` })
  } catch (error) {
    next(error)
  }
})

module.exports = router
