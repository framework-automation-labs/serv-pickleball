import crypto from 'node:crypto'

// No 0/O/1/I — easy to read aloud or copy off a screen at the courts.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateReferenceCode(prefix = 'SERV') {
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)]
  }
  return `${prefix}-${code}`
}
