import { BookPage } from './BookPage.jsx'

export function ReaderLoader() {
  return (
    <section className="reader" aria-busy="true">
      <BookPage className="reader-sheet reader-loading">
        <div className="reader-loading-content">
          <div className="loader-book" aria-hidden="true">
            <span className="loader-book-left" />
            <span className="loader-book-right" />
            <span className="loader-book-leaf" />
          </div>
          <p className="loading-text" role="status">Turning to your page…</p>
          <div className="loader-dots" aria-hidden="true"><span /><span /><span /></div>
        </div>
      </BookPage>
    </section>
  )
}
