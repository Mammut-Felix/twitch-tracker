const crypto = require('node:crypto')

function hashToken(token) {
  return crypto.createHash('sha512').update(token).digest('hex')
}

module.exports = { hashToken }
