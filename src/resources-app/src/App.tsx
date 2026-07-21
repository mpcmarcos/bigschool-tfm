import { useEffect, useMemo, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import type { CredentialResponse } from '@react-oauth/google'
import { postSocialLogin, type AuthResponse } from './api'
import './App.css'

const SESSION_STORAGE_KEY = 'resources-auth-session'

const readStoredSession = (): AuthResponse | null => {
  const rawSession = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!rawSession) {
    return null
  }

  try {
    return JSON.parse(rawSession) as AuthResponse
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

const normalizePath = (pathname: string): '/login' | '/projects' | '/' => {
  if (pathname === '/login' || pathname === '/projects' || pathname === '/') {
    return pathname
  }

  return '/'
}

function App() {
  const [session, setSession] = useState<AuthResponse | null>(() => readStoredSession())
  const [currentPath, setCurrentPath] = useState<'/login' | '/projects' | '/'>(
    normalizePath(window.location.pathname),
  )
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const onPopState = () => setCurrentPath(normalizePath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (currentPath === '/') {
      const targetPath = session ? '/projects' : '/login'
      window.history.replaceState({}, '', targetPath)
      setCurrentPath(targetPath)
      return
    }

    if (currentPath === '/projects' && !session) {
      window.history.replaceState({}, '', '/login')
      setCurrentPath('/login')
      return
    }

    if (currentPath === '/login' && session) {
      window.history.replaceState({}, '', '/projects')
      setCurrentPath('/projects')
    }
  }, [currentPath, session])

  const navigate = (path: '/login' | '/projects') => {
    window.history.pushState({}, '', path)
    setCurrentPath(path)
  }

  const activeView = useMemo(() => {
    if (currentPath === '/projects' && session) {
      return 'projects'
    }

    return 'login'
  }, [currentPath, session])

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError('')
    if (!credentialResponse.credential) {
      setError('No se recibió credencial de Google')
      return
    }
    try {
      const authSession = await postSocialLogin('google', credentialResponse.credential)
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authSession))
      setSession(authSession)
      navigate('/projects')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleGoogleError = () => {
    setError('Error al iniciar sesión con Google')
  }

  const handleLogout = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setSession(null)
    setError('')
    navigate('/login')
  }

  return (
    <main className="container">
      {activeView === 'login' ? (
        <section className="card">
          <h1>Iniciar sesión</h1>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap
          />
        </section>
      ) : (
        <section className="card">
          <h1>Proyectos</h1>
          <p>Listado de proyectos (pendiente de implementación)</p>
          <p data-testid="user-email">{session?.user.email}</p>
          <button type="button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </section>
      )}

      {error && <p role="alert" className="error">{error}</p>}
    </main>
  )
}

export default App
