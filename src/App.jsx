import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'

const MAX_MESSAGE_LENGTH = 5000
const MAX_TITLE_LENGTH = 80
const MAX_SENDER_LENGTH = 40
const CODE_LENGTH = 7
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CODE_PATTERN = /^\/([A-Z0-9]{7})\/?$/
const SAMPLE_CODE = 'SAMPLE1'
const SAMPLE_NOTE = {
  title: 'For the friend who stayed',
  message: [
    'I have been meaning to write this for a long time, and somehow the right moment never came. So I am deciding that this ordinary afternoon is the right moment.',
    'Do you remember the winter everything fell apart? I hardly said a word for weeks. You never asked me to explain. You just kept turning up with terrible coffee and good books, and sat with me until the quiet felt less heavy.',
    'I don’t think I ever thanked you properly. Some kindnesses are so gentle that you only see how big they were much later, when you look back and realise they held the whole thing together.',
    'So here it is, on a page you can keep: thank you. For staying, for the coffee, and for every book with your notes in the margins.',
  ].join('\n'),
  sender: 'Meera',
}

function createPageCode() {
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

function resolvePageCode() {
  const match = window.location.pathname.match(CODE_PATTERN)
  if (match) return match[1]

  if (window.location.pathname !== '/') window.history.replaceState(null, '', '/')
  return null
}

function encodeNote(note) {
  const bytes = new TextEncoder().encode(JSON.stringify(note))
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

// Returns undefined when there is no note in the link, null when the note is unreadable.
function decodeNote(hash) {
  const encoded = new URLSearchParams(hash.slice(1)).get('note')
  if (encoded === null) return undefined

  try {
    const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const note = JSON.parse(new TextDecoder().decode(bytes))
    if (
      typeof note?.message !== 'string' ||
      !note.message.trim() ||
      note.message.length > MAX_MESSAGE_LENGTH
    ) {
      return null
    }
    return {
      message: note.message,
      title: typeof note.title === 'string' ? note.title.slice(0, MAX_TITLE_LENGTH) : '',
      sender: typeof note.sender === 'string' ? note.sender.slice(0, MAX_SENDER_LENGTH) : '',
    }
  } catch {
    return null
  }
}

function readLocation() {
  const code = resolvePageCode()
  if (!code) return { code: null, note: undefined }
  const note = decodeNote(window.location.hash)
  return { code, note: note === undefined && code === SAMPLE_CODE ? SAMPLE_NOTE : note }
}

function toParagraphs(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
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

function BookPage({ code, heading, children }) {
  return (
    <article className="book-page">
      <p className="running-head">
        <span>Thought Drop</span>
        <span>{heading}</span>
      </p>
      {children}
      <p className="folio">— {code} —</p>
    </article>
  )
}

function App() {
  const [page, setPage] = useState(readLocation)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sender, setSender] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const messageRef = useRef(null)

  const { code, note } = page
  const canNativeShare = typeof navigator.share === 'function'

  useEffect(() => {
    const syncPage = () => {
      setPage(readLocation())
      setShareUrl('')
      setFeedback('')
    }
    window.addEventListener('popstate', syncPage)
    window.addEventListener('hashchange', syncPage)
    return () => {
      window.removeEventListener('popstate', syncPage)
      window.removeEventListener('hashchange', syncPage)
    }
  }, [])

  useEffect(() => {
    if (!code) {
      document.title = 'Thought Drop · Little pages for the people you love'
      return
    }
    document.title = note?.title ? `${note.title} · Thought Drop` : `Page ${code} · Thought Drop`
  }, [code, note])

  useLayoutEffect(() => {
    const textarea = messageRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [message, note])

  function editDraft(setter) {
    return (event) => {
      setter(event.target.value)
      setShareUrl('')
      setFeedback('')
      setError('')
    }
  }

  function createLink(event) {
    event.preventDefault()
    const cleanMessage = message.trim()
    if (!cleanMessage) {
      setError('Write a few words on the page before sharing it.')
      messageRef.current?.focus()
      return
    }

    const encoded = encodeNote({ message: cleanMessage, title: title.trim(), sender: sender.trim() })
    setShareUrl(`${window.location.origin}/${code}#note=${encoded}`)
    setFeedback('')
    setError('')
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

  function openSample(event) {
    event.preventDefault()
    window.history.pushState(null, '', `/${SAMPLE_CODE}`)
    setPage({ code: SAMPLE_CODE, note: SAMPLE_NOTE })
    window.scrollTo(0, 0)
  }

  function goHome(event) {
    event.preventDefault()
    window.history.pushState(null, '', '/')
    setPage({ code: null, note: undefined })
    window.scrollTo(0, 0)
  }

  function startNewPage() {
    const nextCode = createPageCode()
    window.history.pushState(null, '', `/${nextCode}`)
    setPage({ code: nextCode, note: undefined })
    window.scrollTo(0, 0)
    setTitle('')
    setMessage('')
    setSender('')
    setShareUrl('')
    setFeedback('')
    setError('')
  }

  let content
  if (!code) {
    content = (
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
            <button className="primary-button" type="button" onClick={startNewPage}>
              Write a page <ArrowIcon />
            </button>
            <a className="secondary-link" href={`/${SAMPLE_CODE}`} onClick={openSample}>
              Read a sample page
            </a>
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
            <span className="contents-text"><strong>Share</strong> the link to your page.</span>
          </li>
          <li>
            <span className="contents-numeral">III.</span>
            <span className="contents-text"><strong>They read</strong> it like a page from a book.</span>
          </li>
        </ol>
      </section>
    )
  } else if (note) {
    content = (
      <section className="reader">
        {code === SAMPLE_CODE && <p className="sample-badge">A sample page — this is what your reader will see</p>}
        <BookPage code={code} heading="A page for you">
          {note.title ? (
            <h1 className="page-title">{note.title}</h1>
          ) : (
            <h1 className="visually-hidden">A page for you</h1>
          )}
          <div className="fleuron" aria-hidden="true">❦</div>
          <div className="page-text">
            {toParagraphs(note.message).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <p className="page-signature">— {note.sender || 'someone who thought of you'}</p>
        </BookPage>
        <button className="text-button" type="button" onClick={startNewPage}>
          Write a page of your own <ArrowIcon />
        </button>
      </section>
    )
  } else if (note === null) {
    content = (
      <section className="reader">
        <BookPage code={code} heading="A torn page">
          <h1 className="page-title">This page couldn’t be read.</h1>
          <div className="fleuron" aria-hidden="true">❦</div>
          <div className="page-text">
            <p>The link may have been cut short while it was being copied. Ask the sender to share the full link again.</p>
          </div>
        </BookPage>
        <button className="text-button" type="button" onClick={startNewPage}>
          Write a new page <ArrowIcon />
        </button>
      </section>
    )
  } else {
    content = (
      <form className="composer" onSubmit={createLink}>
        <BookPage code={code} heading="A page for someone">
          <label className="visually-hidden" htmlFor="page-title">Title (optional)</label>
          <input
            id="page-title"
            className="page-title page-title-input"
            type="text"
            placeholder="A title, if you like"
            maxLength={MAX_TITLE_LENGTH}
            value={title}
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
            onChange={editDraft(setMessage)}
          />
          <div className="page-signature signature-field">
            <span aria-hidden="true">—</span>
            <label className="visually-hidden" htmlFor="page-sender">Your name (optional)</label>
            <input
              id="page-sender"
              type="text"
              placeholder="your name (optional)"
              maxLength={MAX_SENDER_LENGTH}
              value={sender}
              onChange={editDraft(setSender)}
            />
          </div>
        </BookPage>

        <div className="page-actions">
          <p className="page-hint">
            Each line break starts a new paragraph · {message.length} / {MAX_MESSAGE_LENGTH}
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit">
            Share this page <ArrowIcon />
          </button>
          <p className="privacy-note">Your words travel inside the link — anyone who has it can read this page.</p>
          <a className="preview-link sample-link" href={`/${SAMPLE_CODE}`} onClick={openSample}>
            See a sample page <ArrowIcon />
          </a>

          {shareUrl && (
            <div className="share-result" aria-live="polite">
              <p className="share-result-title">Your page is ready to send.</p>
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
                  Preview as reader <ArrowIcon />
                </a>
              </div>
            </div>
          )}
        </div>
      </form>
    )
  }

  return (
    <main className="desk">
      <header className="masthead">
        <a className="brand" href="/" onClick={goHome} title="Back to the cover">
          thought<em>drop</em>
        </a>
        {code && (
          <span className="masthead-code">
            Page <span>{code}</span>
          </span>
        )}
      </header>
      {content}
      <footer className="desk-footer">Made for the words you almost didn’t send.</footer>
    </main>
  )
}

export default App
