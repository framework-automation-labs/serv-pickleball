import nodemailer from 'nodemailer'

let transporter
let attempted = false

function getTransporter() {
  if (attempted) return transporter
  attempted = true

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[mailer] SMTP_HOST/SMTP_USER/SMTP_PASS not set — emails will be skipped, not sent.')
    transporter = null
    return null
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

const MAIL_FROM = process.env.MAIL_FROM || '"SERV Pickleball Club" <no-reply@example.com>'

/**
 * Sends an email. Deliberately fail-quiet: a broken SMTP config or a
 * missing address should never break a booking/review —
 * email here is a courtesy notification, not the source of truth.
 */
export async function sendMail({ to, subject, html, attachments }) {
  if (!to) return
  const t = getTransporter()
  if (!t) return

  try {
    await t.sendMail({ from: MAIL_FROM, to, subject, html, attachments })
  } catch (err) {
    console.error(`[mailer] failed to send "${subject}" to ${to}:`, err.message)
  }
}
