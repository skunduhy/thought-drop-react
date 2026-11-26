const STATIONERY = [
  // Fountain pen
  <path key="pen" d="M5 19l1-4L16 5l3 3L9 18zM14 7l3 3M5 19l3-1" />,
  // Open book
  <path key="book" d="M3 5h6a3 3 0 013 3v12a2 2 0 00-2-2H3zM21 5h-6a3 3 0 00-3 3v12a2 2 0 012-2h7z" />,
  // Paperweight
  <path key="weight" d="M4 19h16M5.5 19a6.5 6.5 0 0113 0M10 14.5a2.5 2.5 0 014 0" />,
  // Sheet of paper
  <path key="paper" d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5" />,
  // Inkwell
  <path key="ink" d="M7 11h10l1.5 9h-13zM9.5 11V7.5h5V11M12 7.5V4" />,
]

export function ReaderLoader() {
  return (
    <section className="reader reader-loading" aria-busy="true">
      <p className="visually-hidden" role="status">Loading your page…</p>
      <div className="stationery-spinner" aria-hidden="true">
        {STATIONERY.map((icon, index) => (
          <span key={icon.key} style={{ '--angle': `${(360 / STATIONERY.length) * index}deg` }}>
            <svg viewBox="0 0 24 24">{icon}</svg>
          </span>
        ))}
      </div>
    </section>
  )
}
