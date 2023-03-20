const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const requestIp = require('request-ip')

const middlewares = require('./middlewares')
const api = require('./api')

// deepcode ignore UseCsurfForExpress: we dont need csrf protection
const app = express()

app.use(helmet())
app.disable('x-powered-by')
app.use(cors())
app.use(express.json())
app.set('trust proxy', 'uniquelocal')
app.use(requestIp.mw())

require('./metrics')(app)
require('./log')(app)
app.use('/', api)

app.use(middlewares.notFound)
app.use(middlewares.errorHandler)

module.exports = app
