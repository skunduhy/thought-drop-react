import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { AdminView } from './Admin.jsx'
import { auth, googleProvider, isFirebaseConfigured } from './firebase.js'
import {
  fetchPage,
  MAX_MESSAGE_LENGTH,
  MAX_SENDER_LENGTH,
  MAX_TITLE_LENGTH,
  PAGE_CODE_PATTERN,
  publishPage,
  SAMPLE_CODE,
} from './pages.js'
import { startVisitTracking } from './tracking.js'
import './App.css'

const SAMPLE_PAGE = {
  title: 'For the friend who stayed',
  message: [
    'I have been meaning to write this for a long time, and somehow the right moment never came. So I am deciding that this ordinary afternoon is the right moment.',
    'Do you remember the winter everything fell apart? I hardly said a word for weeks. You never asked me to explain. You just kept turning up with terrible coffee and good books, and sat with me until the quiet felt less heavy.',
    'I don’t think I ever thanked you properly. Some kindnesses are so gentle that you only see how big they were much later, when you look back and realise they held the whole thing together.',
    'So here it is, on a page you can keep: thank you. For staying, for the coffee, and for every book with your notes in the margins.',
  ].join('\n'),
  sender: 'Meera',
}

const SETUP_MESSAGE = 'Thought Drop isn’t connected to Firebase yet. Add your Firebase settings to .env.local and restart the app.'

function toParagraphs(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function describeAuthError(error) {
  switch (error?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
    case 'auth/unauthorized-domain':
      return 'This website isn’t on the list of sites allowed to use Google sign-in. Add it under Firebase Authentication → Settings → Authorized domains.'
    default:
      return 'Google sign-in didn’t work. Please try again.'
  }
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M4.5 10h11m-4.5-4.5L15.5 10 11 14.5" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <rect x="7" y="6" width="9" height="11" rx="2" />
      <path d="M12 6V4.5A1.5 1.5 0 0 0 10.5 3h-6A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14H7" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="google-icon">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function BookPage({ code, heading, children }) {
  return (
    <article className="book-page">
      <p className="running-head">
        <span>Thought Drop</span>
        <span>{heading}</span>
      </p>
      {children}
      {code && <p className="folio">— {code} —</p>}
    </article>
  )
}

function WriteLink() {
  return (
    <Link className="text-button" to="/write">
      Write a page of your own <ArrowIcon />
    </Link>
  )
}

function ReadingPage({ code, page, isSample }) {
  return (
    <section className="reader">
      {isSample && <p className="sample-badge">A sample page — this is what your reader will see</p>}
      <BookPage code={code} heading="A page for you">
        {page.title ? (
          <h1 className="page-title">{page.title}</h1>
        ) : (
          <h1 className="visually-hidden">A page for you</h1>
        )}
        <div className="fleuron" aria-hidden="true">❦</div>
        <div className="page-text">
          {toParagraphs(page.message).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <p className="page-signature">— {page.sender || 'someone who thought of you'}</p>
      </BookPage>
      {!isSample && <p className="reading-notice">The sender can see when this page is opened and how long it’s read.</p>}
      <WriteLink />
    </section>
  )
}

function NoticePage({ code, heading, title, children }) {
  return (
    <section className="reader">
      <BookPage code={code} heading={heading}>
        <h1 className="page-title">{title}</h1>
        <div className="fleuron" aria-hidden="true">❦</div>
        <div className="page-text page-text-plain">{children}</div>
      </BookPage>
      <WriteLink />
    </section>
  )
}

function ReaderRoute({ user, authReady }) {
  const { code } = useParams()
  if (!PAGE_CODE_PATTERN.test(code)) return <Navigate to="/" replace />
  return <Reader key={code} code={code} user={user} authReady={authReady} />
}

function Reader({ code, user, authReady }) {
  const isSample = code === SAMPLE_CODE
  const [result, setResult] = useState({ code: null, status: 'loading', page: null })

  useEffect(() => {
    if (isSample || !isFirebaseConfigured) return undefined

    let cancelled = false
    fetchPage(code)
      .then((page) => {
        if (!cancelled) setResult({ code, status: page ? 'ready' : 'missing', page })
      })
      .catch(() => {
        if (!cancelled) setResult({ code, status: 'error', page: null })
      })
    return () => {
      cancelled = true
    }
  }, [code, isSample])

  useEffect(() => {
    const title = isSample ? SAMPLE_PAGE.title : result.page?.title
    document.title = title ? `${title} · Thought Drop` : 'A page for you · Thought Drop'
  }, [isSample, result.page])

  const loadedPage = result.code === code && result.status === 'ready' ? result.page : null
  // The author previewing their own page shouldn't count as a reader visit.
  const shouldTrack = Boolean(loadedPage) && authReady && user?.uid !== loadedPage?.authorUid

  useEffect(() => {
    if (!shouldTrack) return undefined
    return startVisitTracking(code)
  }, [code, shouldTrack])

  if (isSample) return <ReadingPage code={code} page={SAMPLE_PAGE} isSample />

  let status = result.code === code ? result.status : 'loading'
  if (!isFirebaseConfigured) status = 'error'

  if (status === 'loading') {
    return (
      <section className="reader" aria-busy="true">
        <BookPage code={code} heading="A page for you">
          <p className="loading-text" role="status">Turning to your page…</p>
          <div className="loading-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </BookPage>
      </section>
    )
  }

  if (status === 'missing') {
    return (
      <NoticePage code={code} heading="A missing page" title="This page couldn’t be found.">
        <p>Check that the link was copied in full, or ask the person who sent it to share it again.</p>
      </NoticePage>
    )
  }

  if (status === 'error') {
    return (
      <NoticePage code={code} heading="A page for you" title="This page couldn’t be opened.">
        <p>
          {isFirebaseConfigured
            ? 'Something went wrong while fetching it. Check your connection and refresh the page.'
            : SETUP_MESSAGE}
        </p>
      </NoticePage>
    )
  }

  return <ReadingPage code={code} page={result.page} />
}

function Composer({ user, authReady, onSignIn }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sender, setSender] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishedCode, setPublishedCode] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const messageRef = useRef(null)

  const shareUrl = publishedCode ? `${window.location.origin}/${publishedCode}` : ''
  const canNativeShare = typeof navigator.share === 'function'
  const isPublished = Boolean(publishedCode)

  useEffect(() => {
    document.title = 'Write a page · Thought Drop'
  }, [])

  useLayoutEffect(() => {
    const textarea = messageRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [message])

  function editDraft(setter) {
    return (event) => {
      setter(event.target.value)
      setError('')
    }
  }

  async function handlePublish(event) {
    event.preventDefault()
    if (publishing || isPublished) return

    const cleanMessage = message.trim()
    if (!cleanMessage) {
      setError('Write a few words on the page before publishing it.')
      messageRef.current?.focus()
      return
    }
    if (!isFirebaseConfigured) {
      setError(SETUP_MESSAGE)
      return
    }

    setError('')
    setPublishing(true)
    try {
      let author = user
      if (!author) {
        try {
          author = await onSignIn()
        } catch (signInError) {
          setError(describeAuthError(signInError))
          return
        }
      }

      const cleanSender = sender.trim() || author.displayName?.slice(0, MAX_SENDER_LENGTH) || ''
      const code = await publishPage(
        { title: title.trim(), message: cleanMessage, sender: cleanSender },
        author,
      )
      setSender(cleanSender)
      setPublishedCode(code)
      setFeedback('')
    } catch (publishError) {
      setError(
        publishError?.code === 'permission-denied'
          ? `${auth.currentUser?.email || 'This account'} isn’t allowed to publish. Only the admin can publish pages — sign out and use the admin’s Google account.`
          : 'Your page couldn’t be published. Check your connection and try again.',
      )
    } finally {
      setPublishing(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setFeedback('Link copied — send it to your reader.')
    } catch {
      setFeedback('Couldn’t copy automatically. Select the link and copy it instead.')
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: title.trim() || 'A page for you', url: shareUrl })
    } catch {
      // The user closed the share sheet; nothing to do.
    }
  }

  function writeAnother() {
    setTitle('')
    setMessage('')
    setSender('')
    setPublishedCode('')
    setFeedback('')
    setError('')
    window.scrollTo(0, 0)
  }

  let publishLabel = 'Publish this page'
  if (publishing) publishLabel = 'Publishing…'
  else if (authReady && !user) publishLabel = 'Sign in with Google to publish'

  return (
    <form className="composer" onSubmit={handlePublish}>
      <BookPage code={publishedCode} heading={isPublished ? 'Published' : 'A page for someone'}>
        <label className="visually-hidden" htmlFor="page-title">Title (optional)</label>
        <input
          id="page-title"
          className="page-title page-title-input"
          type="text"
          placeholder="A title, if you like"
          maxLength={MAX_TITLE_LENGTH}
          value={title}
          readOnly={isPublished}
          onChange={editDraft(setTitle)}
        />
        <div className="fleuron" aria-hidden="true">❦</div>
        <label className="visually-hidden" htmlFor="page-message">Your message</label>
        <textarea
          id="page-message"
          ref={messageRef}
          className="page-text page-textarea"
          placeholder={'Dear you,\nBegin wherever feels right. Press Enter to start a new paragraph…'}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={8}
          value={message}
          readOnly={isPublished}
          onChange={editDraft(setMessage)}
        />
        <div className="page-signature signature-field">
          <span aria-hidden="true">—</span>
          <label className="visually-hidden" htmlFor="page-sender">Your name (optional)</label>
          <input
            id="page-sender"
            type="text"
            placeholder={user?.displayName || 'your name (optional)'}
            maxLength={MAX_SENDER_LENGTH}
            value={sender}
            readOnly={isPublished}
            onChange={editDraft(setSender)}
          />
        </div>
      </BookPage>

      <div className="page-actions">
        {isPublished ? (
          <div className="share-result" aria-live="polite">
            <p className="share-result-title">Your page is published.</p>
            <p className="share-result-note">Send this link to your reader. They won’t need to sign in.</p>
            <div className="share-link-row">
              <input
                aria-label="Shareable page link"
                readOnly
                value={shareUrl}
                onFocus={(event) => event.target.select()}
              />
              <button className="secondary-button" type="button" onClick={copyLink}>
                <CopyIcon /> Copy
              </button>
              {canNativeShare && (
                <button className="secondary-button ghost" type="button" onClick={nativeShare}>
                  Send…
                </button>
              )}
            </div>
            <div className="share-result-footer">
              <span role="status">{feedback}</span>
              <a className="preview-link" href={shareUrl} target="_blank" rel="noreferrer">
                Open the page <ArrowIcon />
              </a>
            </div>
            <Link className="text-button write-another" to={`/admin/${publishedCode}`}>
              See when it’s read <ArrowIcon />
            </Link>
            <button className="text-button write-another" type="button" onClick={writeAnother}>
              Write another page <ArrowIcon />
            </button>
          </div>
        ) : (
          <>
            <p className="page-hint">
              Each line break starts a new paragraph · {message.length} / {MAX_MESSAGE_LENGTH}
            </p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={publishing || !authReady}>
              {authReady && !user && !publishing && <GoogleIcon />}
              {publishLabel}
              {(user || publishing) && <ArrowIcon />}
            </button>
            <p className="privacy-note">
              Only the admin can publish, after signing in with Google. Readers just open the link — anyone with it can read the page.
            </p>
          </>
        )}
      </div>
    </form>
  )
}

function Landing() {
  useEffect(() => {
    document.title = 'Thought Drop · Little pages for the people you love'
  }, [])

  return (
    <section className="landing" aria-labelledby="landing-title">
      <div className="book-cover">
        <p className="cover-kicker">A small book of one page</p>
        <div className="cover-rule" aria-hidden="true" />
        <h1 id="landing-title" className="cover-title">
          Thought<em>Drop</em>
        </h1>
        <p className="cover-subtitle">Little pages for the people you love.</p>
        <div className="fleuron cover-fleuron" aria-hidden="true">❦</div>
        <p className="cover-lede">
          Write the words you’ve been holding on to. We’ll bind them into a page you can send to the one who should read them.
        </p>
        <div className="cover-actions">
          <Link className="primary-button" to="/write">
            Write a page <ArrowIcon />
          </Link>
          <Link className="secondary-link" to={`/${SAMPLE_CODE}`}>
            Read a sample page
          </Link>
        </div>
        <div className="cover-rule" aria-hidden="true" />
      </div>

      <ol className="contents" aria-label="How it works">
        <li>
          <span className="contents-numeral">I.</span>
          <span className="contents-text"><strong>Write</strong> as many paragraphs as you need.</span>
        </li>
        <li>
          <span className="contents-numeral">II.</span>
          <span className="contents-text"><strong>Publish</strong> it with the admin’s Google account.</span>
        </li>
        <li>
          <span className="contents-numeral">III.</span>
          <span className="contents-text"><strong>They read</strong> it from a short link — no sign-in.</span>
        </li>
      </ol>
    </section>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AdminRoute(props) {
  const { code } = useParams()
  if (code && !PAGE_CODE_PATTERN.test(code)) return <Navigate to="/admin" replace />
  return <AdminView code={code} {...props} />
}

function Masthead({ user, authReady, onSignIn }) {
  const { pathname } = useLocation()
  const readerCode = pathname.match(/^\/([A-Z0-9]{7})\/?$/)?.[1]
  const showAccount = !readerCode && isFirebaseConfigured && authReady

  return (
    <header className="masthead">
      <Link className="brand" to="/" title="Back to the cover">
        thought<em>drop</em>
      </Link>
      {readerCode && (
        <span className="masthead-code">
          Page <span>{readerCode}</span>
        </span>
      )}
      {showAccount &&
        (user ? (
          <div className="account">
            <Link className="account-link" to="/admin">
              Activity
            </Link>
            {user.photoURL && <img className="account-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
            <span className="account-name">{user.displayName || user.email}</span>
            <button className="account-button" type="button" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        ) : (
          <button className="account-button" type="button" onClick={() => onSignIn().catch(() => {})}>
            Sign in
          </button>
        ))}
    </header>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured)

  useEffect(() => {
    if (!auth) return undefined
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthReady(true)
    })
  }, [])

  async function signIn() {
    const credential = await signInWithPopup(auth, googleProvider)
    return credential.user
  }

  const authProps = { user, authReady, onSignIn: signIn }

  return (
    <main className="desk">
      <ScrollToTop />
      <Masthead {...authProps} />
      <Routes>
        <Route index element={<Landing />} />
        <Route path="write" element={<Composer {...authProps} />} />
        <Route path="admin" element={<AdminRoute {...authProps} />} />
        <Route path="admin/:code" element={<AdminRoute {...authProps} />} />
        <Route path=":code" element={<ReaderRoute user={user} authReady={authReady} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="desk-footer">Made for the words you almost didn’t send.</footer>
    </main>
  )
}

export default App