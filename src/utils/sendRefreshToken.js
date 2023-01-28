function sendRefreshToken(response, token) {
  response.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: true,
    path: '/api/v1/auth'
  })
}

module.exports = { sendRefreshToken }
