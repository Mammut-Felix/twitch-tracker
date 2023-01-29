module.exports = app => {
  const promBundle = require('express-prom-bundle')

  const prometheusMetrics = promBundle({
    buckets: [0.1, 0.5, 1, 1.5],
    includeMethod: true,
    includePath: true,
    customLabels: {
      app: null,
      type: null,
      version: null
    },
    transformLabels(labels, request) {
      // eslint-disable-next-line no-unused-expressions, no-sequences
      labels.app = 'twitch-tracker'
      labels.type = 'twitch-tracker'
    },
    metricsPath: '/metrics',
    promClient: {
      collectDefaultMetrics: {}
    }
  })

  app.use('/metrics', prometheusMetrics)
}
