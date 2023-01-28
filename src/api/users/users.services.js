const bcrypt = require('bcrypt')
const { db } = require('../../utils/database')

function findUserByEmail(email) {
  return db.user.findUnique({
    where: {
      email
    }
  })
}

function createUserByEmailAndPassword(user) {
  user.password = bcrypt.hashSync(user.password, 12)
  return db.user.create({
    data: user
  })
}

function findUserById(id) {
  return db.user.findUnique({
    where: {
      id
    }
  })
}

function findAllUsers() {
  return db.user.findMany()
}

module.exports = {
  findUserByEmail,
  findUserById,
  findAllUsers,
  createUserByEmailAndPassword
}
