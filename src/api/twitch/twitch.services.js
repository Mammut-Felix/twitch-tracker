const { databaseWriteEventQueue, twitchFetchStreamQueue } = require('../../queues')

async function handleNotification({ notification, eventId }) {
  const { type } = notification.subscription
  const { to_broadcaster_user_id, from_broadcaster_user_id, broadcaster_user_id } =
    notification.event
  const user_id = to_broadcaster_user_id || from_broadcaster_user_id || broadcaster_user_id

  if (!user_id) {
    throw new Error('No user id found')
  }

  databaseWriteEventQueue.add(
    `${user_id}_${type}`,
    { message: notification, eventId },
    {
      removeOnComplete: {
        age: 1000 * 60 * 60 * 24 * 7
      },
      removeOnFail: false
    }
  )

  switch (type) {
    case 'stream.online': {
      // Check stream stats every minute while stream is online
      twitchFetchStreamQueue.add(
        user_id,
        {
          user_id,
          trigger: 'stream.online'
        },
        {
          repeat: {
            every: 1000 * 60 // 1 minute
          },
          removeOnComplete: {
            age: 1000 * 60 * 60 * 24 * 7
          },
          removeOnFail: false,
          timeout: 1000 * 60, // 1 minute
          jobId: user_id
        }
      )
      break
    }
    case 'stream.offline': {
      // Remove stream stats job when stream goes offline
      twitchFetchStreamQueue.add(
        user_id,
        {
          user_id,
          trigger: 'stream.offline'
        },
        {
          removeOnComplete: {
            age: 1000 * 60 * 60 * 24 * 7
          },
          removeOnFail: false,
          timeout: 1000 * 60 // 1 minute
        }
      )
      const jobs = await twitchFetchStreamQueue.getRepeatableJobs()
      const key = jobs.find(job => job.id === user_id)?.key
      if (key) {
        await twitchFetchStreamQueue.removeRepeatableByKey(key)
        twitchFetchStreamQueue.removeRepeatableByKey(user_id)
      }
      break
    }
    case 'channel.raid': {
      // Get stream stats when raid happens
      twitchFetchStreamQueue.add(
        user_id,
        {
          user_id,
          trigger: 'channel.raid'
        },
        {
          removeOnComplete: {
            age: 1000 * 60 * 60 * 24 * 7
          },
          removeOnFail: false,
          timeout: 1000 * 60 // 1 minute
        }
      )
      break
    }
    default: {
      break
    }
  }
}

module.exports = {
  handleNotification
}
