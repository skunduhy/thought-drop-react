import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { PAGE_CODE_PATTERN } from './pages.js'
import { AdminView } from './pages/Admin.jsx'
import { ComposerPage } from './pages/Composer.jsx'
import { LandingPage } from './pages/Landing.jsx'
import { ReaderRoute } from './pages/Reader.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AdminRoute(props) {
  const { code } = useParams()
  if (code && !PAGE_CODE_PATTERN.test(code)) return <Navigate to="/admin" replace />
  return <AdminView code={code} {...props} />
}

export function Router({ user, authReady, onSignIn }) {
  const authProps = { user, authReady, onSignIn }

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="write" element={<ComposerPage {...authProps} />} />
        <Route path="admin" element={<AdminRoute {...authProps} />} />
        <Route path="admin/:code" element={<AdminRoute {...authProps} />} />
        <Route path=":code" element={<ReaderRoute user={user} authReady={authReady} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
