import { useEffect, useState } from 'react'
import './App.css'

const MAX_MESSAGE_LENGTH = 2000
const SHARE_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function createShareCode() {
  const randomBytes = window.crypto.getRandomValues(new Uint8Array(7))
  return Array.from(
    randomBytes,
    (byte) => SHARE_CODE_ALPHABET[byte % SHARE_CODE_ALPHABET.length],
  ).join('')
}

function encodeNote(note) {
  const bytes = new TextEncoder().encode(JSON.stringify(note))
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function decodeNote(hash) {
  const encoded = new URLSearchParams(hash.slice(1)).get('note')
  if (!encoded) return null

  try {
    const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const note = JSON.parse(new TextDecoder().decode(bytes))
    if (
      typeof note.message !== 'string' ||
      !note.message.trim() ||
      note.message.length > MAX_MESSAGE_LENGTH
    ) {
      return null
    }
    return {
      message: note.message,
      title: typeof note.title === 'string' ? note.title.slice(0, 80) : '',
      sender: typeof note.sender === 'string' ? note.sender.slice(0, 40) : '',
    }
  } catch {
    return null
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

function App() {
  const [note, setNote] = useState(() => decodeNote(window.location.hash))
  const [title, setTitle] = useState('')
  const [sender, setSender] = useState('')
  const [message, setMessage] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const syncNote = () => setNote(decodeNote(window.location.hash))
    window.addEventListener('hashchange', syncNote)
    return () => window.removeEventListener('hashchange', syncNote)
  }, [])

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url)
      setFeedback('Link copied — ready to share.')
      setError('')
    } catch {
      setError('We couldn’t copy the link. Select and copy it instead.')
      setFeedback('')
    }
  }

  function createLink(event) {
    event.preventDefault()
    const cleanMessage = message.trim()
    if (!cleanMessage) {
      setError('Write a little something before creating your link.')
      return
    }

    const nextNote = {
      message: cleanMessage,
      title: title.trim(),
      sender: sender.trim(),
    }
    const url = new URL(window.location.href)
    url.pathname = `/${createShareCode()}`
    url.search = ''
    url.hash = `note=${encodeNote(nextNote)}`
    window.history.pushState(null, '', url)
    setShareUrl(url.toString())
    setFeedback('')
    setError('')
  }

  function startOver(event) {
    event?.preventDefault()
    window.history.pushState(null, '', '/')
    setNote(null)
    setShareUrl('')
    setFeedback('')
    setError('')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" onClick={startOver} aria-label="Thought Drop home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M16 4.5c-5.3 0-9.5 4-9.5 9.1 0 3.2 1.6 5.2 3.5 6.9.9.8 1.3 1.7 1.3 2.8v.2h9.4v-.2c0-1.1.4-2 1.3-2.8 1.9-1.7 3.5-3.7 3.5-6.9 0-5.1-4.2-9.1-9.5-9.1Z" />
              <path d="M12.5 26h7M13.5 29h5" />
              <path d="M16 9v8m-3-3 3 3 3-3" />
            </svg>
          </span>
          <span>thought<span className="brand-light">drop</span></span>
        </a>
        <span className="topbar-note"><span className="status-dot" /> A little note, a long way</span>
      </header>

      {note ? (
        <section className="reader-layout" aria-labelledby="reader-title">
          <div className="reader-intro">
            <p className="eyebrow"><span className="eyebrow-line" /> A note for you</p>
            <h1 id="reader-title">A page, just for you.</h1>
            <p className="reader-subtitle">Take a moment. This one was written for you.</p>
          </div>
          <article className="note-card">
            <div className="note-card-top">
              <span className="note-stamp" aria-hidden="true">✳</span>
              <span className="note-label">JUST FOR YOU</span>
              <span className="note-card-sparkle" aria-hidden="true">✦</span>
            </div>
            {note.title && <h2 className="note-title">{note.title}</h2>}
            <div className="note-message">
              {note.message
                .replace(/\r\n?/g, '\n')
                .split(/\n(?:[ \t]*\n)+/)
                .map((paragraph, index) => (
                  <p key={`${index}-${paragraph}`}>{paragraph}</p>
                ))}
            </div>
            <footer className="note-signoff">
              <span>with a little thought,</span>
              <strong>{note.sender || 'someone who cares'}</strong>
            </footer>
          </article>
          <button className="text-button reader-create" type="button" onClick={startOver}>
            Make a note of your own <ArrowIcon />
          </button>
        </section>
      ) : (
        <section className="composer-layout" aria-labelledby="page-title">
          <div className="composer-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> A LITTLE PAGE, WRITTEN BY YOU</p>
            <h1 id="page-title">Some things are<br />better <em>written softly.</em></h1>
            <p className="intro-copy">
              Put your thoughts on the page. We’ll make a little book-page for someone you care about.
            </p>
            <div className="how-it-works">
              <span className="how-icon" aria-hidden="true">↗</span>
              <p><strong>One link. One little moment.</strong><br />No account, no fuss. Just your words.</p>
            </div>
            <div className="floating-doodle" aria-hidden="true">
              <span className="doodle-star">✳</span>
              <span className="doodle-heart">♡</span>
              <span className="doodle-dot" />
            </div>
          </div>

          <div className="composer-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">A PAGE FOR SOMEONE</p>
                <h2>What would you like them to know?</h2>
              </div>
              <span className="panel-sparkle" aria-hidden="true">✳</span>
            </div>

            <form onSubmit={createLink}>
              <label className="field-label" htmlFor="note-title">A title <span>OPTIONAL</span></label>
              <input
                id="note-title"
                className="text-input"
                type="text"
                placeholder="A little something for you..."
                maxLength={80}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  setShareUrl('')
                  setFeedback('')
                }}
              />

              <label className="field-label message-label" htmlFor="note-message">Your message</label>
              <textarea
                id="note-message"
                className="message-input"
                placeholder={'Dear you,\n\nTake your time. Every good page starts somewhere...'}
                maxLength={MAX_MESSAGE_LENGTH}
                required
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value)
                  setShareUrl('')
                  setFeedback('')
                  setError('')
                }}
              />
              <div className="message-meta">
                <span>Start a new paragraph with a blank line.</span>
                <span className="character-count">{message.length} / {MAX_MESSAGE_LENGTH}</span>
              </div>

              <label className="field-label sender-label" htmlFor="note-sender">Sign your note <span>OPTIONAL</span></label>
              <input
                id="note-sender"
                className="text-input sender-input"
                type="text"
                placeholder="Your name, or leave a little mystery..."
                maxLength={40}
                value={sender}
                onChange={(event) => {
                  setSender(event.target.value)
                  setShareUrl('')
                  setFeedback('')
                }}
              />

              {error && <p className="form-message form-error" role="alert">{error}</p>}
              <button className="primary-button" type="submit">
                Make my shareable page <ArrowIcon />
              </button>
              <p className="privacy-note"><span aria-hidden="true">↗</span> Your message is carried in the link. Anyone with it can read your note.</p>
            </form>

            {shareUrl && (
              <div className="share-result" aria-live="polite">
                <div className="share-result-copy">
                  <span className="share-check" aria-hidden="true">✓</span>
                  <div><strong>Your page is ready</strong><span>Send this link to your person.</span></div>
                </div>
                <div className="share-link-row">
                  <input aria-label="Shareable page link" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
                  <button className="copy-button" type="button" onClick={() => copyLink(shareUrl)}>
                    <CopyIcon /> Copy
                  </button>
                </div>
                <a className="preview-link" href={shareUrl} target="_blank" rel="noreferrer">
                  Preview the reader page <ArrowIcon />
                </a>
                {feedback && <p className="form-message form-success" role="status">{feedback}</p>}
              </div>
            )}
          </div>
          <p className="bottom-note">Made for the words you almost didn’t send <span aria-hidden="true">♡</span></p>
        </section>
      )}

      {note && (
        <footer className="reader-footer">
          <span>thought<span className="brand-light">drop</span></span>
          <span>Made for the words you almost didn’t send <span aria-hidden="true">♡</span></span>
        </footer>
      )}
    </main>
  )
}

export default App
