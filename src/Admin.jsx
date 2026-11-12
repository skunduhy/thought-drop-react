import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchPage, fetchVisits, listPagesWithActivity } from './pages.js'

const LIVE_WINDOW_MS = 25000
const FINISHED_SCROLL_PERCENT = 95

const EVENT_LABELS = {
  open: 'Opened the page',
  hidden: 'Switched away',
  visible: 'Came back',
  finished: 'Reached the end',
  closed: 'Closed the page',
}

function formatDuration(ms) {
  const totalSeconds = Math.round((ms || 0) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function formatOffset(ms) {
  const totalSeconds = Math.floor((ms || 0) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function formatDateTime(date) {
  if (!date) return '—'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

function isLive(visit) {
  return !visit.ended && visit.lastSeenAt && Date.now() - visit.lastSeenAt.getTime() < LIVE_WINDOW_MS
}

function useAdminData(loader, key) {
  const [result, setResult] = useState({ key: null, status: 'loading', data: null, error: null })

  useEffect(() => {
    if (!key) return undefined
    let cancelled = false
    loader()
      .then((data) => {
        if (!cancelled) setResult({ key, status: 'ready', data, error: null })
      })
      .catch((error) => {
        if (!cancelled) setResult({ key, status: 'error', data: null, error })
      })
    return () => {
      cancelled = true
    }
    // The loader is recreated every render; `key` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return result.key === key ? result : { status: 'loading', data: null, error: null }
}

function AdminGate({ user, authReady, onSignIn, children }) {
  const [error, setError] = useState('')

  if (!authReady) return <p className="ledger-status">Checking your sign-in…</p>
  if (!user) {
    return (
      <div className="ledger-gate">
        <p>Sign in with the admin’s Google account to see who has read your pages.</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => onSignIn().catch(() => setError('Google sign-in didn’t work. Please try again.'))}
        >
          Sign in with Google
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>
    )
  }
  return children
}

function LoadError({ error, user }) {
  if (error?.code === 'permission-denied') {
    return (
      <div className="ledger-gate">
        <p>
          <strong>{user.email}</strong> isn’t an admin. Only the admin can see reader activity — sign out and use the
          admin’s Google account.
        </p>
      </div>
    )
  }
  return <p className="ledger-status">Activity couldn’t be loaded. Check your connection and refresh.</p>
}

function PagesLedger({ user }) {
  const [refreshCount, setRefreshCount] = useState(0)
  const result = useAdminData(listPagesWithActivity, `${user.uid}:${refreshCount}`)

  return (
    <>
      <div className="ledger-toolbar">
        <p>{result.status === 'ready' ? `${result.data.length} published page${result.data.length === 1 ? '' : 's'}` : ''}</p>
        <button className="account-button" type="button" onClick={() => setRefreshCount((n) => n + 1)}>
          Refresh
        </button>
      </div>
      {result.status === 'loading' && <p className="ledger-status">Opening the ledger…</p>}
      {result.status === 'error' && <LoadError error={result.error} user={user} />}
      {result.status === 'ready' && result.data.length === 0 && (
        <p className="ledger-status">No pages published yet.</p>
      )}
      {result.status === 'ready' && result.data.length > 0 && (
        <ul className="ledger-list">
          {result.data.map((page) => (
            <li key={page.code}>
              <Link className="ledger-row" to={`/admin/${page.code}`}>
                <span className="ledger-row-main">
                  <span className="ledger-row-title">{page.title || page.firstLine || 'Untitled page'}</span>
                  <span className="ledger-row-meta">
                    <code>{page.code}</code> · published {formatDateTime(page.createdAt)}
                  </span>
                </span>
                <span className="ledger-row-stats">
                  <strong>{page.visitCount === 0 ? 'Not read yet' : `Opened ${page.visitCount}×`}</strong>
                  {page.lastSeenAt && <span>last seen {formatDateTime(page.lastSeenAt)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function VisitTimeline({ visit }) {
  return (
    <ol className="visit-timeline">
      {visit.events.map((event, index) => (
        <li key={index}>
          <span className="visit-timeline-time">{formatOffset(event.t)}</span>
          <span>{EVENT_LABELS[event.type] || event.type}</span>
        </li>
      ))}
    </ol>
  )
}

function VisitCard({ visit, number }) {
  const live = isLive(visit)
  return (
    <details className="visit-card">
      <summary>
        <span className="visit-card-heading">
          <span className="visit-number">Visit {number}</span>
          {live && <span className="live-badge">Reading now</span>}
          {visit.maxScroll >= FINISHED_SCROLL_PERCENT && <span className="finished-badge">Read to the end</span>}
        </span>
        <span className="visit-card-when">
          {formatDateTime(visit.startedAt)} → {visit.ended ? 'closed' : live ? 'still open' : 'last seen'}{' '}
          {formatTime(visit.lastSeenAt)}
        </span>
      </summary>
      <dl className="visit-stats">
        <div>
          <dt>Time reading</dt>
          <dd>{formatDuration(visit.activeMs)}</dd>
        </div>
        <div>
          <dt>Scrolled</dt>
          <dd>{visit.maxScroll}%</dd>
        </div>
        <div>
          <dt>Taps / clicks</dt>
          <dd>{visit.taps}</dd>
        </div>
        <div>
          <dt>Scrolls</dt>
          <dd>{visit.scrolls}</dd>
        </div>
        <div>
          <dt>Switched away</dt>
          <dd>{visit.hiddenCount}×</dd>
        </div>
        <div>
          <dt>Device</dt>
          <dd>
            {visit.device} · {visit.browser} · {visit.screen}
          </dd>
        </div>
      </dl>
      <VisitTimeline visit={visit} />
    </details>
  )
}

function PageActivity({ code, user }) {
  const [refreshCount, setRefreshCount] = useState(0)
  const result = useAdminData(
    () => Promise.all([fetchPage(code), fetchVisits(code)]),
    `${code}:${user.uid}:${refreshCount}`,
  )

  if (result.status === 'loading') return <p className="ledger-status">Opening the ledger…</p>
  if (result.status === 'error') return <LoadError error={result.error} user={user} />

  const [page, visits] = result.data
  if (!page) return <p className="ledger-status">There’s no page with the code {code}.</p>

  const totalActive = visits.reduce((sum, visit) => sum + (visit.activeMs || 0), 0)
  const longest = visits.reduce((max, visit) => Math.max(max, visit.activeMs || 0), 0)
  const finishedCount = visits.filter((visit) => visit.maxScroll >= FINISHED_SCROLL_PERCENT).length
  const firstOpened = visits.at(-1)?.startedAt
  const lastSeen = visits.reduce(
    (latest, visit) => (visit.lastSeenAt && (!latest || visit.lastSeenAt > latest) ? visit.lastSeenAt : latest),
    null,
  )

  return (
    <>
      <div className="ledger-page-heading">
        <div>
          <h2>{page.title || 'Untitled page'}</h2>
          <p>
            <a href={`/${code}`} target="_blank" rel="noreferrer">
              /{code}
            </a>{' '}
            · published {formatDateTime(page.createdAt)}
          </p>
        </div>
        <button className="account-button" type="button" onClick={() => setRefreshCount((n) => n + 1)}>
          Refresh
        </button>
      </div>

      <dl className="activity-summary">
        <div>
          <dt>Times opened</dt>
          <dd>{visits.length}</dd>
        </div>
        <div>
          <dt>Total reading time</dt>
          <dd>{formatDuration(totalActive)}</dd>
        </div>
        <div>
          <dt>Longest visit</dt>
          <dd>{formatDuration(longest)}</dd>
        </div>
        <div>
          <dt>Read to the end</dt>
          <dd>
            {finishedCount} of {visits.length}
          </dd>
        </div>
        <div>
          <dt>First opened</dt>
          <dd>{formatDateTime(firstOpened)}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd>{formatDateTime(lastSeen)}</dd>
        </div>
      </dl>

      {visits.length === 0 ? (
        <p className="ledger-status">Nobody has opened this page yet.</p>
      ) : (
        <div className="visit-list">
          {visits.map((visit, index) => (
            <VisitCard key={visit.id} visit={visit} number={visits.length - index} />
          ))}
        </div>
      )}
    </>
  )
}

export function AdminView({ code, user, authReady, onSignIn }) {
  useEffect(() => {
    document.title = code ? `Activity for ${code} · Thought Drop` : 'Reader activity · Thought Drop'
  }, [code])

  return (
    <section className="ledger">
      <article className="book-page ledger-sheet">
        <p className="running-head">
          <span>Thought Drop</span>
          <span>Reader activity</span>
        </p>
        {code ? (
          <Link className="ledger-back" to="/admin">
            ← All pages
          </Link>
        ) : (
          <h1 className="page-title ledger-title">Reader activity</h1>
        )}
        <AdminGate user={user} authReady={authReady} onSignIn={onSignIn}>
          {code ? (
            <PageActivity code={code} user={user} />
          ) : (
            <PagesLedger user={user} />
          )}
        </AdminGate>
      </article>
    </section>
  )
}
