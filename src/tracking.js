import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import {
  db,
  FIRESTORE_EMULATOR,
  firebaseApiKey,
  firebaseProjectId,
  usingEmulators,
} from './firebase.js'

const HEARTBEAT_MS = 10000
const SCROLL_GESTURE_GAP_MS = 400
const MAX_EVENTS = 60
const FINISHED_SCROLL_PERCENT = 95
const VISITOR_ID_STORAGE_KEY = 'thought-drop:visitor-id'
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function getVisitorId() {
  let storedId
  try {
    storedId = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY)
    if (storedId && VISITOR_ID_PATTERN.test(storedId)) return storedId
  } catch (error) {
    console.warn('Could not read the anonymous browser ID; this visit may appear as a new browser.', error)
    return window.crypto.randomUUID()
  }

  const visitorId = window.crypto.randomUUID()
  try {
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId)
  } catch (error) {
    console.warn('Could not save the anonymous browser ID; this visit may appear as a new browser.', error)
  }
  return visitorId
}

function describeDevice() {
  const ua = navigator.userAgent
  let device = 'desktop'
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) device = 'tablet'
  else if (/Mobi|Android|iPhone/i.test(ua)) device = 'mobile'

  let browser = 'Other'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/OPR\//.test(ua)) browser = 'Opera'
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet'
  else if (/Firefox|FxiOS/.test(ua)) browser = 'Firefox'
  else if (/Chrome|CriOS/.test(ua)) browser = 'Chrome'
  else if (/Safari/.test(ua)) browser = 'Safari'

  return { device, browser, screen: `${window.screen.width}×${window.screen.height}` }
}

function toFirestoreValue(value) {
  if (typeof value === 'boolean') return { booleanValue: value }
  if (Number.isInteger(value)) return { integerValue: String(value) }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } }
  return { mapValue: { fields: toFirestoreFields(value) } }
}

function toFirestoreFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, toFirestoreValue(value)]))
}

// Updates go through the REST API with `keepalive` so the final update still reaches Firestore while the tab is closing.
function sendVisitUpdate(visitPath, fields) {
  const base = usingEmulators
    ? `http://${FIRESTORE_EMULATOR.host}:${FIRESTORE_EMULATOR.port}`
    : 'https://firestore.googleapis.com'
  const database = `projects/${firebaseProjectId}/databases/(default)`
  return fetch(`${base}/v1/${database}/documents:commit?key=${encodeURIComponent(firebaseApiKey)}`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        {
          update: { name: `${database}/documents/${visitPath}`, fields: toFirestoreFields(fields) },
          updateMask: { fieldPaths: Object.keys(fields) },
          updateTransforms: [{ fieldPath: 'lastSeenAt', setToServerValue: 'REQUEST_TIME' }],
          currentDocument: { exists: true },
        },
      ],
    }),
  }).catch(() => {})
}

function scrollPercent() {
  const scrollable = document.documentElement.scrollHeight
  if (scrollable <= 0) return 100
  return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / scrollable) * 100))
}

export function startVisitTracking(code) {
  const visitRef = doc(collection(db, 'pages', code, 'visits'))
  const visitorId = getVisitorId()
  const openedAt = performance.now()
  const state = {
    activeMs: 0,
    maxScroll: scrollPercent(),
    scrolls: 0,
    taps: 0,
    hiddenCount: 0,
    events: [{ type: 'open', t: 0 }],
    ended: false,
  }
  let visibleSince = document.visibilityState === 'visible' ? openedAt : null
  let created = false
  let finished = false
  let lastScrollAt = 0
  let dirty = false

  function addEvent(type) {
    if (state.events.length < MAX_EVENTS) state.events.push({ type, t: Math.round(performance.now() - openedAt) })
    dirty = true
  }

  function currentActiveMs() {
    const running = visibleSince === null ? 0 : performance.now() - visibleSince
    return Math.round(state.activeMs + running)
  }

  function flush(force = false) {
    if (!created || (!dirty && !force && visibleSince === null)) return
    dirty = false
    sendVisitUpdate(visitRef.path, { ...state, activeMs: currentActiveMs() })
  }

  function checkFinished() {
    if (!finished && state.maxScroll >= FINISHED_SCROLL_PERCENT) {
      finished = true
      addEvent('finished')
    }
  }

  function handleScroll() {
    const now = performance.now()
    if (now - lastScrollAt > SCROLL_GESTURE_GAP_MS) state.scrolls += 1
    lastScrollAt = now
    const percent = scrollPercent()
    if (percent > state.maxScroll) state.maxScroll = percent
    checkFinished()
    dirty = true
  }

  function handleTap() {
    state.taps += 1
    dirty = true
  }

  function handleVisibility() {
    if (state.ended) return
    if (document.visibilityState === 'hidden') {
      if (visibleSince !== null) {
        state.activeMs += performance.now() - visibleSince
        visibleSince = null
      }
      state.hiddenCount += 1
      addEvent('hidden')
      flush(true)
    } else if (visibleSince === null) {
      visibleSince = performance.now()
      addEvent('visible')
      flush(true)
    }
  }

  function handlePageHide() {
    if (state.ended) return
    if (visibleSince !== null) {
      state.activeMs += performance.now() - visibleSince
      visibleSince = null
    }
    state.ended = true
    addEvent('closed')
    flush(true)
  }

  // Mobile browsers can restore a closed page from the back/forward cache; treat that as coming back.
  function handlePageShow(event) {
    if (!event.persisted || !state.ended) return
    state.ended = false
    visibleSince = performance.now()
    addEvent('visible')
    flush(true)
  }

  checkFinished()
  // Deferring the create lets an immediate unmount (e.g. React StrictMode's double mount) cancel it.
  const createTimer = window.setTimeout(() => {
    setDoc(visitRef, {
      startedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      activeMs: 0,
      maxScroll: state.maxScroll,
      scrolls: 0,
      taps: 0,
      hiddenCount: 0,
      events: [{ type: 'open', t: 0 }],
      ended: false,
      ...describeDevice(),
      visitorId,
    })
      .then(() => {
        created = true
        flush(true)
      })
      .catch(() => {})
  }, 0)

  const heartbeat = window.setInterval(() => {
    if (visibleSince !== null) flush(true)
  }, HEARTBEAT_MS)

  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('pointerdown', handleTap, { passive: true })
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)

  return () => {
    window.clearTimeout(createTimer)
    window.clearInterval(heartbeat)
    window.removeEventListener('scroll', handleScroll)
    window.removeEventListener('pointerdown', handleTap)
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('pagehide', handlePageHide)
    window.removeEventListener('pageshow', handlePageShow)
    handlePageHide()
  }
}
