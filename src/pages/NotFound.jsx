import { useEffect } from 'react'

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page not found'
  }, [])

  return <h1 className="not-found">Page not found</h1>
}
