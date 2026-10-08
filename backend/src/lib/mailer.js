const API_URL = 'https://api.brevo.com/v3/smtp/email'

function toBrevoAttachments(attachments = []) {
  return attachments
    .map((a) => {
      const name = a.filename || a.name || 'attachment'
      if (a.content) {
        const buf = Buffer.isBuffer(a.content)
          ? a.content
          : Buffer.from(a.content, a.encoding === 'base64' ? 'base64' : 'utf8')
        return { name, content: buf.toString('base64') }
      }
      if (a.path && /^https?:\/\//.test(a.path)) {
        return { name, url: a.path }
      }
      return null
    })
    .filter(Boolean)
}

/**
 * Sends an email via Brevo's HTTP API. Deliberately fail-quiet:
 * email is a courtesy notification, not the source of truth.
 */
export async function sendMail({ to, subject, html, attachments }) {
  if (!to) return

  const { BREVO_API_KEY, MAIL_FROM_EMAIL, MAIL_FROM_NAME } = process.env
  if (!BREVO_API_KEY || !MAIL_FROM_EMAIL) {
    console.warn('[mailer] BREVO_API_KEY/MAIL_FROM_EMAIL not set — emails will be skipped.')
    return
  }

  const body = {
    sender: { name: MAIL_FROM_NAME || 'SERV Pickleball Club', email: MAIL_FROM_EMAIL },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  }
  const files = toBrevoAttachments(attachments)
  if (files.length) body.attachment = files

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(`Brevo ${res.status}: ${await res.text()}`)
    }
  } catch (err) {
    console.error(`[mailer] failed to send "${subject}" to ${to}:`, err.message)
  }
}