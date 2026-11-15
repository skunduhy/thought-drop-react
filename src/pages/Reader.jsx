import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { BookPage, WriteLink } from '../components/BookPage.jsx'
import { fetchPage, PAGE_CODE_PATTERN, SAMPLE_CODE } from '../pages.js'
import { startVisitTracking } from '../tracking.js'
import { isFirebaseConfigured } from '../firebase.js'
import { SETUP_MESSAGE } from '../constants.js'

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

function toParagraphs(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
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
          {page.greeting?.trim() && <p>{page.greeting.trim()}</p>}
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

function Reader({ code, user, authReady }) {
  const isSample = code === SAMPLE_CODE
  const [result, setResult] = useState({ code: null, status: 'loading', page: null })

  useEffect(() => {
    if (isSample || !isFirebaseConfigured) return undefined

    let cancelled = false
    fetchPage(code)
      .then((page) => {
        if (!cancelled) setResult({ code, status: page?.published ? 'ready' : 'missing', page })
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
        <p>{isFirebaseConfigured
          ? 'Something went wrong while fetching it. Check your connection and refresh the page.'
          : SETUP_MESSAGE}</p>
      </NoticePage>
    )
  }

  return <ReadingPage code={code} page={result.page} />
}

export function ReaderRoute({ user, authReady }) {
  const { code } = useParams()
  if (!PAGE_CODE_PATTERN.test(code)) return <Navigate to="/" replace />
  return <Reader key={code} code={code} user={user} authReady={authReady} />
}
