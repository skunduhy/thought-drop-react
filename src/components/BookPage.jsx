export function BookPage({ code, heading, className = '', children }) {
  return (
    <article className={`book-page ${className}`.trim()}>
      <p className="running-head">
        <span>Thought Drop</span>
        <span>{heading}</span>
      </p>
      {children}
      {code && <p className="folio">— {code} —</p>}
    </article>
  )
}
