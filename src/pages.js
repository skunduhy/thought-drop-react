import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'

export const MAX_MESSAGE_LENGTH = 5000
export const MAX_GREETING_LENGTH = 100
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

export async function publishPage({ title, greeting, message, sender }, user) {
  for (let attempt = 0; attempt < MAX_PUBLISH_ATTEMPTS; attempt += 1) {
    const code = createPageCode()
    const pageRef = doc(db, 'pages', code)
    const created = await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(pageRef)
      if (existing.exists()) return false
      transaction.set(pageRef, {
        title,
        greeting,
        message,
        sender,
        authorUid: user.uid,
        published: true,
        createdAt: serverTimestamp(),
      })
      return true
    })
    if (created) return code
  }
  throw new Error('Could not find a free page code. Please try again.')
}

// Firestore denies reads of unpublished pages to non-admins, so a denied read is reported the same as a missing page.
export async function fetchPage(code) {
  let snapshot
  try {
    snapshot = await getDoc(doc(db, 'pages', code))
  } catch (error) {
    if (error?.code === 'permission-denied') return null
    throw error
  }
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  if (typeof data.message !== 'string' || !data.message.trim()) return null
  return {
    title: typeof data.title === 'string' ? data.title : '',
    greeting: typeof data.greeting === 'string' ? data.greeting : '',
    message: data.message,
    sender: typeof data.sender === 'string' ? data.sender : '',
    authorUid: typeof data.authorUid === 'string' ? data.authorUid : '',
    published: data.published === true,
    createdAt: data.createdAt?.toDate?.() ?? null,
  }
}

export function setPagePublished(code, published) {
  return updateDoc(doc(db, 'pages', code), { published })
}

async function deleteAllDocs(collectionRef) {
  for (;;) {
    const snapshot = await getDocs(query(collectionRef, limit(500)))
    if (snapshot.empty) return
    const batch = writeBatch(db)
    snapshot.docs.forEach((visitDoc) => batch.delete(visitDoc.ref))
    await batch.commit()
  }
}

export async function deletePage(code) {
  await deleteAllDocs(collection(db, 'pages', code, 'visits'))
  await deleteDoc(doc(db, 'pages', code))
}

export function clearPageActivity(code) {
  return deleteAllDocs(collection(db, 'pages', code, 'visits'))
}

export async function listPagesWithActivity() {
  const snapshot = await getDocs(query(collection(db, 'pages'), orderBy('createdAt', 'desc'), limit(100)))
  return Promise.all(
    snapshot.docs.map(async (pageDoc) => {
      const data = pageDoc.data()
      const visits = collection(db, 'pages', pageDoc.id, 'visits')
      const [countSnapshot, latestSnapshot] = await Promise.all([
        getCountFromServer(visits),
        getDocs(query(visits, orderBy('lastSeenAt', 'desc'), limit(1))),
      ])
      return {
        code: pageDoc.id,
        title: data.title || '',
        firstLine: (data.message || '').split('\n')[0].slice(0, 120),
        published: data.published === true,
        createdAt: data.createdAt?.toDate?.() ?? null,
        visitCount: countSnapshot.data().count,
        lastSeenAt: latestSnapshot.docs[0]?.data().lastSeenAt?.toDate?.() ?? null,
      }
    }),
  )
}

export async function fetchVisits(code) {
  const snapshot = await getDocs(
    query(collection(db, 'pages', code, 'visits'), orderBy('startedAt', 'desc'), limit(200)),
  )
  return snapshot.docs.map((visitDoc) => {
    const data = visitDoc.data()
    return {
      id: visitDoc.id,
      ...data,
      startedAt: data.startedAt?.toDate?.() ?? null,
      lastSeenAt: data.lastSeenAt?.toDate?.() ?? null,
      events: Array.isArray(data.events) ? data.events : [],
    }
  })
}
