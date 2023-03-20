require('dotenv').config()
const { startScheduler } = require('./queues')

startScheduler()
  .then(() => {
    const app = require('./app')

    const port = process.env.PORT || 5000
    app.listen(port, () => {
      /* eslint-disable no-console */
      console.log(`Listening: http://localhost:${port}`)
      /* eslint-enable no-console */
    })
  })
  .catch(error => {
    /* eslint-disable no-console */
    console.error(error)
    /* eslint-enable no-console */
  })
