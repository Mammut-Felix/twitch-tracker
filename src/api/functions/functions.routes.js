const express = require('express')
const { isAdmin } = require('../../middlewares')
const { fetchSubscriptions } = require('./functions.services')
const { twitchFetchProfileQueue } = require('../../queues')

const router = express.Router()

router.post('/resubscribe', [isAdmin], async (request, response, next) => {
  try {
    const data = await fetchSubscriptions()
    const ids = data.map(item => {
      if (item.condition.broadcaster_user_id) {
        return item.condition.broadcaster_user_id
      }

      if (
        item.condition.from_broadcaster_user_id !== undefined &&
        item.condition.from_broadcaster_user_id !== ''
      ) {
        return item.condition.from_broadcaster_user_id
      }

      if (
        item.condition.to_broadcaster_user_id !== undefined &&
        item.condition.to_broadcaster_user_id !== ''
      ) {
        return item.condition.to_broadcaster_user_id
      }

      return null
    })

    const uniqueIds = [...new Set(ids)]

    const options = {
      timeout: 1000 * 60 * 2, // 2 minutes
      removeOnComplete: {
        age: 1000 * 60 * 60 * 24 * 7
      },
      removeOnFail: false
    }

    for (const id of uniqueIds) {
      twitchFetchProfileQueue.add(
        id,
        {
          user_id: id
        },
        {
          ...options
        }
      )
    }
    response.json(uniqueIds)
  } catch (error) {
    next(error)
  }
})

module.exports = router
