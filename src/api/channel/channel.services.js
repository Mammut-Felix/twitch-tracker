const { db } = require('../../utils/database')
const { twitchFetchProfileQueue, twitchRegisterWebhookQueue } = require('../../queues')

exports.findAll = () => {
  return db.channel.findMany()
}

exports.findChannelById = id => {
  return db.channel.findUnique({
    where: {
      id
    }
  })
}

exports.createChannel = async channel => {
  const options = {
    timeout: 1000 * 60 * 2, // 2 minutes
    removeOnComplete: {
      age: 1000 * 60 * 60 * 24 * 7
    },
    removeOnFail: false
  }

  twitchFetchProfileQueue.add(
    channel.broadcaster_user_login || channel.broadcaster_user_id,
    {
      user_login: channel.broadcaster_user_login,
      user_id: channel.broadcaster_user_id
    },
    {
      ...options
    }
  )

  const jobs = [
    {
      name: `${channel.broadcaster_user_login || channel.broadcaster_user_id} - stream.online`,
      data: {
        type: 'stream.online',
        condition: {
          broadcaster_user_id: channel.broadcaster_user_id
        },
        user_id: channel.broadcaster_user_id
      },
      opts: options
    },
    {
      name: `${channel.broadcaster_user_login || channel.broadcaster_user_id} - stream.offline`,
      data: {
        type: 'stream.offline',
        condition: {
          broadcaster_user_id: channel.broadcaster_user_id
        },
        user_id: channel.broadcaster_user_id
      },
      opts: options
    },
    {
      name: `${channel.broadcaster_user_login || channel.broadcaster_user_id} - channel.update`,
      data: {
        type: 'channel.update',
        condition: {
          broadcaster_user_id: channel.broadcaster_user_id
        },
        user_id: channel.broadcaster_user_id
      },
      opts: options
    },
    {
      name: `${channel.broadcaster_user_login || channel.broadcaster_user_id} - channel.raid.to`,
      data: {
        type: 'channel.raid',
        condition: {
          to_broadcaster_user_id: channel.broadcaster_user_id
        },
        user_id: channel.broadcaster_user_id
      },
      opts: options
    },
    {
      name: `${channel.broadcaster_user_login || channel.broadcaster_user_id} - channel.raid.from`,
      data: {
        type: 'channel.raid',
        condition: {
          from_broadcaster_user_id: channel.broadcaster_user_id
        },
        user_id: channel.broadcaster_user_id
      },
      opts: options
    }
  ]

  return twitchRegisterWebhookQueue.addBulk(jobs)
}

exports.deleteChannel = id => {
  return db.channel.delete({
    where: {
      id
    }
  })
}
