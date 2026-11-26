export function BookPage({ code, heading, className = '', children }) {
  return (
    <article className={`book-page ${className}`.trim()}>
      {heading ? (
        <p className="running-head">
          <span>Thought Drop</span>
          <span>{heading}</span>
        </p>
      ) : (
        <div className="page-flourish" aria-hidden="true" />
      )}
      {children}
      {code && <p className="folio">— {code} —</p>}
    </article>
  )
}
