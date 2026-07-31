import { useEffect, useMemo, useRef, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import type { CredentialResponse } from '@react-oauth/google'
import {
  configureAuthRefresh,
  deletePage,
  deleteProject,
  getPageVersions,
  getPages,
  getProjectMembers,
  getProjects,
  getResources,
  getResourceVersions,
  postAutomaticTranslations,
  postLogout,
  postPage,
  postPageVersion,
  postProject,
  postProjectMember,
  postResource,
  postResourceVersion,
  postRefresh,
  postSocialLogin,
  putPage,
  putProject,
  setDefaultPageVersion,
  type AuthResponse,
  type PageResponse,
  type PageVersionResponse,
  type ProjectMemberResponse,
  type ProjectResponse,
  type ResourceResponse,
  type ResourceVersionResponse,
} from './api'
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from './languages'
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
    return { view: 'login', projectId: null, pageId: null, pageVersionId: null, resourceId: null }
  }

  if (path === '/') {
    return { view: 'home', projectId: null, pageId: null, pageVersionId: null, resourceId: null }
  }

  const pathSegments = path.split('/').filter(Boolean)
  return {
    view: 'projects',
    projectId: pathSegments.length > 1 ? pathSegments[1] : null,
    pageId: pathSegments.length > 2 ? pathSegments[2] : null,
    pageVersionId: pathSegments.length > 3 ? pathSegments[3] : null,
    resourceId: pathSegments.length > 4 ? pathSegments[4] : null,
  }
}

function App() {
  const [session, setSession] = useState<AuthResponse | null>(() => readStoredSession())
  const sessionRef = useRef(session)
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
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editingPageName, setEditingPageName] = useState('')
  const [editingPageDescription, setEditingPageDescription] = useState('')
  const [deleteConfirmationPageId, setDeleteConfirmationPageId] = useState<string | null>(null)
  const [pageVersions, setPageVersions] = useState<PageVersionResponse[]>([])
  const [pageVersionsLoading, setPageVersionsLoading] = useState(false)
  const [isCreatePageVersionModalOpen, setIsCreatePageVersionModalOpen] = useState(false)
  const [newPageVersionName, setNewPageVersionName] = useState('')
  const [resources, setResources] = useState<ResourceResponse[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [isCreateResourceModalOpen, setIsCreateResourceModalOpen] = useState(false)
  const [newResourceKey, setNewResourceKey] = useState('')
  const [newResourceDescription, setNewResourceDescription] = useState('')
  const [newResourceLanguage, setNewResourceLanguage] = useState<SupportedLanguageCode>('es-es')
  const [newResourceValue, setNewResourceValue] = useState('')
  const [resourceVersions, setResourceVersions] = useState<ResourceVersionResponse[]>([])
  const [resourceVersionsLoading, setResourceVersionsLoading] = useState(false)
  const [isCreateResourceVersionModalOpen, setIsCreateResourceVersionModalOpen] = useState(false)
  const [newResourceVersionLanguage, setNewResourceVersionLanguage] = useState<SupportedLanguageCode>('pt-br')
  const [newResourceVersionValue, setNewResourceVersionValue] = useState('')
  const [isAutomaticTranslationsModalOpen, setIsAutomaticTranslationsModalOpen] = useState(false)
  const [automaticTranslationSource, setAutomaticTranslationSource] = useState<SupportedLanguageCode>('es-es')
  const [automaticTranslationsSubmitting, setAutomaticTranslationsSubmitting] = useState(false)
  const [automaticTranslationsError, setAutomaticTranslationsError] = useState('')
  const automaticTranslationsRequestLockRef = useRef(false)
  const route = useMemo(() => resolveRoute(currentPath), [currentPath])
  const resourceRouteIdentity = `${route.projectId ?? ''}:${route.pageId ?? ''}:${route.pageVersionId ?? ''}:${route.resourceId ?? ''}`
  const resourceRouteIdentityRef = useRef(resourceRouteIdentity)
  const resourceVersionsRequestIdRef = useRef(0)
  const automaticTranslationsRequestIdRef = useRef(0)
  const availableLanguages = SUPPORTED_LANGUAGES.filter(
    (language) => !resourceVersions.some((version) => version.languageCode === language.code),
  )
  const existingSourceLanguages = SUPPORTED_LANGUAGES.filter((language) =>
    resourceVersions.some((version) => version.languageCode === language.code),
  )
  const selectedSourceVersion = resourceVersions.find((version) => version.languageCode === automaticTranslationSource) ?? null

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
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    configureAuthRefresh(async (failedAccessToken) => {
      const currentSession = sessionRef.current
      if (!currentSession) {
        return null
      }

      if (currentSession.accessToken !== failedAccessToken) {
        return currentSession.accessToken
      }

      try {
        const refreshedSession = await postRefresh(currentSession.refreshToken)
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(refreshedSession))
        sessionRef.current = refreshedSession
        setSession(refreshedSession)
        return refreshedSession.accessToken
      } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY)
        sessionRef.current = null
        setSession(null)
        return null
      }
    })

    return () => configureAuthRefresh(null)
  }, [])

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
      const refreshedProjects = await getProjects(session.accessToken)
      setProjects(refreshedProjects.filter((project) => !project.isDeleted))
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
    const requestRouteIdentity = resourceRouteIdentity
    let effectIsCurrent = true
    let resourceVersionsRequestIdForRun: number | null = null

    const loadHierarchy = async () => {
      setError('')
      try {
        if (!pageId) {
          setPagesLoading(true)
          const fetchedPages = await getPages(session.accessToken, projectId)
          setPages(fetchedPages.filter((page) => !page.isDeleted))
          setPageVersions([])
          setResources([])
          setResourceVersions([])
          setIsAutomaticTranslationsModalOpen(false)
          setAutomaticTranslationsError('')
          return
        }

        if (!pageVersionId) {
          setPageVersionsLoading(true)
          const fetchedVersions = await getPageVersions(session.accessToken, projectId, pageId)
          setPageVersions(fetchedVersions.filter((version) => !version.isDeleted))
          setResources([])
          setResourceVersions([])
          return
        }

        if (!resourceId) {
          setResourcesLoading(true)
          const fetchedResources = await getResources(session.accessToken, projectId, pageId, pageVersionId)
          setResources(fetchedResources.filter((resource) => !resource.isDeleted))
          setResourceVersions([])
          return
        }

        setResourceVersionsLoading(true)
        resourceVersionsRequestIdForRun = resourceVersionsRequestIdRef.current + 1
        resourceVersionsRequestIdRef.current = resourceVersionsRequestIdForRun
        const fetchedResourceVersions = await getResourceVersions(
          session.accessToken,
          projectId,
          pageId,
          pageVersionId,
          resourceId,
        )
        if (
          !effectIsCurrent ||
          resourceVersionsRequestIdForRun !== resourceVersionsRequestIdRef.current ||
          requestRouteIdentity !== resourceRouteIdentityRef.current
        ) {
          return
        }
        setResourceVersions(fetchedResourceVersions.filter((version) => !version.isDeleted))
      } catch (requestError) {
        if (
          !effectIsCurrent ||
          (resourceVersionsRequestIdForRun !== null && resourceVersionsRequestIdForRun !== resourceVersionsRequestIdRef.current) ||
          requestRouteIdentity !== resourceRouteIdentityRef.current
        ) {
          return
        }
        setError(requestError instanceof Error ? requestError.message : 'Unknown error')
      } finally {
        setPagesLoading(false)
        setPageVersionsLoading(false)
        setResourcesLoading(false)
        if (resourceVersionsRequestIdForRun === null || resourceVersionsRequestIdForRun === resourceVersionsRequestIdRef.current) {
          setResourceVersionsLoading(false)
        }
      }
    }

    void loadHierarchy()

    return () => {
      effectIsCurrent = false
    }
  }, [resourceRouteIdentity, route, session])

  useEffect(() => {
    resourceRouteIdentityRef.current = resourceRouteIdentity
  }, [resourceRouteIdentity])

  useEffect(() => {
    setResourceVersions([])
    setIsAutomaticTranslationsModalOpen(false)
    setAutomaticTranslationsError('')
    setAutomaticTranslationSource('es-es')
    setAutomaticTranslationsSubmitting(false)
    automaticTranslationsRequestLockRef.current = false
    automaticTranslationsRequestIdRef.current += 1
  }, [resourceRouteIdentity])

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

  const openEditPage = (page: PageResponse) => {
    setEditingPageId(page.id)
    setEditingPageName(page.name)
    setEditingPageDescription(page.description ?? '')
    setError('')
  }

  const cancelEditPage = () => {
    setEditingPageId(null)
    setEditingPageName('')
    setEditingPageDescription('')
  }

  const handleSavePage = async (pageId: string) => {
    if (!session || !route.projectId) {
      return
    }

    if (!editingPageName.trim()) {
      setError('El nombre de la página es obligatorio.')
      return
    }

    try {
      const updatedPage = await putPage(session.accessToken, route.projectId, pageId, {
        name: editingPageName,
        description: editingPageDescription,
      })
      setPages((currentPages) => currentPages.map((page) => (page.id === pageId ? updatedPage : page)))
      cancelEditPage()
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleDeletePage = async (pageId: string) => {
    if (!session || !route.projectId) {
      return
    }

    try {
      await deletePage(session.accessToken, route.projectId, pageId)
      setPages((currentPages) => currentPages.filter((page) => page.id !== pageId))
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const selectedPageForDelete = deleteConfirmationPageId
    ? pages.find((page) => page.id === deleteConfirmationPageId) ?? null
    : null

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

  const handleCreatePageVersion = async () => {
    if (!session || !route.projectId || !route.pageId) {
      return
    }

    if (!newPageVersionName.trim()) {
      setError('El nombre de la versión es obligatorio.')
      return
    }

    try {
      const createdVersion = await postPageVersion(session.accessToken, route.projectId, route.pageId, {
        name: newPageVersionName,
      })
      setPageVersions((currentVersions) => [createdVersion, ...currentVersions])
      setNewPageVersionName('')
      setIsCreatePageVersionModalOpen(false)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleCreateResource = async () => {
    if (!session || !route.projectId || !route.pageId || !route.pageVersionId) {
      return
    }

    if (!newResourceKey.trim() || !newResourceValue.trim()) {
      setError('La key y el valor inicial del recurso son obligatorios.')
      return
    }

    try {
      const created = await postResource(
        session.accessToken,
        route.projectId,
        route.pageId,
        route.pageVersionId,
        {
          key: newResourceKey,
          description: newResourceDescription,
          languageCode: newResourceLanguage,
          value: newResourceValue,
        },
      )
      setResources((currentResources) => [created.resource, ...currentResources])
      setNewResourceKey('')
      setNewResourceDescription('')
      setNewResourceLanguage('es-es')
      setNewResourceValue('')
      setIsCreateResourceModalOpen(false)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleCreateResourceVersion = async () => {
    if (!session || !route.projectId || !route.pageId || !route.pageVersionId || !route.resourceId) {
      return
    }

    if (!newResourceVersionValue.trim()) {
      setError('El valor de la traducción es obligatorio.')
      return
    }

    try {
      const createdVersion = await postResourceVersion(
        session.accessToken,
        route.projectId,
        route.pageId,
        route.pageVersionId,
        route.resourceId,
        { languageCode: newResourceVersionLanguage, value: newResourceVersionValue },
      )
      setResourceVersions((currentVersions) => [createdVersion, ...currentVersions])
      setNewResourceVersionValue('')
      setIsCreateResourceVersionModalOpen(false)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const openAutomaticTranslationsModal = () => {
    if (resourceVersionsLoading || existingSourceLanguages.length === 0 || availableLanguages.length === 0) {
      return
    }

    setAutomaticTranslationSource(existingSourceLanguages[0].code)
    setAutomaticTranslationsError('')
    setIsAutomaticTranslationsModalOpen(true)
  }

  const closeAutomaticTranslationsModal = () => {
    if (automaticTranslationsSubmitting) {
      return
    }

    setIsAutomaticTranslationsModalOpen(false)
  }

  const handleGenerateAutomaticTranslations = async () => {
    if (!session || !route.projectId || !route.pageId || !route.pageVersionId || !route.resourceId) {
      return
    }

    if (automaticTranslationsRequestLockRef.current || automaticTranslationsSubmitting) {
      return
    }

    const sourceVersion = resourceVersions.find((version) => version.languageCode === automaticTranslationSource)
    if (!sourceVersion || availableLanguages.length === 0) {
      return
    }

    const automaticTranslationsRequestId = automaticTranslationsRequestIdRef.current + 1
    automaticTranslationsRequestIdRef.current = automaticTranslationsRequestId
    const requestRouteIdentity = resourceRouteIdentity
    automaticTranslationsRequestLockRef.current = true
    setAutomaticTranslationsSubmitting(true)
    setAutomaticTranslationsError('')

    try {
      const response = await postAutomaticTranslations(
        session.accessToken,
        route.projectId,
        route.pageId,
        route.pageVersionId,
        route.resourceId,
        automaticTranslationSource,
      )
      if (
        automaticTranslationsRequestId !== automaticTranslationsRequestIdRef.current ||
        requestRouteIdentity !== resourceRouteIdentityRef.current
      ) {
        return
      }
      setResourceVersions((currentVersions) => [...response.translations, ...currentVersions])
      setIsAutomaticTranslationsModalOpen(false)
      setError('')
    } catch (requestError) {
      if (
        automaticTranslationsRequestId !== automaticTranslationsRequestIdRef.current ||
        requestRouteIdentity !== resourceRouteIdentityRef.current
      ) {
        return
      }
      setAutomaticTranslationsError(requestError instanceof Error ? requestError.message : 'Unknown error')
    } finally {
      if (
        automaticTranslationsRequestId === automaticTranslationsRequestIdRef.current &&
        requestRouteIdentity === resourceRouteIdentityRef.current
      ) {
        automaticTranslationsRequestLockRef.current = false
        setAutomaticTranslationsSubmitting(false)
      }
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
                    <button type="button" onClick={() => openEditPage(page)}>
                      Editar
                    </button>
                    <button type="button" onClick={() => setDeleteConfirmationPageId(page.id)}>
                      Borrar
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
              <div className="project-subpanel-actions">
                <button type="button" onClick={() => setIsCreatePageVersionModalOpen(true)}>
                  Crear versión
                </button>
                <button type="button" onClick={() => navigate(`/projects/${route.projectId}`)}>
                  Volver a páginas
                </button>
              </div>
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
                <button type="button" onClick={() => navigate(`/projects/${route.projectId}/${route.pageId}`)}>
                  Volver a versiones
                </button>
              </div>
            </div>
            {resourcesLoading ? <p>Cargando recursos...</p> : null}
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
                      Ver traducciones
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="panel-card neon-border projects-panel">
            <div className="projects-header">
              <h1>Traducciones del recurso</h1>
              <div className="project-subpanel-actions">
                {availableLanguages.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNewResourceVersionLanguage(availableLanguages[0].code)
                      setIsCreateResourceVersionModalOpen(true)
                    }}
                  >
                    Añadir traducción
                  </button>
                ) : null}
                {!resourceVersionsLoading && resourceVersions.length > 0 && availableLanguages.length > 0 ? (
                  <button type="button" onClick={openAutomaticTranslationsModal}>
                    Añadir traducciones automáticas
                  </button>
                ) : null}
                <button type="button" onClick={() => navigate(`/projects/${route.projectId}/${route.pageId}/${route.pageVersionId}`)}>
                  Volver a recursos
                </button>
              </div>
            </div>
            {resourceVersionsLoading ? <p>Cargando versiones de recurso...</p> : null}
            <ul className="projects-list">
              {resourceVersions.map((version) => (
                <li key={version.id} className="project-card">
                  <div className="language-heading">
                    <img
                      src={SUPPORTED_LANGUAGES.find((language) => language.code === version.languageCode)?.flagSrc}
                      alt=""
                      width="32"
                      height="24"
                    />
                    <h2>{SUPPORTED_LANGUAGES.find((language) => language.code === version.languageCode)?.label ?? version.languageCode}</h2>
                    <span>{version.languageCode}</span>
                  </div>
                  <p>{version.value}</p>
                </li>
              ))}
            </ul>
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

      {editingPageId ? (
        <dialog className="modal-backdrop" aria-label="Editar página" open>
          <article className="modal-card">
            <h3>Editar página</h3>
            <div className="project-subpanel">
              <label htmlFor="edit-page-name">Nombre</label>
              <input
                id="edit-page-name"
                aria-label="Nombre de la página"
                value={editingPageName}
                onChange={(event) => setEditingPageName(event.target.value)}
              />
              <label htmlFor="edit-page-description">Descripción</label>
              <input
                id="edit-page-description"
                aria-label="Descripción de la página"
                value={editingPageDescription}
                onChange={(event) => setEditingPageDescription(event.target.value)}
              />
            </div>
            <div className="project-subpanel-actions">
              <button type="button" onClick={() => void handleSavePage(editingPageId)}>
                Guardar cambios
              </button>
              <button type="button" onClick={cancelEditPage}>
                Cancelar
              </button>
            </div>
          </article>
        </dialog>
      ) : null}

      {deleteConfirmationPageId ? (
        <dialog className="modal-backdrop" aria-label="Confirmar borrado de página" open>
          <article className="modal-card">
            <h3>Confirmar borrado</h3>
            <p>
              ¿Seguro que quieres borrar <strong>{selectedPageForDelete?.name ?? 'esta página'}</strong>?
            </p>
            <div className="project-subpanel-actions">
              <button
                type="button"
                onClick={() => {
                  const pageIdToDelete = deleteConfirmationPageId
                  setDeleteConfirmationPageId(null)
                  if (pageIdToDelete) {
                    void handleDeletePage(pageIdToDelete)
                  }
                }}
              >
                Confirmar borrado
              </button>
              <button type="button" onClick={() => setDeleteConfirmationPageId(null)}>
                Cancelar
              </button>
            </div>
          </article>
        </dialog>
      ) : null}

      {isCreatePageVersionModalOpen ? (
        <section className="modal-backdrop" role="dialog" aria-label="Crear versión de página" aria-modal="true">
          <article className="modal-card">
            <h3>Crear versión de página</h3>
            <div className="project-subpanel">
              <label htmlFor="new-page-version-name">Nombre</label>
              <input
                id="new-page-version-name"
                aria-label="Nombre de la versión nueva"
                value={newPageVersionName}
                onChange={(event) => setNewPageVersionName(event.target.value)}
              />
            </div>
            <div className="project-subpanel-actions">
              <button type="button" onClick={() => void handleCreatePageVersion()}>
                Guardar versión
              </button>
              <button type="button" onClick={() => setIsCreatePageVersionModalOpen(false)}>
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
              <label htmlFor="new-resource-language">Idioma inicial</label>
              <div className="language-select-row">
                <img src={SUPPORTED_LANGUAGES.find((language) => language.code === newResourceLanguage)?.flagSrc} alt="" width="32" height="24" />
                <select
                  id="new-resource-language"
                  aria-label="Idioma inicial"
                  value={newResourceLanguage}
                  onChange={(event) => setNewResourceLanguage(event.target.value as SupportedLanguageCode)}
                >
                  {SUPPORTED_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
                </select>
              </div>
              <label htmlFor="new-resource-value">Valor inicial</label>
              <input
                id="new-resource-value"
                aria-label="Valor de la traducción inicial"
                value={newResourceValue}
                onChange={(event) => setNewResourceValue(event.target.value)}
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
        <section className="modal-backdrop" role="dialog" aria-label="Añadir traducción" aria-modal="true">
          <article className="modal-card">
            <h3>Añadir traducción</h3>
            <div className="project-subpanel">
              <label htmlFor="new-resource-version-language">Idioma</label>
              <div className="language-select-row">
                <img src={SUPPORTED_LANGUAGES.find((language) => language.code === newResourceVersionLanguage)?.flagSrc} alt="" width="32" height="24" />
                <select
                  id="new-resource-version-language"
                  aria-label="Idioma"
                  value={newResourceVersionLanguage}
                  onChange={(event) => setNewResourceVersionLanguage(event.target.value as SupportedLanguageCode)}
                >
                  {availableLanguages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
                </select>
              </div>
              <label htmlFor="new-resource-version-value">Valor</label>
              <input
                id="new-resource-version-value"
                aria-label="Valor de la traducción"
                value={newResourceVersionValue}
                onChange={(event) => setNewResourceVersionValue(event.target.value)}
              />
            </div>
            <div className="project-subpanel-actions">
              <button type="button" onClick={() => void handleCreateResourceVersion()}>
                Guardar traducción
              </button>
              <button type="button" onClick={() => setIsCreateResourceVersionModalOpen(false)}>
                Cancelar
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {isAutomaticTranslationsModalOpen ? (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-labelledby="automatic-translations-dialog-title"
          aria-label="Añadir traducciones automáticas"
          aria-modal="true"
        >
          <article className="modal-card">
            <h3 id="automatic-translations-dialog-title">Añadir traducciones automáticas</h3>
            <div className="project-subpanel">
              <label htmlFor="automatic-translations-source-language">Idioma de origen</label>
              <div className="language-select-row">
                <img
                  src={SUPPORTED_LANGUAGES.find((language) => language.code === automaticTranslationSource)?.flagSrc}
                  alt=""
                  width="32"
                  height="24"
                />
                <select
                  id="automatic-translations-source-language"
                  aria-label="Idioma de origen"
                  value={automaticTranslationSource}
                  onChange={(event) => setAutomaticTranslationSource(event.target.value as SupportedLanguageCode)}
                  disabled={automaticTranslationsSubmitting}
                >
                  {existingSourceLanguages.map((language) => (
                    <option key={language.code} value={language.code}>{language.label}</option>
                  ))}
                </select>
              </div>
              <div className="language-heading">
                <img
                  src={SUPPORTED_LANGUAGES.find((language) => language.code === automaticTranslationSource)?.flagSrc}
                  alt=""
                  width="32"
                  height="24"
                />
                <h2>{SUPPORTED_LANGUAGES.find((language) => language.code === automaticTranslationSource)?.label ?? automaticTranslationSource}</h2>
                <span>{automaticTranslationSource}</span>
              </div>
              <label htmlFor="automatic-translations-source-value">Texto de origen</label>
              <textarea
                id="automatic-translations-source-value"
                aria-label="Texto de origen"
                className="automatic-translation-source-value"
                value={selectedSourceVersion?.value ?? ''}
                readOnly
                rows={4}
              />
              <div>
                <h4 id="automatic-translations-target-languages-heading">Idiomas de destino</h4>
                <ul
                  aria-label="Idiomas de destino"
                  aria-labelledby="automatic-translations-target-languages-heading"
                  className="members-list automatic-translation-target-list"
                >
                  {availableLanguages.map((language) => (
                    <li key={language.code} className="language-heading">
                      <img src={language.flagSrc} alt="" width="32" height="24" />
                      <h2>{language.label}</h2>
                      <span>{language.code}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {automaticTranslationsError ? <p role="alert" className="error">{automaticTranslationsError}</p> : null}
            </div>
            <div className="project-subpanel-actions">
              <button
                type="button"
                onClick={() => void handleGenerateAutomaticTranslations()}
                disabled={
                  automaticTranslationsSubmitting ||
                  existingSourceLanguages.length === 0 ||
                  availableLanguages.length === 0 ||
                  !selectedSourceVersion
                }
              >
                {automaticTranslationsSubmitting ? 'Generando...' : 'Generar y guardar'}
              </button>
              <button type="button" onClick={closeAutomaticTranslationsModal} disabled={automaticTranslationsSubmitting}>
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
