import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { auth, isFirebaseConfigured } from '../firebase.js'
import {
  MAX_GREETING_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_SENDER_LENGTH,
  MAX_TITLE_LENGTH,
  publishPage,
} from '../pages.js'
import { BookPage } from '../components/BookPage.jsx'
import { ArrowIcon, CopyIcon, GoogleIcon } from '../components/Icons.jsx'
import { SETUP_MESSAGE } from '../constants.js'

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

export function ComposerPage({ user, authReady, onSignIn }) {
  const [title, setTitle] = useState('')
  const [greeting, setGreeting] = useState('')
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
        { title: title.trim(), greeting: greeting.trim(), message: cleanMessage, sender: cleanSender },
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
    setGreeting('')
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
        <div className="greeting-field">
          <label htmlFor="page-greeting">Opening greeting <span>(optional)</span></label>
          <input
            id="page-greeting"
            className="page-greeting-input"
            type="text"
            placeholder="Hello there,"
            maxLength={MAX_GREETING_LENGTH}
            value={greeting}
            readOnly={isPublished}
            onChange={editDraft(setGreeting)}
          />
        </div>
        <label className="visually-hidden" htmlFor="page-message">Your message</label>
        <textarea
          id="page-message"
          ref={messageRef}
          className="page-text page-textarea"
          placeholder="Begin wherever feels right. Press Enter to start a new paragraph…"
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
