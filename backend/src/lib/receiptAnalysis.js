import crypto from 'node:crypto'
import sharp from 'sharp'

// These checks are DELIBERATELY advisory only. None of them can prove
// a GCash receipt is real or fake on their own — they exist to give
// an admin a head start, not to replace the admin's judgment. Never
// wire these flags up to auto-approve or auto-reject anything.

const ELA_JPEG_QUALITY = 90
const ELA_BLOCK_SIZE = 16
// Refuse to decode absurdly large images ("decompression bombs": a tiny
// file that expands to gigabytes of pixels and exhausts server memory).
// Phone screenshots are ~2-12 megapixels, so 40MP is generous.
export const MAX_INPUT_PIXELS = 40_000_000
const SHARP_OPTS = { limitInputPixels: MAX_INPUT_PIXELS }

const KNOWN_EDITORS = ['Photoshop', 'GIMP', 'Snapseed', 'Lightroom', 'Pixelmator', 'Affinity Photo']

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

// Looks for known photo-editor names inside the raw EXIF block. This is
// a weak signal on purpose: most legitimate GCash screenshots have NO
// exif at all (screenshots strip it), and plenty of genuine receipts
// pass through an editor for cropping/annotating. It's one data point,
// not a verdict.
function checkExifForEditors(metadata) {
  if (!metadata.exif) return null
  const exifText = metadata.exif.toString('latin1')
  const found = KNOWN_EDITORS.find((name) => exifText.includes(name))
  if (!found) return null
  return {
    code: 'editing_software_metadata',
    label: `Image file metadata mentions ${found}`,
    severity: 'high',
  }
}

// Basic Error Level Analysis: recompress the image at a fixed JPEG
// quality and diff it against the original, block by block. Areas that
// were pasted in or retouched later were often saved at a different
// quality than the rest of an already-compressed screenshot, so they
// can show up as a stand-out block in the error map. Legitimate photos
// have natural variance too, so this only flags a SHARP, localized
// outlier — and even then it's a "look closer here", not a verdict.
async function checkErrorLevelAnalysis(buffer) {
  try {
    const original = await sharp(buffer, SHARP_OPTS).ensureAlpha(false).raw().toBuffer({ resolveWithObject: true })
    const recompressed = await sharp(buffer, SHARP_OPTS)
      .jpeg({ quality: ELA_JPEG_QUALITY })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { width, height, channels } = original.info
    if (recompressed.info.width !== width || recompressed.info.height !== height) return null

    const bw = Math.ceil(width / ELA_BLOCK_SIZE)
    const bh = Math.ceil(height / ELA_BLOCK_SIZE)
    const sums = new Array(bw * bh).fill(0)
    const counts = new Array(bw * bh).fill(0)

    const a = original.data
    const b = recompressed.data
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels
        let diff = 0
        for (let c = 0; c < channels; c++) {
          diff += Math.abs(a[idx + c] - b[idx + c])
        }
        const bIdx = Math.floor(y / ELA_BLOCK_SIZE) * bw + Math.floor(x / ELA_BLOCK_SIZE)
        sums[bIdx] += diff
        counts[bIdx] += 1
      }
    }

    const blockAverages = sums.map((s, i) => s / (counts[i] || 1))
    const overallMean = blockAverages.reduce((sum, v) => sum + v, 0) / blockAverages.length
    const maxBlock = Math.max(...blockAverages)

    if (overallMean > 0 && maxBlock > overallMean * 4 && maxBlock > 15) {
      return {
        code: 'possible_localized_edit',
        label: 'One area of the image compresses very differently from the rest of the image',
        severity: 'medium',
      }
    }
    return null
  } catch {
    // ELA is best-effort — never fail the whole upload over it.
    return null
  }
}

/**
 * @param {Buffer} buffer - the uploaded receipt image
 * @returns {Promise<{hash: string, flags: Array<{code:string,label:string,severity:string}>, meta: object|null}>}
 */
export async function analyzeReceipt(buffer) {
  const hash = sha256(buffer)
  const flags = []

  let metadata
  try {
    metadata = await sharp(buffer, SHARP_OPTS).metadata()
  } catch {
    flags.push({ code: 'unreadable_image', label: 'Could not read this as an image file', severity: 'high' })
    return { hash, flags, meta: null }
  }

  const exifFlag = checkExifForEditors(metadata)
  if (exifFlag) flags.push(exifFlag)

  const elaFlag = await checkErrorLevelAnalysis(buffer)
  if (elaFlag) flags.push(elaFlag)

  return { hash, flags, meta: { width: metadata.width, height: metadata.height, format: metadata.format } }
}
