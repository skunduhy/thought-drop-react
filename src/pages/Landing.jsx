import { useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowIcon } from '../components/Icons.jsx'
import { SAMPLE_CODE } from '../pages.js'

export function LandingPage() {
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
