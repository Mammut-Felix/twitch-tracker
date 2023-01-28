const nodemailer = require('nodemailer')
const { htmlToText } = require('html-to-text')
const { db } = require('../../utils/database')

module.exports = async function (job) {
  job.progress(0)

  const { to, cc, bcc, subject, html, attachments, report } = job.data

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      cc,
      bcc,
      subject,
      html,
      text: htmlToText(html),
      attachments
    })

    if (report && report?.id) {
      await db.report.update({
        where: {
          id: report.id
        },
        data: {
          status: 'SENT',
          result: info
        }
      })
    }

    job.progress(100)
    return info
  } catch (error) {
    if (report && report?.id) {
      await db.report.update({
        where: {
          id: report.id
        },
        data: {
          status: 'FAILED',
          result: { error: error.message }
        }
      })
    }

    job.progress(100)
    throw error
  }
}
