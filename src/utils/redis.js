let nodes = []
const config = {}

if (!('REDIS_MODE' in process.env)) {
  throw new Error('REDIS_MODE is not defined')
}

switch (process.env.REDIS_MODE) {
  case 'standalone': {
    config.host = process.env.REDIS_HOST ?? 'localhost'
    config.port = process.env.REDIS_PORT ?? 6379
    config.password = process.env.REDIS_PASSWORD
    config.username = process.env.REDIS_USERNAME
    config.db = process.env.REDIS_DB ?? 0
    config.enableReadyCheck = false
    config.maxRetriesPerRequest = null
    config.enableOfflineQueue = true
    break
  }
  case 'cluster': {
    if (!('REDIS_NODES' in process.env)) {
      throw new Error('REDIS_NODES is not defined')
    }

    nodes = process.env.REDIS_NODES.split(',').map(node => {
      const [host, port] = node.split(':')
      return { host, port }
    })

    config.redisOptions = {
      password: process.env.REDIS_PASSWORD,
      username: process.env.REDIS_USERNAME,
      maxRetriesPerRequest: null
    }

    config.enableReadyCheck = false
    config.enableAutoPipelining = true
    config.enableOfflineQueue = true

    break
  }
  case 'sentinel': {
    if (!('REDIS_NODES' in process.env)) {
      throw new Error('REDIS_NODES is not defined')
    }

    nodes = process.env.REDIS_NODES.split(',').map(node => {
      const [host, port] = node.split(':')
      return { host, port }
    })

    config.sentinels = nodes
    config.name = process.env.REDIS_MASTER_NAME ?? 'mymaster'
    config.password = process.env.REDIS_PASSWORD
    config.username = process.env.REDIS_USERNAME
    config.db = process.env.REDIS_DB ?? 0
    config.enableReadyCheck = false
    config.maxRetriesPerRequest = null
    config.enableOfflineQueue = true
    break
  }
  default: {
    throw new Error('REDIS_MODE is not valid')
  }
}

exports.config = config
exports.nodes = nodes
