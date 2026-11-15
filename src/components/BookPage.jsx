import { Link } from 'react-router'
import { ArrowIcon } from './Icons.jsx'

export function BookPage({ code, heading, children }) {
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

export function WriteLink() {
  return (
    <Link className="text-button" to="/write">
      Write a page of your own <ArrowIcon />
    </Link>
  )
}
