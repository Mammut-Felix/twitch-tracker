const scheduledJobs = require('../../queues/scheduledJobs')
const { generateScheduledQueue } = require('../../queues')

exports.scheduleJob = async (queue, handler = 'index') => {
  const scheduledQueue = generateScheduledQueue(queue, handler)
  const job = scheduledJobs[queue]?.[handler]
  if (!scheduledQueue || !job) {
    return
  }

  return scheduledQueue.add(
    `${job.name} - manual`,
    {},
    {
      removeOnComplete: {
        age: 1000 * 60 * 60 * 24 * 7
      },
      removeOnFail: false
    }
  )
}
