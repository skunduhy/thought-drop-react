import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

export const MAX_MESSAGE_LENGTH = 5000
export const MAX_TITLE_LENGTH = 80
export const MAX_SENDER_LENGTH = 40
export const SAMPLE_CODE = 'SAMPLE1'
export const PAGE_CODE_PATTERN = /^[A-Z0-9]{7}$/

const CODE_LENGTH = 7
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const MAX_PUBLISH_ATTEMPTS = 5

export function createPageCode() {
  let code = ''
  while (code.length < CODE_LENGTH || code === SAMPLE_CODE) {
    if (code.length === CODE_LENGTH) code = ''
    for (const byte of window.crypto.getRandomValues(new Uint8Array(16))) {
      // 252 is the largest multiple of 36 below 256; skipping higher bytes keeps every character equally likely.
      if (byte < 252 && code.length < CODE_LENGTH) {
        code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
      }
    }
  }
  return code
}

export async function publishPage({ title, message, sender }, user) {
  for (let attempt = 0; attempt < MAX_PUBLISH_ATTEMPTS; attempt += 1) {
    const code = createPageCode()
    const pageRef = doc(db, 'pages', code)
    const created = await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(pageRef)
      if (existing.exists()) return false
      transaction.set(pageRef, {
        title,
        message,
        sender,
        authorUid: user.uid,
        createdAt: serverTimestamp(),
      })
      return true
    })
    if (created) return code
  }
  throw new Error('Could not find a free page code. Please try again.')
}

export async function fetchPage(code) {
  const snapshot = await getDoc(doc(db, 'pages', code))
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  if (typeof data.message !== 'string' || !data.message.trim()) return null
  return {
    title: typeof data.title === 'string' ? data.title : '',
    message: data.message,
    sender: typeof data.sender === 'string' ? data.sender : '',
  }
}
