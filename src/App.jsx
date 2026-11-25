import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from './firebase.js'
import { Router } from './Router.jsx'
import './App.css'

function Masthead({ user, authReady, onSignIn }) {
  const showAccount = isFirebaseConfigured && authReady

  return (
    <header className="masthead">
      <Link className="brand" to="/" title="Back to the cover">
        thought<em>drop</em>
      </Link>
      {showAccount &&
        (user ? (
          <div className="account">
            <Link className="account-link" to="/admin">
              Activity
            </Link>
            {user.photoURL && <img className="account-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
            <span className="account-name">{user.displayName || user.email}</span>
            <button className="account-button" type="button" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        ) : (
          <button className="account-button" type="button" onClick={() => onSignIn().catch(() => {})}>
            Sign in
          </button>
        ))}
    </header>
  )
}

function App() {
  const { pathname } = useLocation()
  const readerCode = pathname.match(/^\/([A-Z0-9]{7})\/?$/)?.[1]
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured)

  useEffect(() => {
    if (!auth) return undefined
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthReady(true)
    })
  }, [])

  async function signIn() {
    const credential = await signInWithPopup(auth, googleProvider)
    return credential.user
  }

  const authProps = { user, authReady, onSignIn: signIn }

  const showChrome = /^\/(write|admin)(\/|$)/.test(pathname)

  return (
    <main className={readerCode ? 'desk reader-desk' : 'desk'}>
      {showChrome && <Masthead {...authProps} />}
      <Router {...authProps} />
      {showChrome && <footer className="desk-footer">Made for the words you almost didn’t send.</footer>}
    </main>
  )
}

export default App
