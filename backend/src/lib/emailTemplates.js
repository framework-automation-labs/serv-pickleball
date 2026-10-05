// Matches frontend/tailwind.config.js — keep these in sync if the
// site's palette ever changes.
const COLORS = {
  courtDark: '#16324F',
  court: '#2F6690',
  spark: '#E8735C',
  ink: '#14212B',
  mist: '#F5F7F8',
  line: '#E2E8ED',
  muted: '#64748b',
  success: '#16a34a',
  successBg: '#f0fdf4',
  warning: '#d97706',
  warningBg: '#fffbeb',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
}

// Everything that originates from a customer (name, etc.) or an admin
// (rejection reason) must be escaped before going into an HTML email —
// otherwise a guest could submit a name like <a href="https://evil">…
// and have it rendered inside the admin's notification email (phishing /
// HTML injection).
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const FONT_STACK = "'Inter', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

// Email clients (Gmail, Outlook, Apple Mail) strip <style> blocks and
// modern CSS unpredictably — tables + inline styles are what actually
// renders consistently everywhere, so this is deliberately old-school.
function wrapper(bodyHtml) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.mist}; padding: 32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid ${COLORS.line};">
        <tr>
          <td style="background:${COLORS.courtDark}; padding:24px 28px;">
            <span style="font-family:${FONT_STACK}; font-size:18px; font-weight:700; color:#ffffff; letter-spacing:0.2px;">
              🎾 SERV Pickleball Club
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px; font-family:${FONT_STACK}; color:${COLORS.ink}; font-size:14px; line-height:1.6;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px; background:${COLORS.mist}; border-top:1px solid ${COLORS.line};">
            <span style="font-family:${FONT_STACK}; font-size:11px; color:${COLORS.muted};">
              This is an automated message — please don't reply directly to this email.
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}

function badge(label, { fg, bg }) {
  return `<span style="display:inline-block; font-family:${FONT_STACK}; font-size:12px; font-weight:600; color:${fg}; background:${bg}; padding:4px 12px; border-radius:999px; margin-bottom:14px;">${label}</span>`
}

function referenceCard(rows) {
  const rowsHtml = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:6px 0; font-size:13px; color:${COLORS.muted};">${esc(label)}</td>
        <td style="padding:6px 0; font-size:13px; color:${COLORS.ink}; font-weight:600; text-align:right;">${esc(value)}</td>
      </tr>`
    )
    .join('')
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.mist}; border-radius:10px; padding:14px 16px; margin:16px 0;">
    ${rowsHtml}
  </table>`
}

function button(label, url) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">
    <tr>
      <td style="border-radius:999px; background:${COLORS.spark};">
        <a href="${esc(url)}" style="display:inline-block; font-family:${FONT_STACK}; font-size:13px; font-weight:600; color:#ffffff; text-decoration:none; padding:10px 22px;">
          ${esc(label)}
        </a>
      </td>
    </tr>
  </table>`
}

export function receivedEmail({ referenceCode, itemLabel }) {
  return wrapper(`
    ${badge('RECEIVED', { fg: COLORS.court, bg: '#eaf1f6' })}
    <p style="margin:0 0 8px;">Hi! We received your GCash receipt for <strong>${esc(itemLabel)}</strong>.</p>
    <p style="margin:0;">An admin will check it shortly — you'll get another email the moment it's reviewed, so there's no need to keep the page open.</p>
    ${referenceCard([['Reference', referenceCode]])}
  `)
}

export function confirmedEmail({ referenceCode, itemLabel, totalLabel, verifyUrl }) {
  return wrapper(`
    ${badge('CONFIRMED ✓', { fg: COLORS.success, bg: COLORS.successBg })}
    <p style="margin:0 0 8px;">Your payment for <strong>${esc(itemLabel)}</strong> has been verified.</p>
    <p style="margin:0;">Your receipt is attached as a PDF — bring it (screen or printout) to the courts.</p>
    ${referenceCard([
      ['Reference', referenceCode],
      ['Amount', totalLabel.replace(/^[^:]*:\s*/, '')],
    ])}
    ${button('View Status Online', verifyUrl)}
  `)
}

export function rejectedEmail({ referenceCode, itemLabel, reason }) {
  return wrapper(`
    ${badge('COULD NOT CONFIRM', { fg: COLORS.danger, bg: COLORS.dangerBg })}
    <p style="margin:0 0 8px;">Your submission for <strong>${esc(itemLabel)}</strong> could not be verified.</p>
    <p style="margin:0;">Feel free to submit a new one with a clear receipt, or reach out to the club directly.</p>
    ${referenceCard([
      ['Reference', referenceCode],
      ['Reason', reason],
    ])}
  `)
}

export function adminNewReceiptAlert({ itemLabel, guestName, referenceCode, amount, flagCount, reviewUrl }) {
  return wrapper(`
    ${badge('NEW RECEIPT', { fg: COLORS.court, bg: '#eaf1f6' })}
    <p style="margin:0 0 8px;">New GCash receipt awaiting review — <strong>${esc(itemLabel)}</strong>, ${esc(guestName)}.</p>
    ${
      flagCount > 0
        ? `<p style="margin:0 0 8px; color:${COLORS.warning}; font-weight:600;">⚠ ${flagCount} automated flag(s) — worth a closer look.</p>`
        : ''
    }
    ${referenceCard([
      ['Reference', referenceCode],
      ['Amount', `₱${amount}`],
    ])}
    ${button('Open Admin Dashboard', reviewUrl)}
  `)
}
