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
