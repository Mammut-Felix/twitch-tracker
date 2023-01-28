const { db } = require('../../utils/database')

module.exports = async function (job) {
  job.progress(0)
  const { message, eventId } = job.data

  const result = await db.twitchEvent.upsert({
    where: {
      eventId
    },
    update: {
      eventType: message.subscription.type,
      event: message.event
    },
    create: {
      eventId,
      eventType: message.subscription.type,
      event: message.event
    }
  })

  job.progress(100)
  return result
}
