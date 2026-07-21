import { useEffect, useMemo, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import type { CredentialResponse } from '@react-oauth/google'
import { postSocialLogin, type AuthResponse } from './api'
import resourceAppLogo from './assets/resourceapp-logo.svg'
import claraMartinPhoto from './assets/home/testimonials/clara-martin.webp'
import diegoHerreraPhoto from './assets/home/testimonials/diego-herrera.webp'
import saraPonsPhoto from './assets/home/testimonials/sara-pons.webp'
import './App.css'

const SESSION_STORAGE_KEY = 'resources-auth-session'
const THEME_STORAGE_KEY = 'resources-app-theme'
type ThemeMode = 'dark' | 'light'
type WindowWithGoogle = Window & typeof globalThis & { google?: unknown }
type HomeSectionId = 'features' | 'clients' | 'testimonials'

type ClientLogoPalette = {
  from: string
  to: string
  accent: string
}

const buildClientLogoDataUri = (name: string, initials: string, palette: ClientLogoPalette): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="140" viewBox="0 0 300 140">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${palette.from}" />
<stop offset="100%" stop-color="${palette.to}" />
</linearGradient>
</defs>
<rect width="300" height="140" rx="26" fill="#12141f"/>
<rect x="9" y="9" width="282" height="122" rx="22" fill="url(#g)" opacity="0.92"/>
<circle cx="62" cy="70" r="28" fill="${palette.accent}" opacity="0.92"/>
<text x="62" y="77" font-size="24" font-family="Arial, sans-serif" fill="#ffffff" text-anchor="middle" font-weight="700">${initials}</text>
<text x="110" y="72" font-size="22" font-family="Arial, sans-serif" fill="#ffffff" font-weight="700">${name}</text>
</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
const FEATURE_SLIDES = [
  {
    id: 'feature-resource-governance',
    title: 'Gobernanza de resources en un solo lugar',
    description:
      'Centraliza copy, ownership y cambios de UI para que diseño, producto y desarrollo trabajen con una única fuente de verdad.',
    label: 'BROWSER WORKSPACE',
  },
  {
    id: 'feature-handoff-ready',
    title: 'Handoff inmediato para el equipo técnico',
    description:
      'Entrega estructuras listas para usar con versionado claro por página y recurso, reduciendo fricción entre propuesta y ejecución.',
    label: 'PRODUCT HANDOFF',
  },
  {
    id: 'feature-collaboration',
    title: 'Colaboración entre equipos sin cuellos de botella',
    description:
      'Comparte proyectos y define contexto de trabajo para que cada actor participe en el flujo correcto sin perder trazabilidad.',
    label: 'TEAM COLLABORATION',
  },
  {
    id: 'feature-localization',
    title: 'Localización preparada para escalar',
    description:
      'Gestiona idiomas y variantes desde el inicio para evitar retrabajo cuando el producto crece o entra a nuevos mercados.',
    label: 'GLOBAL CONTENT',
  },
] as const

const CLIENTS = [
  {
    id: 'nexa-grid',
    name: 'NexaGrid',
    logoUrl: buildClientLogoDataUri('NexaGrid', 'NG', { from: '#31f7d4', to: '#674dff', accent: '#00ffd5' }),
  },
  {
    id: 'quanta-loop',
    name: 'QuantaLoop',
    logoUrl: buildClientLogoDataUri('QuantaLoop', 'QL', { from: '#4ee9ff', to: '#6e46ff', accent: '#baffff' }),
  },
  {
    id: 'nova-fleet',
    name: 'NovaFleet',
    logoUrl: buildClientLogoDataUri('NovaFleet', 'NF', { from: '#ff5ea8', to: '#6f6cff', accent: '#ffd1e9' }),
  },
  {
    id: 'sparkline',
    name: 'Sparkline',
    logoUrl: buildClientLogoDataUri('Sparkline', 'SP', { from: '#33d5ff', to: '#1d53ff', accent: '#d5f4ff' }),
  },
  {
    id: 'fluxbase',
    name: 'FluxBase',
    logoUrl: buildClientLogoDataUri('FluxBase', 'FB', { from: '#2af598', to: '#009efd', accent: '#d9fff3' }),
  },
  {
    id: 'zenbyte',
    name: 'ZenByte',
    logoUrl: buildClientLogoDataUri('ZenByte', 'ZB', { from: '#ff8a00', to: '#e52e71', accent: '#ffe3bd' }),
  },
  {
    id: 'orbitly',
    name: 'Orbitly',
    logoUrl: buildClientLogoDataUri('Orbitly', 'OR', { from: '#5d9fff', to: '#9b5cff', accent: '#dde6ff' }),
  },
  {
    id: 'bytepeak',
    name: 'BytePeak',
    logoUrl: buildClientLogoDataUri('BytePeak', 'BP', { from: '#20c997', to: '#5a5cff', accent: '#d7fff1' }),
  },
  {
    id: 'lumeno',
    name: 'Lumeno',
    logoUrl: buildClientLogoDataUri('Lumeno', 'LU', { from: '#7d63ff', to: '#10c2ff', accent: '#ece7ff' }),
  },
  {
    id: 'synapse-lab',
    name: 'Synapse',
    logoUrl: buildClientLogoDataUri('Synapse', 'SY', { from: '#12c2e9', to: '#c471ed', accent: '#d4fbff' }),
  },
] as const

const TESTIMONIALS = [
  {
    id: 'comment-1',
    quote:
      '“Pasamos de revisar capturas sueltas a gestionar resources con contexto completo. El tiempo de handoff cayó casi a la mitad.”',
    author: 'Clara Martín',
    role: 'Head of Product · NexaPay',
    photoUrl: claraMartinPhoto,
  },
  {
    id: 'comment-2',
    quote:
      '“El carril de versiones y textos por idioma nos permitió alinear diseño y desarrollo sin retrabajo en cada release.”',
    author: 'Diego Herrera',
    role: 'Product Designer · Aurora Labs',
    photoUrl: diegoHerreraPhoto,
  },
  {
    id: 'comment-3',
    quote:
      '“La reutilización de recursos eliminó incoherencias en nuestros flujos y mejoró la percepción de calidad del producto.”',
    author: 'Sara Pons',
    role: 'UX Lead · PixelSky',
    photoUrl: saraPonsPhoto,
  },
] as const

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

const readStoredTheme = (): ThemeMode => {
  const rawTheme = localStorage.getItem(THEME_STORAGE_KEY)
  if (rawTheme === 'light' || rawTheme === 'dark') {
    return rawTheme
  }

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return 'dark'
}

const normalizePath = (pathname: string): '/login' | '/projects' | '/' => {
  if (pathname === '/login' || pathname === '/projects' || pathname === '/') {
    return pathname
  }

  return '/'
}

function App() {
  const [session, setSession] = useState<AuthResponse | null>(() => readStoredSession())
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme())
  const [pendingSection, setPendingSection] = useState<HomeSectionId | null>(null)
  const [currentPath, setCurrentPath] = useState<'/login' | '/projects' | '/'>(
    normalizePath(window.location.pathname),
  )
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const onPopState = () => setCurrentPath(normalizePath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
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
    if (currentPath === '/') {
      return 'home'
    }

    return 'login'
  }, [currentPath, session])

  const activeFeature = FEATURE_SLIDES[activeFeatureIndex]

  const showNextFeature = () => {
    setActiveFeatureIndex((currentIndex) => (currentIndex + 1) % FEATURE_SLIDES.length)
  }

  const showPreviousFeature = () => {
    setActiveFeatureIndex((currentIndex) => (currentIndex - 1 + FEATURE_SLIDES.length) % FEATURE_SLIDES.length)
  }

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

  const handleLocalGoogleLogin = () => {
    void handleGoogleSuccess({ credential: 'test-token:user-dev:dev@example.com' })
  }

  const handleLogout = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setSession(null)
    setError('')
    navigate('/login')
  }

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  const scrollToHomeSection = (sectionId: HomeSectionId) => {
    const section = document.getElementById(sectionId)
    section?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const navigateToHomeSection = (sectionId: HomeSectionId) => {
    if (currentPath === '/') {
      scrollToHomeSection(sectionId)
      return
    }

    window.history.pushState({}, '', '/')
    setCurrentPath('/')
    setPendingSection(sectionId)
  }

  useEffect(() => {
    if (currentPath !== '/' || !pendingSection) {
      return
    }

    scrollToHomeSection(pendingSection)
    setPendingSection(null)
  }, [currentPath, pendingSection])

  const hasGoogleWidget = typeof (window as WindowWithGoogle).google !== 'undefined'

  return (
    <main className="app-shell">
      <header className="top-nav neon-border">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            window.history.pushState({}, '', '/')
            setCurrentPath('/')
          }}
        >
          <img src={resourceAppLogo} alt="ResouceApp logo" width={210} height={45} />
        </a>
        <nav className="top-nav-links" aria-label="Navegación principal">
          <a href="/" onClick={(event) => {
            event.preventDefault()
            window.history.pushState({}, '', '/')
            setCurrentPath('/')
          }}
          >
            Home
          </a>
          <a
            href="/#features"
            onClick={(event) => {
              event.preventDefault()
              navigateToHomeSection('features')
            }}
          >
            Features
          </a>
          <a
            href="/#clients"
            onClick={(event) => {
              event.preventDefault()
              navigateToHomeSection('clients')
            }}
          >
            Clients
          </a>
          <a
            href="/#testimonials"
            onClick={(event) => {
              event.preventDefault()
              navigateToHomeSection('testimonials')
            }}
          >
            Reviews
          </a>
          <a
            href="/login"
            onClick={(event) => {
              event.preventDefault()
              navigate('/login')
            }}
          >
            Login
          </a>
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Cambiar modo de color">
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </nav>
      </header>

      {activeView === 'home' ? (
        <section className="home-layout">
          <section className="neon-grid" id="features">
            <article className="neon-card tall-card">
              <p className="card-label">{FEATURE_SLIDES[0].label}</p>
              <h1>Diseño y copy siempre sincronizados con producto.</h1>
              <p>{FEATURE_SLIDES[0].description}</p>
              <span className="card-footnote">get started →</span>
            </article>

            <article className="neon-card wide-card">
              <div className="card-top-line">
                <p className="card-label">{activeFeature.label}</p>
                <div className="carousel-controls">
                  <button type="button" onClick={showPreviousFeature} aria-label="Funcionalidad anterior">
                    ←
                  </button>
                  <span className="carousel-counter">
                    {activeFeatureIndex + 1} / {FEATURE_SLIDES.length}
                  </span>
                  <button type="button" onClick={showNextFeature} aria-label="Siguiente funcionalidad">
                    →
                  </button>
                </div>
              </div>
              <h2>{activeFeature.title}</h2>
              <p>{activeFeature.description}</p>
            </article>

            <article className="neon-card medium-card">
              <p className="card-label">{FEATURE_SLIDES[2].label}</p>
              <h3>{FEATURE_SLIDES[2].title}</h3>
              <p>{FEATURE_SLIDES[2].description}</p>
            </article>

            <article className="neon-card medium-card secondary">
              <p className="card-label">{FEATURE_SLIDES[3].label}</p>
              <h3>{FEATURE_SLIDES[3].title}</h3>
              <p>{FEATURE_SLIDES[3].description}</p>
            </article>
          </section>

          <section className="neon-card clients" aria-label="Clientes que confían en el producto" id="clients">
            <h2>Equipos que ya lo usan</h2>
            <ul className="client-grid">
              {CLIENTS.map((client) => (
                <li key={client.id}>
                  <article className="client-logo" aria-label={`Logo de ${client.name}`}>
                    <img src={client.logoUrl} alt={`Logo de ${client.name}`} width={128} height={64} loading="lazy" />
                  </article>
                </li>
              ))}
            </ul>
          </section>

          <section className="neon-card testimonials" aria-label="Comentarios de clientes" id="testimonials">
            <h2>Comentarios destacados</h2>
            <ul className="testimonial-grid">
              {TESTIMONIALS.map((testimonial) => (
                <li key={testimonial.id} className="testimonial-card">
                  <img
                    src={testimonial.photoUrl}
                    alt={`Foto de ${testimonial.author}`}
                    width={80}
                    height={80}
                    loading="lazy"
                  />
                  <blockquote>{testimonial.quote}</blockquote>
                  <p className="testimonial-author">{testimonial.author}</p>
                  <p className="testimonial-role">{testimonial.role}</p>
                </li>
              ))}
            </ul>
          </section>
        </section>
      ) : activeView === 'login' ? (
        <section className="panel-card neon-border">
          <h1>Iniciar sesión</h1>
          {hasGoogleWidget ? (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
            />
          ) : (
            <button type="button" onClick={handleLocalGoogleLogin}>
              Continuar con Google
            </button>
          )}
        </section>
      ) : (
        <section className="panel-card neon-border">
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
