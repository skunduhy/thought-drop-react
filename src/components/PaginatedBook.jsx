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

function Sheet({ index, total, measuring, turning, contentRef, navigation, overlay, children }) {
  const decorative = measuring || turning
  return (
    <article className={`book-page reader-sheet${measuring ? ' measuring-sheet' : turning ? ' turning-sheet' : ' reader-opening'}`} aria-hidden={decorative || undefined}>
      <p className="running-head"><span>Thought Drop</span><span>A thought for you</span></p>
      <div className="book-content page-text" ref={contentRef}>{children}</div>
      <p className="folio" role={decorative ? undefined : 'status'} aria-live={decorative ? undefined : 'polite'}>
        Page {index + 1} / {total}
      </p>
      {navigation}
      {overlay}
    </article>
  )
}

export function PaginatedBook({ code, page }) {
  const measureRef = useRef(null)
  const visibleRef = useRef(null)
  const focusAfterTurn = useRef(false)
  const [pages, setPages] = useState([])
  const [index, setIndex] = useState(0)
  const [turn, setTurn] = useState(null)
  const [error, setError] = useState('')
  const activeIndex = Math.min(index, Math.max(0, pages.length - 1))
  const displayIndex = turn?.direction === 'next' ? turn.to : activeIndex
  const displayBlocks = turn ? turn.direction === 'next' ? turn.toBlocks : turn.fromBlocks : pages[activeIndex]

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
        const next = paginateBlocks(blocks, container)
        setPages(next)
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

  useEffect(() => {
    const reader = visibleRef.current?.closest('.reader')
    if (!reader) return
    reader.dataset.pageCount = String(pages.length)
    reader.dataset.pageIndex = String(activeIndex)
    window.dispatchEvent(new CustomEvent(PAGE_CHANGE_EVENT, { detail: { code } }))
  }, [code, pages, activeIndex])

  useLayoutEffect(() => {
    if (turn || !focusAfterTurn.current) return
    visibleRef.current?.focus({ preventScroll: true })
    focusAfterTurn.current = false
  }, [activeIndex, turn])

  useEffect(() => {
    if (!turn) return undefined
    // Finish even if reduced motion is enabled while the animation is running.
    const timer = window.setTimeout(() => {
      focusAfterTurn.current = true
      setIndex(Math.max(0, Math.min(turn.to, pages.length - 1)))
      setTurn(null)
    }, turn.total === pages.length ? 1000 : 0)
    return () => window.clearTimeout(timer)
  }, [turn, pages.length])

  function finishTurn() {
    if (!turn) return
    focusAfterTurn.current = true
    setIndex(Math.max(0, Math.min(turn.to, pages.length - 1)))
    setTurn(null)
  }

  function turnPage(next) {
    if (turn || next < 0 || next >= pages.length) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      focusAfterTurn.current = true
      setIndex(next)
      return
    }
    setTurn({
      from: activeIndex,
      to: next,
      direction: next > activeIndex ? 'next' : 'previous',
      fromBlocks: pages[activeIndex],
      toBlocks: pages[next],
      total: pages.length,
    })
  }

  return (
    <>
      {!page.title && <h1 className="visually-hidden">A page for you</h1>}
      <Sheet index={0} total={1} measuring contentRef={measureRef} />
      {error ? <p className="form-error" role="alert">{error}</p> : (
        <>
          <Sheet
            index={displayIndex}
            total={pages.length || 1}
            overlay={turn && (
              <div className="page-flip-stage" aria-hidden="true">
                <div
                  className={`page-flip-leaf page-flip-${turn.direction}`}
                  onAnimationEnd={(event) => {
                    if (event.target === event.currentTarget) finishTurn()
                  }}
                >
                  <div className="page-flip-front">
                    <Sheet index={turn.direction === 'next' ? turn.from : turn.to} total={turn.total} turning>
                      <div>
                        {(turn.direction === 'next' ? turn.fromBlocks : turn.toBlocks).map((block, blockIndex) => (
                          <ContentBlock key={blockIndex} block={block} />
                        ))}
                      </div>
                    </Sheet>
                  </div>
                  <div className="page-flip-back" />
                </div>
              </div>
            )}
            navigation={
              <nav className="page-navigation" aria-label="Book pages">
                <button type="button" className="page-turn-button" aria-label="Previous page" disabled={Boolean(turn) || activeIndex === 0} onClick={() => turnPage(activeIndex - 1)}>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m12 5-5 5 5 5" /></svg>
                </button>
                <button type="button" className="page-turn-button" aria-label="Next page" disabled={Boolean(turn) || activeIndex >= pages.length - 1} onClick={() => turnPage(activeIndex + 1)}>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m8 5 5 5-5 5" /></svg>
                </button>
              </nav>
            }
          >
            <div
              key={displayIndex}
              ref={visibleRef}
              tabIndex={-1}
              aria-label={`Page ${displayIndex + 1}`}
            >
              {(displayBlocks || []).map((block, blockIndex) => <ContentBlock key={blockIndex} block={block} />)}
            </div>
          </Sheet>
        </>
      )}
    </>
  )
}
