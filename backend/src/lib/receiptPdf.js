import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// PDFKit's built-in Helvetica has no peso sign (U+20B1), so it printed as a
// broken glyph. DejaVu Sans does include it, so the money line uses these.
const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts')
const FONT_PESO = path.join(FONT_DIR, 'DejaVuSans.ttf')
const FONT_PESO_BOLD = path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Matches frontend/tailwind.config.js — keep in sync if the site's
// palette ever changes. PDFKit's built-in fonts don't cover emoji
// reliably, so styling here leans on color/layout instead.
const COLORS = {
  courtDark: '#16324F',
  spark: '#E8735C',
  ink: '#14212B',
  mist: '#F5F7F8',
  line: '#E2E8ED',
  muted: '#64748b',
  success: '#16a34a',
}

/**
 * Builds a one-page PDF receipt and returns it as a Buffer — used both
 * to stream a download and to attach to a confirmation email. Meant to
 * be shown at the courts (screen or printout) and traced back to the
 * booking via the QR code, which just links to the same
 * public confirmation page the customer already has — staff scan it,
 * see the live status pulled straight from the database, and match
 * the name.
 *
 * @param {{
 *   referenceCode: string,
 *   guestName: string,
 *   heading: string,
 *   lines: string[],
 *   totalLabel: string,
 *   verifyPath: string,
 * }} opts
 * @returns {Promise<Buffer>}
 */
export function buildReceiptPdf(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const verifyUrl = `${FRONTEND_URL}${opts.verifyPath}`
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 220, color: { dark: COLORS.courtDark } })
      const qrImage = Buffer.from(qrDataUrl.split(',')[1], 'base64')

      const doc = new PDFDocument({ size: 'A5', margin: 0 })
      doc.registerFont('PesoSans', FONT_PESO)
      doc.registerFont('PesoSans-Bold', FONT_PESO_BOLD)
      const chunks = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const pageWidth = doc.page.width
      const margin = 36
      const contentWidth = pageWidth - margin * 2

      // Header band
      doc.rect(0, 0, pageWidth, 78).fill(COLORS.courtDark)
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17).text('SERV Pickleball Club', margin, 28, {
        width: contentWidth,
        align: 'center',
      })

      // Status pill, centered, just below the header band
      doc.font('Helvetica-Bold').fontSize(10)
      const pillLabel = opts.heading.toUpperCase()
      const pillWidth = doc.widthOfString(pillLabel) + 24
      const pillX = (pageWidth - pillWidth) / 2
      doc
        .roundedRect(pillX, 96, pillWidth, 22, 11)
        .fill(COLORS.success)
      doc.fillColor('#ffffff').text(pillLabel, pillX, 102, { width: pillWidth, align: 'center' })

      let y = 148

      // Info card
      const lineCount = opts.lines.length
      const cardHeight = 56 + lineCount * 16 + 28
      doc.roundedRect(margin, y, contentWidth, cardHeight, 10).fillAndStroke(COLORS.mist, COLORS.line)

      let cy = y + 16
      const labelX = margin + 16
      const valueX = margin + contentWidth - 16

      const row = (label, value, opts2 = {}) => {
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(label, labelX, cy)
        doc
          .font(opts2.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(opts2.size || 10)
          .fillColor(opts2.color || COLORS.ink)
          .text(value, labelX, cy, { width: contentWidth - 32, align: 'right' })
        cy += opts2.gap || 16
      }

      row('REFERENCE', opts.referenceCode, { bold: true })
      row('NAME', opts.guestName)
      cy += 4
      doc
        .moveTo(labelX, cy - 6)
        .lineTo(valueX, cy - 6)
        .strokeColor(COLORS.line)
        .stroke()

      opts.lines.forEach((line) => {
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.ink).text(line, labelX, cy, { width: contentWidth - 32 })
        cy += 16
      })

      cy += 4
      doc
        .moveTo(labelX, cy - 6)
        .lineTo(valueX, cy - 6)
        .strokeColor(COLORS.line)
        .stroke()

      doc.font('PesoSans-Bold').fontSize(11).fillColor(COLORS.spark).text(opts.totalLabel, labelX, cy, {
        width: contentWidth - 32,
      })

      y = y + cardHeight + 24

      // QR box
      const qrBoxSize = 150
      const qrBoxX = (pageWidth - qrBoxSize) / 2
      doc.roundedRect(qrBoxX, y, qrBoxSize, qrBoxSize, 10).fillAndStroke('#ffffff', COLORS.line)
      doc.image(qrImage, qrBoxX + 15, y + 15, { fit: [qrBoxSize - 30, qrBoxSize - 30] })

      y += qrBoxSize + 16

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(COLORS.muted)
        .text('Bring this receipt (screen or printout) to the courts. Staff can scan the QR code above to verify your status live.', margin, y, {
          width: contentWidth,
          align: 'center',
        })

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

/** Streams a receipt PDF straight to an HTTP response (the download endpoint). */
export async function streamReceiptPdf(res, opts) {
  const buffer = await buildReceiptPdf(opts)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="SERV-${opts.filenameSuffix}-${opts.referenceCode}.pdf"`)
  res.send(buffer)
}
