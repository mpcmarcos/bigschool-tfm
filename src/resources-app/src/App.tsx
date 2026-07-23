import { useEffect, useMemo, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import type { CredentialResponse } from '@react-oauth/google'
import {
  deleteProject,
  getPageVersions,
  getPages,
  getProjectMembers,
  getProjects,
  getResourcePages,
  getResources,
  getResourceVersions,
  postLogout,
  postPage,
  postProject,
  postProjectMember,
  postResource,
  postResourcePage,
  postResourceVersion,
  postSocialLogin,
  putProject,
  setDefaultPageVersion,
  setDefaultResourceVersion,
  type AuthResponse,
  type PageResponse,
  type PageVersionResponse,
  type ProjectMemberResponse,
  type ProjectResponse,
  type ResourcePageResponse,
  type ResourceResponse,
  type ResourceVersionResponse,
} from './api'
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
type RouteInfo = {
  view: 'home' | 'login' | 'projects'
  projectId: string | null
  pageId: string | null
  pageVersionId: string | null
  resourceId: string | null
  resourcePageId: string | null
}

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

const normalizePath = (pathname: string): string => {
  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/projects')) {
    return pathname
  }

  return '/'
}

const resolveRoute = (path: string): RouteInfo => {
  if (path === '/login') {
    return { view: 'login', projectId: null, pageId: null, pageVersionId: null, resourceId: null, resourcePageId: null }
  }

  if (path === '/') {
    return { view: 'home', projectId: null, pageId: null, pageVersionId: null, resourceId: null, resourcePageId: null }
  }

  const pathSegments = path.split('/').filter(Boolean)
  return {
    view: 'projects',
    projectId: pathSegments.length > 1 ? pathSegments[1] : null,
    pageId: pathSegments.length > 2 ? pathSegments[2] : null,
    pageVersionId: pathSegments.length > 3 ? pathSegments[3] : null,
    resourceId: pathSegments.length > 4 ? pathSegments[4] : null,
    resourcePageId: pathSegments.length > 5 ? pathSegments[5] : null,
  }
}

function App() {
  const [session, setSession] = useState<AuthResponse | null>(() => readStoredSession())
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme())
  const [pendingSection, setPendingSection] = useState<HomeSectionId | null>(null)
  const [currentPath, setCurrentPath] = useState(normalizePath(window.location.pathname))
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0)
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<ProjectResponse[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')
  const [editingProjectDescription, setEditingProjectDescription] = useState('')
  const [sharingProjectId, setSharingProjectId] = useState<string | null>(null)
  const [projectMembers, setProjectMembers] = useState<ProjectMemberResponse[]>([])
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState('viewer')
  const [membersLoading, setMembersLoading] = useState(false)
  const [deleteConfirmationProjectId, setDeleteConfirmationProjectId] = useState<string | null>(null)
  const [pages, setPages] = useState<PageResponse[]>([])
  const [pagesLoading, setPagesLoading] = useState(false)
  const [isCreatePageModalOpen, setIsCreatePageModalOpen] = useState(false)
  const [newPageName, setNewPageName] = useState('')
  const [newPageDescription, setNewPageDescription] = useState('')
  const [pageVersions, setPageVersions] = useState<PageVersionResponse[]>([])
  const [pageVersionsLoading, setPageVersionsLoading] = useState(false)
  const [resources, setResources] = useState<ResourceResponse[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [isCreateResourceModalOpen, setIsCreateResourceModalOpen] = useState(false)
  const [newResourceKey, setNewResourceKey] = useState('')
  const [newResourceDescription, setNewResourceDescription] = useState('')
  const [resourceVersions, setResourceVersions] = useState<ResourceVersionResponse[]>([])
  const [resourceVersionsLoading, setResourceVersionsLoading] = useState(false)
  const [isCreateResourceVersionModalOpen, setIsCreateResourceVersionModalOpen] = useState(false)
  const [newResourceVersionName, setNewResourceVersionName] = useState('')
  const [newResourceVersionValue, setNewResourceVersionValue] = useState('')
  const [resourcePages, setResourcePages] = useState<ResourcePageResponse[]>([])
  const [resourcePagesLoading, setResourcePagesLoading] = useState(false)
  const [isCreateResourcePageModalOpen, setIsCreateResourcePageModalOpen] = useState(false)
  const [newResourcePageResourceVersionId, setNewResourcePageResourceVersionId] = useState('')
  const route = useMemo(() => resolveRoute(currentPath), [currentPath])

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
    if (route.view === 'projects' && !session) {
      window.history.replaceState({}, '', '/login')
      setCurrentPath('/login')
      return
    }

    if (route.view === 'login' && session) {
      window.history.replaceState({}, '', '/projects')
      setCurrentPath('/projects')
    }
  }, [route.view, session])

  useEffect(() => {
    if (route.view !== 'projects' || !session || route.projectId) {
      return
    }

    const loadProjects = async () => {
      setProjectsLoading(true)
      setError('')
      try {
        const fetchedProjects = await getProjects(session.accessToken)
        setProjects(fetchedProjects.filter((project) => !project.isDeleted))
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unknown error')
      } finally {
        setProjectsLoading(false)
      }
    }

    void loadProjects()
  }, [route.view, route.projectId, session])

  const navigate = (path: string) => {
    window.history.pushState({}, '', path)
    setCurrentPath(normalizePath(path))
  }

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

  const handleLogout = async () => {
    if (!session) {
      return
    }

    setError('')
    try {
      await postLogout(session.refreshToken)
      localStorage.removeItem(SESSION_STORAGE_KEY)
      setSession(null)
      setProjects([])
      setPages([])
      setPageVersions([])
      setResources([])
      setResourceVersions([])
      setResourcePages([])
      navigate('/login')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
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

  const handleCreateProject = async () => {
    if (!session) {
      return
    }

    if (!newProjectName.trim()) {
      setError('El nombre del proyecto es obligatorio.')
      return
    }

    try {
      const createdProject = await postProject(session.accessToken, {
        name: newProjectName,
        description: newProjectDescription,
      })
      setProjects((currentProjects) => [createdProject, ...currentProjects])
      setNewProjectName('')
      setNewProjectDescription('')
      setIsCreateProjectModalOpen(false)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const openEditProject = (project: ProjectResponse) => {
    setEditingProjectId(project.id)
    setEditingProjectName(project.name)
    setEditingProjectDescription(project.description ?? '')
  }

  const cancelEditProject = () => {
    setEditingProjectId(null)
    setEditingProjectName('')
    setEditingProjectDescription('')
  }

  const openCreateProjectModal = () => {
    setError('')
    setIsCreateProjectModalOpen(true)
  }

  const closeCreateProjectModal = () => {
    setIsCreateProjectModalOpen(false)
    setNewProjectName('')
    setNewProjectDescription('')
  }

  const handleSaveProject = async (projectId: string) => {
    if (!session) {
      return
    }

    try {
      const updatedProject = await putProject(session.accessToken, projectId, {
        name: editingProjectName,
        description: editingProjectDescription,
      })
      setProjects((currentProjects) => currentProjects.map((project) => (project.id === projectId ? updatedProject : project)))
      cancelEditProject()
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!session) {
      return
    }

    try {
      await deleteProject(session.accessToken, projectId)
      setProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId))
      if (sharingProjectId === projectId) {
        setSharingProjectId(null)
        setProjectMembers([])
      }
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const closeShareModal = () => {
    setSharingProjectId(null)
    setProjectMembers([])
    setShareEmail('')
    setShareRole('viewer')
  }

  const selectedProjectForDelete = deleteConfirmationProjectId
    ? projects.find((project) => project.id === deleteConfirmationProjectId) ?? null
    : null

  const openSharePanel = async (projectId: string) => {
    if (!session) {
      return
    }

    setSharingProjectId(projectId)
    setMembersLoading(true)
    setError('')
    try {
      const members = await getProjectMembers(session.accessToken, projectId)
      setProjectMembers(members.filter((member) => !member.isDeleted))
    } catch (requestError) {
      setProjectMembers([])
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    } finally {
      setMembersLoading(false)
    }
  }

  const handleShareProject = async (projectId: string) => {
    if (!session) {
      return
    }

    if (!shareEmail.trim()) {
      setError('Debes indicar un email para compartir el proyecto.')
      return
    }

    try {
      const member = await postProjectMember(session.accessToken, projectId, { email: shareEmail, role: shareRole })
      setProjectMembers((currentMembers) => {
        const remainingMembers = currentMembers.filter((currentMember) => currentMember.userId !== member.userId)
        return [...remainingMembers, member]
      })
      setShareEmail('')
      setShareRole('viewer')
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  useEffect(() => {
    if (route.view !== 'projects' || !session || !route.projectId) {
      return
    }
    const projectId = route.projectId
    const pageId = route.pageId
    const pageVersionId = route.pageVersionId
    const resourceId = route.resourceId

    const loadHierarchy = async () => {
      setError('')
      try {
        if (!pageId) {
          setPagesLoading(true)
          const fetchedPages = await getPages(session.accessToken, projectId)
          setPages(fetchedPages.filter((page) => !page.isDeleted))
          setPageVersions([])
          setResourcePages([])
          setResources([])
          setResourceVersions([])
          return
        }

        if (!pageVersionId) {
          setPageVersionsLoading(true)
          const fetchedVersions = await getPageVersions(session.accessToken, projectId, pageId)
          setPageVersions(fetchedVersions.filter((version) => !version.isDeleted))
          setResourcePages([])
          setResources([])
          setResourceVersions([])
          return
        }

        if (!resourceId) {
          setResourcePagesLoading(true)
          setResourcesLoading(true)
          const [fetchedResourcePages, fetchedResources] = await Promise.all([
            getResourcePages(session.accessToken, projectId, pageId, pageVersionId),
            getResources(session.accessToken, projectId),
          ])
          setResourcePages(fetchedResourcePages.filter((resourcePage) => !resourcePage.isDeleted))
          setResources(fetchedResources.filter((resource) => !resource.isDeleted))
          setResourceVersions([])
          return
        }

        if (!route.resourcePageId) {
          setResourceVersionsLoading(true)
          const fetchedResourceVersions = await getResourceVersions(session.accessToken, projectId, resourceId)
          setResourceVersions(fetchedResourceVersions.filter((version) => !version.isDeleted))
          return
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unknown error')
      } finally {
        setPagesLoading(false)
        setPageVersionsLoading(false)
        setResourcePagesLoading(false)
        setResourcesLoading(false)
        setResourceVersionsLoading(false)
      }
    }

    void loadHierarchy()
  }, [route, session])

  const handleCreatePage = async () => {
    if (!session || !route.projectId) {
      return
    }

    if (!newPageName.trim()) {
      setError('El nombre de la página es obligatorio.')
      return
    }

    try {
      const createdPage = await postPage(session.accessToken, route.projectId, {
        name: newPageName,
        description: newPageDescription,
      })
      setPages((currentPages) => [createdPage, ...currentPages])
      setNewPageName('')
      setNewPageDescription('')
      setIsCreatePageModalOpen(false)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleSetDefaultPageVersion = async (pageVersionId: string) => {
    if (!session || !route.projectId || !route.pageId) {
      return
    }

    try {
      const updatedVersion = await setDefaultPageVersion(session.accessToken, route.projectId, route.pageId, pageVersionId)
      setPageVersions((currentVersions) =>
        currentVersions.map((version) =>
          version.id === updatedVersion.id ? updatedVersion : { ...version, isDefault: false },
        ),
      )
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleCreateResource = async () => {
    if (!session || !route.projectId) {
      return
    }

    if (!newResourceKey.trim()) {
      setError('La key del recurso es obligatoria.')
      return
    }

    try {
      const createdResource = await postResource(session.accessToken, route.projectId, {
        key: newResourceKey,
        description: newResourceDescription,
      })
      setResources((currentResources) => [createdResource, ...currentResources])
      setNewResourceKey('')
      setNewResourceDescription('')
      setIsCreateResourceModalOpen(false)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleCreateResourceVersion = async () => {
    if (!session || !route.projectId || !route.resourceId) {
      return
    }

    if (!newResourceVersionName.trim() || !newResourceVersionValue.trim()) {
      setError('Nombre y valor de versión son obligatorios.')
      return
    }

    try {
      const createdVersion = await postResourceVersion(session.accessToken, route.projectId, route.resourceId, {
        name: newResourceVersionName,
        value: newResourceVersionValue,
      })
      setResourceVersions((currentVersions) => [createdVersion, ...currentVersions])
      setNewResourceVersionName('')
      setNewResourceVersionValue('')
      setIsCreateResourceVersionModalOpen(false)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleSetDefaultResourceVersion = async (resourceVersionId: string) => {
    if (!session || !route.projectId || !route.resourceId) {
      return
    }

    try {
      const updatedVersion = await setDefaultResourceVersion(
        session.accessToken,
        route.projectId,
        route.resourceId,
        resourceVersionId,
      )
      setResourceVersions((currentVersions) =>
        currentVersions.map((version) =>
          version.id === updatedVersion.id ? updatedVersion : { ...version, isDefault: false },
        ),
      )
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleCreateResourcePage = async () => {
    if (!session || !route.projectId || !route.pageId || !route.pageVersionId) {
      return
    }

    if (!newResourcePageResourceVersionId.trim()) {
      setError('Debes seleccionar una versión de recurso.')
      return
    }

    try {
      const createdResourcePage = await postResourcePage(session.accessToken, route.projectId, route.pageId, route.pageVersionId, {
        resourceVersionId: newResourcePageResourceVersionId,
      })
      setResourcePages((currentPages) => [createdResourcePage, ...currentPages])
      setNewResourcePageResourceVersionId('')
      setIsCreateResourcePageModalOpen(false)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const hasGoogleWidget = typeof (window as WindowWithGoogle).google !== 'undefined'
  const isAuthenticated = Boolean(session)

  return (
    <main className="app-shell">
      <header className="top-nav neon-border">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            navigate('/')
          }}
        >
          <img src={resourceAppLogo} alt="ResouceApp logo" width={210} height={45} />
        </a>
        <nav className="top-nav-links" aria-label="Navegación principal">
          {isAuthenticated ? (
            <>
              <a
                href="/projects"
                onClick={(event) => {
                  event.preventDefault()
                  navigate('/projects')
                }}
              >
                Proyectos
              </a>
              <span className="top-user-email" data-testid="top-user-email">
                {session?.user.email}
              </span>
              <button type="button" onClick={() => void handleLogout()}>
                Logout
              </button>
            </>
          ) : (
            <>
              <a
                href="/"
                onClick={(event) => {
                  event.preventDefault()
                  navigate('/')
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
            </>
          )}
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Cambiar modo de color">
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </nav>
      </header>

      {route.view === 'home' ? (
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
                  <img src={testimonial.photoUrl} alt={`Foto de ${testimonial.author}`} width={80} height={80} loading="lazy" />
                  <blockquote>{testimonial.quote}</blockquote>
                  <p className="testimonial-author">{testimonial.author}</p>
                  <p className="testimonial-role">{testimonial.role}</p>
                </li>
              ))}
            </ul>
          </section>
        </section>
      ) : route.view === 'login' ? (
        <section className="panel-card neon-border">
          <h1>Iniciar sesión</h1>
          {hasGoogleWidget ? (
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} useOneTap />
          ) : (
            <button type="button" onClick={handleLocalGoogleLogin}>
              Continuar con Google
            </button>
          )}
        </section>
      ) : route.projectId ? (
        !route.pageId ? (
          <section className="panel-card neon-border projects-panel">
            <div className="projects-header">
              <h1>Páginas del proyecto</h1>
              <div className="project-subpanel-actions">
                <button type="button" onClick={() => setIsCreatePageModalOpen(true)}>
                  Crear página
                </button>
                <button type="button" onClick={() => navigate('/projects')}>
                  Volver a proyectos
                </button>
              </div>
            </div>
            {pagesLoading ? <p>Cargando páginas...</p> : null}
            <ul className="projects-list">
              {pages.map((page) => (
                <li key={page.id} className="project-card">
                  <h2>{page.name}</h2>
                  <p>{page.description ?? 'Sin descripción'}</p>
                  <div className="project-actions">
                    <button type="button" onClick={() => navigate(`/projects/${route.projectId}/${page.id}`)}>
                      Ver versiones
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : !route.pageVersionId ? (
          <section className="panel-card neon-border projects-panel">
            <div className="projects-header">
              <h1>Versiones de página</h1>
              <button type="button" onClick={() => navigate(`/projects/${route.projectId}`)}>
                Volver a páginas
              </button>
            </div>
            {pageVersionsLoading ? <p>Cargando versiones...</p> : null}
            <ul className="projects-list">
              {pageVersions.map((version) => (
                <li key={version.id} className="project-card">
                  <h2>
                    {version.name}
                    {version.isDefault ? ' · default' : ''}
                  </h2>
                  <div className="project-actions">
                    <button type="button" onClick={() => void handleSetDefaultPageVersion(version.id)}>
                      Marcar default
                    </button>
                    <button type="button" onClick={() => navigate(`/projects/${route.projectId}/${route.pageId}/${version.id}`)}>
                      Ver recursos
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : !route.resourceId ? (
          <section className="panel-card neon-border projects-panel">
            <div className="projects-header">
              <h1>Recursos en versión de página</h1>
              <div className="project-subpanel-actions">
                <button type="button" onClick={() => setIsCreateResourceModalOpen(true)}>
                  Crear recurso
                </button>
                <button type="button" onClick={() => setIsCreateResourcePageModalOpen(true)}>
                  Vincular recurso
                </button>
                <button type="button" onClick={() => navigate(`/projects/${route.projectId}/${route.pageId}`)}>
                  Volver a versiones
                </button>
              </div>
            </div>
            {(resourcePagesLoading || resourcesLoading) ? <p>Cargando recursos...</p> : null}
            <h2>Recursos del proyecto</h2>
            <ul className="projects-list">
              {resources.map((resource) => (
                <li key={resource.id} className="project-card">
                  <h3>{resource.key}</h3>
                  <p>{resource.description ?? 'Sin descripción'}</p>
                  <div className="project-actions">
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${route.projectId}/${route.pageId}/${route.pageVersionId}/${resource.id}`)}
                    >
                      Ver versiones recurso
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <h2>Vínculos de recurso en página</h2>
            <ul className="members-list">
              {resourcePages.map((resourcePage) => (
                <li key={resourcePage.id}>
                  {resourcePage.id} · version {resourcePage.resourceVersionId}
                </li>
              ))}
            </ul>
          </section>
        ) : !route.resourcePageId ? (
          <section className="panel-card neon-border projects-panel">
            <div className="projects-header">
              <h1>Versiones de recurso</h1>
              <div className="project-subpanel-actions">
                <button type="button" onClick={() => setIsCreateResourceVersionModalOpen(true)}>
                  Crear versión recurso
                </button>
                <button type="button" onClick={() => navigate(`/projects/${route.projectId}/${route.pageId}/${route.pageVersionId}`)}>
                  Volver a recursos
                </button>
              </div>
            </div>
            {resourceVersionsLoading ? <p>Cargando versiones de recurso...</p> : null}
            <ul className="projects-list">
              {resourceVersions.map((version) => (
                <li key={version.id} className="project-card">
                  <h2>
                    {version.name}
                    {version.isDefault ? ' · default' : ''}
                  </h2>
                  <p>{version.value}</p>
                  <div className="project-actions">
                    <button type="button" onClick={() => void handleSetDefaultResourceVersion(version.id)}>
                      Marcar default
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${route.projectId}/${route.pageId}/${route.pageVersionId}/${route.resourceId}/${version.id}`)}
                    >
                      Ver detalle en página
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="panel-card neon-border">
            <h1>Detalle recurso en página</h1>
            <p>Project: {route.projectId}</p>
            <p>Page: {route.pageId}</p>
            <p>PageVersion: {route.pageVersionId}</p>
            <p>Resource: {route.resourceId}</p>
            <p>ResourcePage: {route.resourcePageId}</p>
            <button type="button" onClick={() => navigate(`/projects/${route.projectId}/${route.pageId}/${route.pageVersionId}/${route.resourceId}`)}>
              Volver a versiones recurso
            </button>
          </section>
        )
      ) : (
        <section className="panel-card neon-border projects-panel">
          <div className="projects-header">
            <h1>Proyectos</h1>
            <button type="button" onClick={openCreateProjectModal}>
              Crear proyecto
            </button>
          </div>

          {projectsLoading ? <p>Cargando proyectos...</p> : null}

          <ul className="projects-list">
            {projects.map((project) => (
              <li key={project.id} className="project-card">
                <h2>{project.name}</h2>
                <p>{project.description ?? 'Sin descripción'}</p>
                <dl className="project-properties">
                  <div>
                    <dt>id</dt>
                    <dd>{project.id}</dd>
                  </div>
                  <div>
                    <dt>ownerUserId</dt>
                    <dd>{project.ownerUserId}</dd>
                  </div>
                  <div>
                    <dt>ownerEmail</dt>
                    <dd>{project.ownerEmail}</dd>
                  </div>
                  <div>
                    <dt>createdAt</dt>
                    <dd>{project.createdAt}</dd>
                  </div>
                  <div>
                    <dt>updatedAt</dt>
                    <dd>{project.updatedAt}</dd>
                  </div>
                  <div>
                    <dt>isDeleted</dt>
                    <dd>{String(project.isDeleted)}</dd>
                  </div>
                </dl>

                <div className="project-actions">
                  <button type="button" onClick={() => navigate(`/projects/${project.id}`)}>
                    Ver páginas
                  </button>
                  <button type="button" onClick={() => void openSharePanel(project.id)}>
                    Compartir
                  </button>
                  <button type="button" onClick={() => openEditProject(project)}>
                    Editar
                  </button>
                  <button type="button" onClick={() => setDeleteConfirmationProjectId(project.id)}>
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {isCreateProjectModalOpen ? (
            <section className="modal-backdrop" role="dialog" aria-label="Crear proyecto" aria-modal="true">
              <article className="modal-card">
                <h3>Crear proyecto</h3>
                <div className="project-subpanel">
                  <label htmlFor="new-project-name">Nombre</label>
                  <input
                    id="new-project-name"
                    aria-label="Nombre del proyecto nuevo"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                  />
                  <label htmlFor="new-project-description">Descripción</label>
                  <input
                    id="new-project-description"
                    aria-label="Descripción del proyecto nuevo"
                    value={newProjectDescription}
                    onChange={(event) => setNewProjectDescription(event.target.value)}
                  />
                </div>
                <div className="project-subpanel-actions">
                  <button type="button" onClick={() => void handleCreateProject()}>
                    Guardar proyecto
                  </button>
                  <button type="button" onClick={closeCreateProjectModal}>
                    Cancelar
                  </button>
                </div>
              </article>
            </section>
          ) : null}

          {editingProjectId ? (
            <section className="modal-backdrop" role="dialog" aria-label="Editar proyecto" aria-modal="true">
              <article className="modal-card">
                <h3>Editar proyecto</h3>
                <div className="project-subpanel">
                  <label htmlFor="edit-project-name">Nombre</label>
                  <input
                    id="edit-project-name"
                    aria-label="Nombre del proyecto"
                    value={editingProjectName}
                    onChange={(event) => setEditingProjectName(event.target.value)}
                  />
                  <label htmlFor="edit-project-description">Descripción</label>
                  <input
                    id="edit-project-description"
                    aria-label="Descripción del proyecto"
                    value={editingProjectDescription}
                    onChange={(event) => setEditingProjectDescription(event.target.value)}
                  />
                </div>
                <div className="project-subpanel-actions">
                  <button type="button" onClick={() => void handleSaveProject(editingProjectId)}>
                    Guardar cambios
                  </button>
                  <button type="button" onClick={cancelEditProject}>
                    Cancelar
                  </button>
                </div>
              </article>
            </section>
          ) : null}

          {sharingProjectId ? (
            <section className="modal-backdrop" role="dialog" aria-label="Compartir proyecto" aria-modal="true">
              <article className="modal-card">
                <h3>Compartir proyecto</h3>
                <section className="project-subpanel">
                  <h4>Miembros con acceso</h4>
                  {membersLoading ? <p>Cargando miembros...</p> : null}
                  <ul className="members-list">
                    {projectMembers.map((member) => (
                      <li key={member.id}>
                        {member.email} · {member.role}
                      </li>
                    ))}
                  </ul>
                  <label htmlFor="share-project-email">Nuevo email</label>
                  <input
                    id="share-project-email"
                    aria-label="Nuevo email para compartir"
                    value={shareEmail}
                    onChange={(event) => setShareEmail(event.target.value)}
                  />
                  <label htmlFor="share-project-role">Rol</label>
                  <select
                    id="share-project-role"
                    aria-label="Rol de acceso"
                    value={shareRole}
                    onChange={(event) => setShareRole(event.target.value)}
                  >
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                </section>
                <div className="project-subpanel-actions">
                  <button type="button" onClick={() => void handleShareProject(sharingProjectId)}>
                    Añadir acceso
                  </button>
                  <button type="button" onClick={closeShareModal}>
                    Cerrar
                  </button>
                </div>
              </article>
            </section>
          ) : null}

          {deleteConfirmationProjectId ? (
            <section className="modal-backdrop" role="dialog" aria-label="Confirmar borrado" aria-modal="true">
              <article className="modal-card">
                <h3>Confirmar borrado</h3>
                <p>
                  ¿Seguro que quieres borrar
                  {' '}
                  <strong>{selectedProjectForDelete?.name ?? 'este proyecto'}</strong>
                  ?
                </p>
                <div className="project-subpanel-actions">
                  <button
                    type="button"
                    onClick={() => {
                      const projectIdToDelete = deleteConfirmationProjectId
                      setDeleteConfirmationProjectId(null)
                      if (projectIdToDelete) {
                        void handleDeleteProject(projectIdToDelete)
                      }
                    }}
                  >
                    Confirmar borrado
                  </button>
                  <button type="button" onClick={() => setDeleteConfirmationProjectId(null)}>
                    Cancelar
                  </button>
                </div>
              </article>
            </section>
          ) : null}
        </section>
      )}

      {isCreatePageModalOpen ? (
        <section className="modal-backdrop" role="dialog" aria-label="Crear página" aria-modal="true">
          <article className="modal-card">
            <h3>Crear página</h3>
            <div className="project-subpanel">
              <label htmlFor="new-page-name">Nombre</label>
              <input
                id="new-page-name"
                aria-label="Nombre de la página nueva"
                value={newPageName}
                onChange={(event) => setNewPageName(event.target.value)}
              />
              <label htmlFor="new-page-description">Descripción</label>
              <input
                id="new-page-description"
                aria-label="Descripción de la página nueva"
                value={newPageDescription}
                onChange={(event) => setNewPageDescription(event.target.value)}
              />
            </div>
            <div className="project-subpanel-actions">
              <button type="button" onClick={() => void handleCreatePage()}>
                Guardar página
              </button>
              <button type="button" onClick={() => setIsCreatePageModalOpen(false)}>
                Cancelar
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {isCreateResourceModalOpen ? (
        <section className="modal-backdrop" role="dialog" aria-label="Crear recurso" aria-modal="true">
          <article className="modal-card">
            <h3>Crear recurso</h3>
            <div className="project-subpanel">
              <label htmlFor="new-resource-key">Key</label>
              <input
                id="new-resource-key"
                aria-label="Key del recurso nuevo"
                value={newResourceKey}
                onChange={(event) => setNewResourceKey(event.target.value)}
              />
              <label htmlFor="new-resource-description">Descripción</label>
              <input
                id="new-resource-description"
                aria-label="Descripción del recurso nuevo"
                value={newResourceDescription}
                onChange={(event) => setNewResourceDescription(event.target.value)}
              />
            </div>
            <div className="project-subpanel-actions">
              <button type="button" onClick={() => void handleCreateResource()}>
                Guardar recurso
              </button>
              <button type="button" onClick={() => setIsCreateResourceModalOpen(false)}>
                Cancelar
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {isCreateResourceVersionModalOpen ? (
        <section className="modal-backdrop" role="dialog" aria-label="Crear versión recurso" aria-modal="true">
          <article className="modal-card">
            <h3>Crear versión recurso</h3>
            <div className="project-subpanel">
              <label htmlFor="new-resource-version-name">Nombre</label>
              <input
                id="new-resource-version-name"
                aria-label="Nombre versión recurso"
                value={newResourceVersionName}
                onChange={(event) => setNewResourceVersionName(event.target.value)}
              />
              <label htmlFor="new-resource-version-value">Valor</label>
              <input
                id="new-resource-version-value"
                aria-label="Valor versión recurso"
                value={newResourceVersionValue}
                onChange={(event) => setNewResourceVersionValue(event.target.value)}
              />
            </div>
            <div className="project-subpanel-actions">
              <button type="button" onClick={() => void handleCreateResourceVersion()}>
                Guardar versión
              </button>
              <button type="button" onClick={() => setIsCreateResourceVersionModalOpen(false)}>
                Cancelar
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {isCreateResourcePageModalOpen ? (
        <section className="modal-backdrop" role="dialog" aria-label="Vincular recurso" aria-modal="true">
          <article className="modal-card">
            <h3>Vincular recurso a la versión de página</h3>
            <div className="project-subpanel">
              <label htmlFor="new-resource-page-resource-version-id">ResourceVersionId</label>
              <input
                id="new-resource-page-resource-version-id"
                aria-label="ResourceVersionId a vincular"
                value={newResourcePageResourceVersionId}
                onChange={(event) => setNewResourcePageResourceVersionId(event.target.value)}
              />
            </div>
            <div className="project-subpanel-actions">
              <button type="button" onClick={() => void handleCreateResourcePage()}>
                Guardar relación
              </button>
              <button type="button" onClick={() => setIsCreateResourcePageModalOpen(false)}>
                Cancelar
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {error && <p role="alert" className="error">{error}</p>}
    </main>
  )
}

export default App
