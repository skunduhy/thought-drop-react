import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { messageBlocks, paginateBlocks, PAGE_CHANGE_EVENT } from '../pagination.js'

function ContentBlock({ block }) {
  if (block.type === 'title') return <h1 className="page-title">{block.text}</h1>
  if (block.type === 'ornament') return <div className="fleuron" aria-hidden="true">{block.text}</div>
  const className = block.type === 'greeting' ? 'page-greeting'
    : block.type === 'signature' ? 'page-signature'
    : block.opening ? 'page-opening' : block.continued ? 'page-continuation' : 'page-paragraph'
  return <p className={className}>{block.text}</p>
}

function Sheet({ index, total, measuring, contentRef, children }) {
  return (
    <article
      className={`book-page reader-sheet${measuring ? ' measuring-sheet' : ''}`}
      aria-hidden={measuring || undefined}
      data-page-index={measuring ? undefined : index}
    >
      <p className="running-head"><span>Thought Drop</span><span>A thought for you</span></p>
      <div className="book-content page-text" ref={contentRef}>{children}</div>
      <p className="folio">Page {index + 1} / {total}</p>
    </article>
  )
}

export function PaginatedBook({ code, page }) {
  const measureRef = useRef(null)
  const listRef = useRef(null)
  const [pages, setPages] = useState([])
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')
  const activeIndex = Math.min(index, Math.max(0, pages.length - 1))

  useLayoutEffect(() => {
    const container = measureRef.current
    let disposed = false
    const blocks = [
      ...(page.title ? [{ type: 'title', text: page.title }] : []),
      { type: 'ornament', text: '❦' },
      ...(page.greeting?.trim() ? [{ type: 'greeting', text: page.greeting.trim() }] : []),
      ...messageBlocks(page.message),
      { type: 'signature', text: `— ${page.sender || 'someone who thought of you'}` },
    ]
    function measure() {
      if (disposed) return
      try {
        setPages(paginateBlocks(blocks, container))
        setError('')
      } catch (paginationError) {
        console.error('Could not paginate the reader page.', paginationError)
        setError('The page layout couldn’t be prepared. Try refreshing or making the browser window larger.')
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    document.fonts.ready.then(measure)
    document.fonts.addEventListener('loadingdone', measure)
    return () => {
      disposed = true
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', measure)
    }
  }, [page])

  // Track which page is mostly in view so reading analytics keep per-page events.
  useEffect(() => {
    const list = listRef.current
    if (!list || !pages.length) return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
      if (!visible.length) return
      const best = visible.reduce((a, b) => (b.intersectionRatio > a.intersectionRatio ? b : a))
      setIndex(Number(best.target.dataset.pageIndex))
    }, { threshold: [0.25, 0.5, 0.75, 1] })
    list.querySelectorAll('[data-page-index]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [pages])

  useEffect(() => {
    const reader = listRef.current?.closest('.reader')
    if (!reader) return
    reader.dataset.pageCount = String(pages.length)
    reader.dataset.pageIndex = String(activeIndex)
    window.dispatchEvent(new CustomEvent(PAGE_CHANGE_EVENT, { detail: { code } }))
  }, [code, pages, activeIndex])

  return (
    <>
      {!page.title && <h1 className="visually-hidden">A page for you</h1>}
      <Sheet index={0} total={1} measuring contentRef={measureRef} />
      {error ? <p className="form-error" role="alert">{error}</p> : (
        <div className="reader-pages" ref={listRef}>
          {pages.map((blocks, pageIndex) => (
            <Sheet key={pageIndex} index={pageIndex} total={pages.length}>
              {blocks.map((block, blockIndex) => <ContentBlock key={blockIndex} block={block} />)}
            </Sheet>
          ))}
        </div>
      )}
    </>
  )
}
