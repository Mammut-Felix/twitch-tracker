module.exports = {
  schedule_generate_report: {
    daily: {
      name: 'schedule | generate-daily-report',
      cron: '0 6 * * *',
      concurrency: 1,
      processorName: '*'
    },
    weekly: {
      name: 'schedule | generate-weekly-report',
      cron: '0 6 * * 1',
      concurrency: 1,
      processorName: '*'
    }
  }
}
