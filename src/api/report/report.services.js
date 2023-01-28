const { db } = require('../../utils/database')

exports.findReportById = id => {
  return db.report.findUnique({
    where: {
      id
    }
  })
}
