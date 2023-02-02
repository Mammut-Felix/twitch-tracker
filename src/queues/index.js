const Queue = require('bull')
const Redis = require('ioredis')
const { config, nodes } = require('../utils/redis')
const path = require('node:path')
const scheduledJobs = require('./scheduledJobs')

const queues = []

const redisClient = () => {
  return nodes.length > 0 && process.env.REDIS_MODE === 'cluster'
    ? new Redis.Cluster(nodes, config)
    : new Redis({
        ...config
      })
}

let subscriber
let client
const queueOptions = {
  prefix:
    process.env.REDIS_MODE === 'cluster' ? '{twitch-tracker:schedule}' : 'twitch-tracker:schedule',
  createClient: function (type, redisOptions) {
    switch (type) {
      case 'client': {
        if (!client) {
          client = redisClient()
        }
        return client
      }
      case 'subscriber': {
        if (!subscriber) {
          subscriber = redisClient()
        }
        return subscriber
      }
      case 'bclient': {
        return redisClient()
      }
      default: {
        throw new Error('Unexpected connection type: ', type)
      }
    }
  },
  maxStalledCount: 0,
  metrics: {
    maxDataPoints: 60 * 24 * 7 // 1 week
  }
}

const twitchRegisterWebhookQueue = new Queue('twitch | register-webhook', queueOptions)
twitchRegisterWebhookQueue.process(
  '*',
  10,
  path.join(__dirname, '/twitch_register_webhook/index.js')
)

const twitchFetchProfileQueue = new Queue('twitch | fetch-profile', queueOptions)
twitchFetchProfileQueue.process('*', 10, path.join(__dirname, '/twitch_fetch_profile/index.js'))

const twitchFetchStreamQueue = new Queue('twitch | fetch-stream', queueOptions)
twitchFetchStreamQueue.process('*', 10, path.join(__dirname, '/twitch_fetch_stream/index.js'))

const mailSendQueue = new Queue('mail | send', queueOptions)
mailSendQueue.process('*', 10, path.join(__dirname, '/mail_send/index.js'))

const databaseWriteEventQueue = new Queue('db | write-event', queueOptions)
databaseWriteEventQueue.process('*', 10, path.join(__dirname, '/db_write_event/index.js'))

const generateScheduledQueue = (queue, handler = 'index') => {
  const item = scheduledJobs[queue]?.[handler]

  if (!item) {
    return
  }

  const scheduledQueue = new Queue(item.name, queueOptions)
  scheduledQueue.process(
    item.processorName,
    item.concurrency,
    path.join(__dirname, `/${queue}/${handler}.js`)
  )

  return scheduledQueue
}

const clearScheduledJob = async function (queue) {
  const jobs = await queue.getRepeatableJobs()
  for (const job of jobs) {
    await queue.removeRepeatableByKey(job.key)
  }
}

const rescheduleQueue = async (queue, handler = 'index') => {
  const scheduledQueue = generateScheduledQueue(queue, handler)
  const job = scheduledJobs[queue]?.[handler]
  if (!scheduledQueue || !job) {
    return
  }

  await clearScheduledJob(scheduledQueue)
  const result = await scheduledQueue.add(
    job.name,
    {},
    {
      repeat: { cron: job.cron },
      removeOnComplete: {
        age: 1000 * 60 * 60 * 24 * 7
      },
      removeOnFail: false
    }
  )

  const index = queues.findIndex(item => item.name === scheduledQueue.name)
  if (index > -1) {
    queues[index] = scheduledQueue
  } else {
    queues.push(scheduledQueue)
  }

  return result
}

exports.twitchRegisterWebhookQueue = twitchRegisterWebhookQueue
exports.twitchFetchProfileQueue = twitchFetchProfileQueue
exports.twitchFetchStreamQueue = twitchFetchStreamQueue
exports.mailSendQueue = mailSendQueue
exports.queues = queues
exports.databaseWriteEventQueue = databaseWriteEventQueue

exports.generateScheduledQueue = generateScheduledQueue

exports.startScheduler = async () => {
  const result = []

  for (const queue in scheduledJobs) {
    for (const handler in scheduledJobs[queue]) {
      const job = await rescheduleQueue(queue, handler)
      result.push(job)
    }
  }

  return result
}
