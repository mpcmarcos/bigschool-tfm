import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../resources-app/src/App'

const buildJsonResponse = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  )

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe('App Home/Login/Projects flow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    window.history.pushState({}, '', '/')
    cleanup()
  })

  it('renders home with generated logo, login link, featured content and clients section', () => {
    render(<App />)

    expect(screen.getByAltText('ResouceApp logo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Diseño y copy siempre sincronizados con producto.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Equipos que ya lo usan' })).toBeInTheDocument()

    const clientsSection = screen.getByLabelText('Clientes que confían en el producto')
    expect(within(clientsSection).getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByRole('img', { name: 'Logo de NexaGrid' }).getAttribute('src')).toContain('data:image/svg+xml')
  })

  it('opens login screen from top navigation', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('link', { name: 'Login' }))
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument()
  })

  it('navigates to home sections from login page links', async () => {
    window.history.pushState({}, '', '/login')
    render(<App />)

    fireEvent.click(screen.getByRole('link', { name: 'Features' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Diseño y copy siempre sincronizados con producto.' })).toBeInTheDocument()
      expect(window.location.pathname).toBe('/')
    })
  })

  it('moves featured carousel to the next item', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Gobernanza de resources en un solo lugar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente funcionalidad' }))
    expect(screen.getByRole('heading', { name: 'Handoff inmediato para el equipo técnico' })).toBeInTheDocument()
  })

  it('toggles color mode from menu', () => {
    localStorage.setItem('resources-app-theme', 'dark')
    render(<App />)

    const toggleButton = screen.getByRole('button', { name: 'Cambiar modo de color' })
    expect(toggleButton).toHaveTextContent('Modo claro')
    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveTextContent('Modo oscuro')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('shows testimonials with web-optimized images', () => {
    render(<App />)

    const testimonialImages = screen.getAllByRole('img', { name: /Foto de/i })
    expect(testimonialImages).toHaveLength(3)
    testimonialImages.forEach((image) => {
      expect(image.getAttribute('src')).toContain('.webp')
    })
  })

  it('redirects unauthenticated user from /projects to /login', async () => {
    window.history.pushState({}, '', '/projects')
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    })
  })

  it('refreshes an expired access token and retries the authenticated request', async () => {
    const projectAuthorizations: string[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      if (input.endsWith('/api/v1/projects')) {
        projectAuthorizations.push(new Headers(init?.headers).get('Authorization') ?? '')
        if (projectAuthorizations.length === 1) {
          return buildJsonResponse({ title: 'Unauthorized', detail: 'Expired access token.' }, 401)
        }

        return buildJsonResponse([
          {
            id: 'project-refreshed',
            name: 'Proyecto renovado',
            description: 'Sesión renovada',
            ownerUserId: 'user-refresh',
            ownerEmail: 'refresh@example.com',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (input.endsWith('/api/v1/auth/refresh') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'refresh-token-old' })
        return buildJsonResponse({
          accessToken: 'access-token-new',
          refreshToken: 'refresh-token-new',
          tokenType: 'Bearer',
          expiresIn: 900,
          user: {
            id: 'user-refresh',
            email: 'refresh@example.com',
            lastLoginAt: '2026-01-01T00:00:00Z',
          },
        })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-old',
        refreshToken: 'refresh-token-old',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-refresh',
          email: 'refresh@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )
    window.history.pushState({}, '', '/projects')

    render(<App />)

    expect(await screen.findByText('Proyecto renovado')).toBeInTheDocument()
    expect(projectAuthorizations).toContain('Bearer access-token-new')
    expect(JSON.parse(localStorage.getItem('resources-auth-session') ?? '{}')).toMatchObject({
      accessToken: 'access-token-new',
      refreshToken: 'refresh-token-new',
    })
  })

  it('returns to login when token refresh fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (typeof input === 'string' && input.endsWith('/api/v1/projects')) {
        return buildJsonResponse({ title: 'Unauthorized', detail: 'Expired access token.' }, 401)
      }

      if (typeof input === 'string' && input.endsWith('/api/v1/auth/refresh') && init?.method === 'POST') {
        return buildJsonResponse({ title: 'Unauthorized', detail: 'Invalid refresh token.' }, 401)
      }

      throw new Error(`Unexpected URL: ${String(input)}`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'expired-access-token',
        refreshToken: 'invalid-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-expired',
          email: 'expired@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )
    window.history.pushState({}, '', '/projects')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
      expect(window.location.pathname).toBe('/login')
    })
    expect(localStorage.getItem('resources-auth-session')).toBeNull()
  })

  it('renders projects for authenticated user and allows logout', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const method = init?.method ?? 'GET'
      if (typeof input === 'string' && input.endsWith('/api/v1/projects') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'project-1',
            name: 'Proyecto demo',
            description: 'Proyecto de pruebas',
            ownerUserId: 'user-1',
            ownerEmail: 'user1@example.com',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (typeof input === 'string' && input.endsWith('/api/v1/auth/logout') && init?.method === 'POST') {
        return Promise.resolve(new Response(null, { status: 204 }))
      }

      throw new Error(`Unexpected URL: ${String(input)}`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-1',
          email: 'user1@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )
    window.history.pushState({}, '', '/projects')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Proyectos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear proyecto' })).toBeInTheDocument()
    expect(await screen.findByText('Proyecto demo')).toBeInTheDocument()
    expect(screen.getByText('Proyecto de pruebas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver páginas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compartir' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Proyectos' })).toBeInTheDocument()
    expect(screen.getByTestId('top-user-email')).toHaveTextContent('user1@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    })
    expect(localStorage.getItem('resources-auth-session')).toBeNull()
  })

  it('creates, edits, shares and soft deletes a project from /projects', async () => {
    const sharedMembersByProject: Record<string, Array<{ id: string; email: string; role: string; userId: string; createdAt: string; updatedAt: string; isDeleted: boolean }>> = {
      'project-1': [
        {
          id: 'member-owner',
          userId: 'user-2',
          email: 'user2@example.com',
          role: 'admin',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          isDeleted: false,
        },
      ],
    }
    const projects = [
      {
        id: 'project-1',
        name: 'Proyecto inicial',
        description: 'Descripción inicial',
        ownerUserId: 'user-2',
        ownerEmail: 'user2@example.com',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        isDeleted: false,
      },
    ]

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'

      if (input.endsWith('/api/v1/projects') && method === 'GET') {
        return buildJsonResponse(projects)
      }

      if (input.endsWith('/api/v1/projects') && method === 'POST') {
        const payload = JSON.parse(String(init?.body)) as { name: string; description: string }
        const created = {
          id: 'project-2',
          name: payload.name,
          description: payload.description,
          ownerUserId: 'user-2',
          ownerEmail: 'user2@example.com',
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          isDeleted: false,
        }
        projects.push(created)
        sharedMembersByProject['project-2'] = [
          {
            id: 'member-owner-2',
            userId: 'user-2',
            email: 'user2@example.com',
            role: 'admin',
            createdAt: '2026-01-02T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            isDeleted: false,
          },
        ]
        return buildJsonResponse(created, 201)
      }

      if (input.includes('/api/v1/projects/project-1') && method === 'PUT') {
        const payload = JSON.parse(String(init?.body)) as { name: string; description: string }
        projects[0] = {
          ...projects[0],
          name: payload.name,
          description: payload.description,
          updatedAt: '2026-01-03T00:00:00Z',
        }
        return buildJsonResponse(projects[0])
      }

      if (input.includes('/api/v1/projects/project-1/members') && method === 'GET') {
        return buildJsonResponse(sharedMembersByProject['project-1'])
      }

      if (input.includes('/api/v1/projects/project-1/members') && method === 'POST') {
        const payload = JSON.parse(String(init?.body)) as { email: string; role: string }
        const newMember = {
          id: 'member-collab',
          userId: 'user-collab',
          email: payload.email,
          role: payload.role,
          createdAt: '2026-01-04T00:00:00Z',
          updatedAt: '2026-01-04T00:00:00Z',
          isDeleted: false,
        }
        sharedMembersByProject['project-1'].push(newMember)
        return buildJsonResponse(newMember, 201)
      }

      if (input.includes('/api/v1/projects/project-1') && method === 'DELETE') {
        projects[0] = {
          ...projects[0],
          isDeleted: true,
          updatedAt: '2026-01-05T00:00:00Z',
        }
        return Promise.resolve(new Response(null, { status: 204 }))
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-2',
        refreshToken: 'refresh-token-2',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-2',
          email: 'user2@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )
    window.history.pushState({}, '', '/projects')

    render(<App />)
    expect(await screen.findByText('Proyecto inicial')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Crear proyecto' }))
    const createDialog = screen.getByRole('dialog', { name: 'Crear proyecto' })
    fireEvent.change(within(createDialog).getByLabelText('Nombre del proyecto nuevo'), { target: { value: 'Proyecto nuevo' } })
    fireEvent.change(within(createDialog).getByLabelText('Descripción del proyecto nuevo'), { target: { value: 'Nueva descripción' } })
    fireEvent.click(within(createDialog).getByRole('button', { name: 'Guardar proyecto' }))
    expect(await screen.findByText('Proyecto nuevo')).toBeInTheDocument()

    const initialProjectCard = screen.getByText('Proyecto inicial').closest('.project-card')
    expect(initialProjectCard).not.toBeNull()
    const initialProjectScope = within(initialProjectCard as HTMLElement)

    fireEvent.click(initialProjectScope.getByRole('button', { name: 'Editar' }))
    const editDialog = screen.getByRole('dialog', { name: 'Editar proyecto' })
    fireEvent.change(within(editDialog).getByLabelText('Nombre del proyecto'), { target: { value: 'Proyecto editado' } })
    fireEvent.change(within(editDialog).getByLabelText('Descripción del proyecto'), { target: { value: 'Descripción editada' } })
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Proyecto editado')).toBeInTheDocument()

    const editedProjectCard = screen.getByText('Proyecto editado').closest('.project-card')
    expect(editedProjectCard).not.toBeNull()
    const editedProjectScope = within(editedProjectCard as HTMLElement)

    fireEvent.click(editedProjectScope.getByRole('button', { name: 'Compartir' }))
    const shareDialog = await screen.findByRole('dialog', { name: 'Compartir proyecto' })
    expect(within(shareDialog).getByText('Miembros con acceso')).toBeInTheDocument()
    fireEvent.change(within(shareDialog).getByLabelText('Nuevo email para compartir'), { target: { value: 'collab@example.com' } })
    fireEvent.change(within(shareDialog).getByLabelText('Rol de acceso'), { target: { value: 'viewer' } })
    fireEvent.click(within(shareDialog).getByRole('button', { name: 'Añadir acceso' }))
    expect(await within(shareDialog).findByText(/collab@example.com/i)).toBeInTheDocument()
    fireEvent.click(within(shareDialog).getByRole('button', { name: 'Cerrar' }))

    fireEvent.click(editedProjectScope.getByRole('button', { name: 'Ver páginas' }))
    expect(screen.getByRole('heading', { name: 'Páginas del proyecto' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Volver a proyectos' }))
    fireEvent.click(within(screen.getByText('Proyecto editado').closest('.project-card') as HTMLElement).getByRole('button', { name: 'Borrar' }))
    const deleteDialog = screen.getByRole('dialog', { name: 'Confirmar borrado' })
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Confirmar borrado' }))
    await waitFor(() => {
      expect(screen.queryByText('Proyecto editado')).not.toBeInTheDocument()
    })
  })

  it('logs in with google and stores session', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (typeof input === 'string' && input.endsWith('/api/v1/auth/social/login') && init?.method === 'POST') {
        return buildJsonResponse({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          tokenType: 'Bearer',
          expiresIn: 900,
          user: {
            id: 'user-2',
            email: 'user2@example.com',
            lastLoginAt: '2026-01-01T00:00:00Z',
          },
        })
      }

      throw new Error(`Unexpected URL: ${String(input)}`)
    })

    window.history.pushState({}, '', '/login')
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Proyectos' })).toBeInTheDocument()
    })

    expect(localStorage.getItem('resources-auth-session')).toContain('user2@example.com')
  })

  it('shows login error when API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (typeof input === 'string' && input.endsWith('/api/v1/auth/social/login') && init?.method === 'POST') {
        return buildJsonResponse(
          {
            type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid token.',
          },
          400,
        )
      }

      throw new Error(`Unexpected URL: ${String(input)}`)
    })

    window.history.pushState({}, '', '/login')
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid token.')
    })
  })

  it('edits and deletes a page from the project page list', async () => {
    let updateCalls = 0
    const page = {
      id: 'page-1',
      projectId: 'project-1',
      name: 'Página inicial',
      description: 'Descripción inicial',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      isDeleted: false,
    }

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.endsWith('/api/v1/projects/project-1/pages') && method === 'GET') {
        return buildJsonResponse([page])
      }

      if (input.endsWith('/api/v1/projects/project-1/pages/page-1') && method === 'PUT') {
        updateCalls += 1
        const payload = JSON.parse(String(init?.body)) as { name: string; description: string }
        expect(payload).toEqual({ name: 'Página editada', description: 'Descripción editada' })
        Object.assign(page, payload, { updatedAt: '2026-01-02T00:00:00Z' })
        return buildJsonResponse(page)
      }

      if (input.endsWith('/api/v1/projects/project-1/pages/page-1') && method === 'DELETE') {
        page.isDeleted = true
        return Promise.resolve(new Response(null, { status: 204 }))
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-page-actions',
        refreshToken: 'refresh-token-page-actions',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-page-actions',
          email: 'pages@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )
    window.history.pushState({}, '', '/projects/project-1')
    render(<App />)

    const pageCard = (await screen.findByText('Página inicial')).closest('.project-card')
    expect(pageCard).not.toBeNull()
    fireEvent.click(within(pageCard as HTMLElement).getByRole('button', { name: 'Editar' }))

    const editDialog = screen.getByRole('dialog', { name: 'Editar página' })
  fireEvent.change(within(editDialog).getByLabelText('Nombre de la página'), { target: { value: '  ' } })
  fireEvent.click(within(editDialog).getByRole('button', { name: 'Guardar cambios' }))
  expect(screen.getByRole('alert')).toHaveTextContent('El nombre de la página es obligatorio.')
  expect(updateCalls).toBe(0)

    fireEvent.change(within(editDialog).getByLabelText('Nombre de la página'), { target: { value: 'Página editada' } })
    fireEvent.change(within(editDialog).getByLabelText('Descripción de la página'), {
      target: { value: 'Descripción editada' },
    })
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Página editada')).toBeInTheDocument()
    expect(screen.getByText('Descripción editada')).toBeInTheDocument()
    expect(updateCalls).toBe(1)

    const editedPageCard = screen.getByText('Página editada').closest('.project-card')
    expect(editedPageCard).not.toBeNull()
    fireEvent.click(within(editedPageCard as HTMLElement).getByRole('button', { name: 'Borrar' }))

    const deleteDialog = screen.getByRole('dialog', { name: 'Confirmar borrado de página' })
    expect(within(deleteDialog).getByText('Página editada')).toBeInTheDocument()
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Confirmar borrado' }))

    await waitFor(() => {
      expect(screen.queryByText('Página editada')).not.toBeInTheDocument()
    })
  })

  it('navigates across hierarchy levels from project to resource detail', async () => {
    const pageVersions = [
      {
        id: 'page-version-1',
        pageId: 'page-1',
        name: 'v1',
        isDefault: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        isDeleted: false,
      },
      {
        id: 'page-version-2',
        pageId: 'page-1',
        name: 'v2',
        isDefault: true,
        createdAt: '2026-01-02T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        isDeleted: false,
      },
    ]

    const resourceVersions = [
      {
        id: 'resource-version-1',
        resourceId: 'resource-1',
        languageCode: 'es-es',
        value: 'Hola',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        isDeleted: false,
      },
    ]

    const resources = [
      {
        id: 'resource-1',
        pageVersionId: 'page-version-1',
        key: 'hero.title',
        description: 'Hero title',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        isDeleted: false,
      },
    ]

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.endsWith('/api/v1/projects') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'project-1',
            name: 'Proyecto jerárquico',
            description: 'Jerarquía',
            ownerUserId: 'user-9',
            ownerEmail: 'user9@example.com',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (input.includes('/api/v1/projects/project-1/pages') && method === 'GET' && !input.includes('/versions')) {
        return buildJsonResponse([
          {
            id: 'page-1',
            projectId: 'project-1',
            name: 'Home',
            description: 'Página Home',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (input.endsWith('/api/v1/projects/project-1/pages/page-1/versions') && method === 'GET') {
        return buildJsonResponse(pageVersions)
      }

      if (input.endsWith('/api/v1/projects/project-1/pages/page-1/versions') && method === 'POST') {
        const payload = JSON.parse(String(init?.body)) as { name: string }
        const createdVersion = {
          id: 'page-version-3',
          pageId: 'page-1',
          name: payload.name,
          isDefault: false,
          createdAt: '2026-01-03T00:00:00Z',
          updatedAt: '2026-01-03T00:00:00Z',
          isDeleted: false,
        }
        pageVersions.unshift(createdVersion)
        return buildJsonResponse(createdVersion, 201)
      }

      if (input.includes('/pages/page-1/versions/page-version-1/set-default') && method === 'POST') {
        pageVersions[0].isDefault = true
        pageVersions[1].isDefault = false
        return buildJsonResponse(pageVersions[0])
      }

      if (input.endsWith('/pages/page-1/versions/page-version-1/resources') && method === 'GET') {
        return buildJsonResponse(resources)
      }

      if (input.endsWith('/pages/page-1/versions/page-version-1/resources') && method === 'POST') {
        const payload = JSON.parse(String(init?.body)) as { key: string; description: string; languageCode: string; value: string }
        expect(payload).toEqual({
          key: 'footer.legal',
          description: 'Legal footer',
          languageCode: 'en-uk',
          value: 'Legal notice',
        })
        const resource = { ...resources[0], id: 'resource-2', key: payload.key, description: payload.description }
        resources.unshift(resource)
        return buildJsonResponse({
          resource,
          resourceVersion: { ...resourceVersions[0], id: 'resource-version-2', resourceId: resource.id, languageCode: payload.languageCode, value: payload.value },
        }, 201)
      }

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return buildJsonResponse(resourceVersions)
      }

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'POST') {
        const payload = JSON.parse(String(init?.body)) as { languageCode: string; value: string }
        expect(payload).toEqual({ languageCode: 'pt-br', value: 'Olá' })
        const createdVersion = {
          ...resourceVersions[0],
          id: 'resource-version-3',
          languageCode: payload.languageCode,
          value: payload.value,
        }
        resourceVersions.unshift(createdVersion)
        return buildJsonResponse(createdVersion, 201)
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-9',
        refreshToken: 'refresh-token-9',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-9',
          email: 'user9@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )
    window.history.pushState({}, '', '/projects')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Ver páginas' }))
    expect(await screen.findByRole('heading', { name: 'Páginas del proyecto' })).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: 'Ver versiones' }))
    expect(await screen.findByRole('heading', { name: 'Versiones de página' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Crear versión' }))
    const createVersionDialog = await screen.findByRole('dialog', { name: 'Crear versión de página' })
    fireEvent.change(within(createVersionDialog).getByLabelText('Nombre de la versión nueva'), { target: { value: 'v3' } })
    fireEvent.click(within(createVersionDialog).getByRole('button', { name: 'Guardar versión' }))
    expect(await screen.findByRole('heading', { name: 'v3' })).toBeInTheDocument()
    const versionOneCard = screen.getByRole('heading', { name: 'v1' }).closest('.project-card')
    expect(versionOneCard).not.toBeNull()
    fireEvent.click(within(versionOneCard as HTMLElement).getByRole('button', { name: 'Marcar default' }))

    fireEvent.click(within(versionOneCard as HTMLElement).getByRole('button', { name: 'Ver recursos' }))
    expect(await screen.findByRole('heading', { name: 'Recursos en versión de página' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Crear recurso' }))
    const createResourceDialog = await screen.findByRole('dialog', { name: 'Crear recurso' })
    fireEvent.change(within(createResourceDialog).getByLabelText('Key del recurso nuevo'), { target: { value: 'footer.legal' } })
    fireEvent.change(within(createResourceDialog).getByLabelText('Descripción del recurso nuevo'), { target: { value: 'Legal footer' } })
    fireEvent.change(within(createResourceDialog).getByLabelText('Idioma inicial'), { target: { value: 'en-uk' } })
    fireEvent.change(within(createResourceDialog).getByLabelText('Valor de la traducción inicial'), { target: { value: 'Legal notice' } })
    fireEvent.click(within(createResourceDialog).getByRole('button', { name: 'Guardar recurso' }))
    expect(await screen.findByText('footer.legal')).toBeInTheDocument()

    fireEvent.click(within(screen.getByText('hero.title').closest('.project-card') as HTMLElement).getByRole('button', { name: 'Ver traducciones' }))
    expect(await screen.findByRole('heading', { name: 'Traducciones del recurso' })).toBeInTheDocument()
    expect(screen.getByText('Hola')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir traducción' }))
    const createTranslationDialog = await screen.findByRole('dialog', { name: 'Añadir traducción' })
    expect(within(createTranslationDialog).queryByRole('option', { name: 'Español' })).not.toBeInTheDocument()
    fireEvent.change(within(createTranslationDialog).getByLabelText('Idioma'), { target: { value: 'pt-br' } })
    fireEvent.change(within(createTranslationDialog).getByLabelText('Valor de la traducción'), { target: { value: 'Olá' } })
    fireEvent.click(within(createTranslationDialog).getByRole('button', { name: 'Guardar traducción' }))

    expect(await screen.findByText('Olá')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/projects/project-1/page-1/page-version-1/resource-1')
  })

  it('shows hierarchy error message when backend rejects inconsistent ids', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.endsWith('/pages/page-1/versions/page-version-1/resources') && method === 'GET') {
        return buildJsonResponse([])
      }

      if (input.endsWith('/pages/page-1/versions/page-version-1/resources') && method === 'POST') {
        return buildJsonResponse(
          {
            type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
            title: 'Bad Request',
            detail: 'Page version does not belong to project.',
          },
          400,
        )
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-10',
        refreshToken: 'refresh-token-10',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-10',
          email: 'user10@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )
    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Crear recurso' }))
    const dialog = await screen.findByRole('dialog', { name: 'Crear recurso' })
    fireEvent.change(within(dialog).getByLabelText('Key del recurso nuevo'), { target: { value: 'hero.title' } })
    fireEvent.change(within(dialog).getByLabelText('Valor de la traducción inicial'), { target: { value: 'Hola' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar recurso' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Page version does not belong to project.')
    })
    expect(screen.queryByText('hero.title')).not.toBeInTheDocument()
  })

  it('generates automatic translations from one source and renders returned versions without refetching', async () => {
    let resourceVersionsGetCalls = 0
    let automaticTranslationsPostCalls = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        resourceVersionsGetCalls += 1
        return buildJsonResponse([
          {
            id: 'resource-version-1',
            resourceId: 'resource-1',
            languageCode: 'es-es',
            value: 'Hola',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/automatic-translations') && method === 'POST') {
        automaticTranslationsPostCalls += 1
        expect(JSON.parse(String(init?.body))).toEqual({ sourceLanguageCode: 'es-es' })

        return buildJsonResponse(
          {
            translations: [
              {
                id: 'resource-version-2',
                resourceId: 'resource-1',
                languageCode: 'pt-br',
                value: 'Ola',
                createdAt: '2026-01-02T00:00:00Z',
                updatedAt: '2026-01-02T00:00:00Z',
                isDeleted: false,
              },
              {
                id: 'resource-version-3',
                resourceId: 'resource-1',
                languageCode: 'en-uk',
                value: 'Hello',
                createdAt: '2026-01-02T00:00:00Z',
                updatedAt: '2026-01-02T00:00:00Z',
                isDeleted: false,
              },
            ],
          },
          201,
        )
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-auto-success',
        refreshToken: 'refresh-token-auto-success',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-auto-success',
          email: 'auto-success@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-1')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Traducciones del recurso' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir traducciones automáticas' }))

    const dialog = await screen.findByRole('dialog', { name: 'Añadir traducciones automáticas' })
    const sourceSelect = within(dialog).getByLabelText('Idioma de origen')
    expect(within(sourceSelect).getByRole('option', { name: 'Español' })).toBeInTheDocument()
    expect(within(sourceSelect).queryByRole('option', { name: 'Português (Brasil)' })).not.toBeInTheDocument()
    expect(within(sourceSelect).queryByRole('option', { name: 'English (United Kingdom)' })).not.toBeInTheDocument()

    const sourceValue = within(dialog).getByLabelText('Texto de origen')
    expect(sourceValue).toHaveValue('Hola')
    expect(sourceValue).toHaveAttribute('readonly')

    const targetLanguages = within(dialog).getByLabelText('Idiomas de destino')
    expect(within(targetLanguages).getByText('Português (Brasil)')).toBeInTheDocument()
    expect(within(targetLanguages).getByText('English (United Kingdom)')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Generar y guardar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Añadir traducciones automáticas' })).not.toBeInTheDocument()
    })

    expect(screen.getByText('Hola')).toBeInTheDocument()
    expect(screen.getByText('Ola')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(resourceVersionsGetCalls).toBe(1)
    expect(automaticTranslationsPostCalls).toBe(1)
  })

  it('hides automatic translation action while loading, with no source versions, and with no pending target languages', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-auto-visibility',
        refreshToken: 'refresh-token-auto-visibility',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-auto-visibility',
          email: 'auto-visibility@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )

    const loadingDeferred = createDeferred<Response>()
    fetchMock.mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return loadingDeferred.promise
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-1')
    render(<App />)

    expect(await screen.findByText('Cargando versiones de recurso...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir traducciones automáticas' })).not.toBeInTheDocument()

    loadingDeferred.resolve(
      new Response(
        JSON.stringify([
          {
            id: 'resource-version-1',
            resourceId: 'resource-1',
            languageCode: 'es-es',
            value: 'Hola',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ]),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Añadir traducciones automáticas' })).toBeInTheDocument()
    })

    cleanup()
    fetchMock.mockReset()

    fetchMock.mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return buildJsonResponse([])
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Traducciones del recurso' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Añadir traducciones automáticas' })).not.toBeInTheDocument()
    })

    cleanup()
    fetchMock.mockReset()

    fetchMock.mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'resource-version-1',
            resourceId: 'resource-1',
            languageCode: 'es-es',
            value: 'Hola',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
          {
            id: 'resource-version-2',
            resourceId: 'resource-1',
            languageCode: 'pt-br',
            value: 'Ola',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
          {
            id: 'resource-version-3',
            resourceId: 'resource-1',
            languageCode: 'en-uk',
            value: 'Hello',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Traducciones del recurso' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Añadir traducciones automáticas' })).not.toBeInTheDocument()
    })
  })

  it('updates source selector value and read-only source text when multiple source languages exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'resource-version-1',
            resourceId: 'resource-1',
            languageCode: 'es-es',
            value: 'Hola',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
          {
            id: 'resource-version-2',
            resourceId: 'resource-1',
            languageCode: 'en-uk',
            value: 'Hello',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-auto-source',
        refreshToken: 'refresh-token-auto-source',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-auto-source',
          email: 'auto-source@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-1')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Añadir traducciones automáticas' }))
    const dialog = await screen.findByRole('dialog', { name: 'Añadir traducciones automáticas' })

    const sourceSelect = within(dialog).getByLabelText('Idioma de origen')
    expect(within(sourceSelect).getByRole('option', { name: 'Español' })).toBeInTheDocument()
    expect(within(sourceSelect).getByRole('option', { name: 'English (United Kingdom)' })).toBeInTheDocument()

    const sourceValue = within(dialog).getByLabelText('Texto de origen')
    expect(sourceValue).toHaveValue('Hola')
    fireEvent.change(sourceSelect, { target: { value: 'en-uk' } })
    expect(sourceValue).toHaveValue('Hello')
  })

  it('disables automatic translation controls while submitting and blocks same-tick duplicate posts', async () => {
    const postDeferred = createDeferred<Response>()
    let automaticTranslationsPostCalls = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'resource-version-1',
            resourceId: 'resource-1',
            languageCode: 'es-es',
            value: 'Hola',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/automatic-translations') && method === 'POST') {
        automaticTranslationsPostCalls += 1
        return postDeferred.promise
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-auto-pending',
        refreshToken: 'refresh-token-auto-pending',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-auto-pending',
          email: 'auto-pending@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-1')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Añadir traducciones automáticas' }))
    const dialog = await screen.findByRole('dialog', { name: 'Añadir traducciones automáticas' })
    const generateButton = within(dialog).getByRole('button', { name: 'Generar y guardar' })
    const cancelButton = within(dialog).getByRole('button', { name: 'Cancelar' })

    fireEvent.click(generateButton)
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Generando...' })).toBeDisabled()
    })
    expect(cancelButton).toBeDisabled()
    expect(automaticTranslationsPostCalls).toBe(1)

    postDeferred.resolve(
      new Response(JSON.stringify({ translations: [] }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Añadir traducciones automáticas' })).not.toBeInTheDocument()
    })
  })

  it('keeps automatic translation modal state and shows server message inside dialog when post fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'resource-version-1',
            resourceId: 'resource-1',
            languageCode: 'es-es',
            value: 'Hola',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
          {
            id: 'resource-version-2',
            resourceId: 'resource-1',
            languageCode: 'en-uk',
            value: 'Hello',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/automatic-translations') && method === 'POST') {
        return buildJsonResponse(
          {
            title: 'Bad Request',
            detail: 'No se pudieron generar traducciones automáticas.',
          },
          400,
        )
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-auto-error',
        refreshToken: 'refresh-token-auto-error',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-auto-error',
          email: 'auto-error@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-1')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Añadir traducciones automáticas' }))
    const dialog = await screen.findByRole('dialog', { name: 'Añadir traducciones automáticas' })
    const sourceSelect = within(dialog).getByLabelText('Idioma de origen')
    fireEvent.change(sourceSelect, { target: { value: 'en-uk' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Generar y guardar' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('No se pudieron generar traducciones automáticas.')
    expect(screen.getByRole('dialog', { name: 'Añadir traducciones automáticas' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Idioma de origen')).toHaveValue('en-uk')
    expect(within(dialog).getByLabelText('Texto de origen')).toHaveValue('Hello')

    const targetLanguages = within(dialog).getByLabelText('Idiomas de destino')
    expect(within(targetLanguages).getByText('Português (Brasil)')).toBeInTheDocument()
  })

  it('ignores stale resource-version GET responses after route changes to another resource', async () => {
    const resourceOneGetDeferred = createDeferred<Response>()

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return resourceOneGetDeferred.promise
      }

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-2/versions') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'resource-2-version-1',
            resourceId: 'resource-2',
            languageCode: 'en-uk',
            value: 'Hello from resource 2',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-stale-get',
        refreshToken: 'refresh-token-stale-get',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-stale-get',
          email: 'stale-get@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-1')
    render(<App />)

    expect(await screen.findByText('Cargando versiones de recurso...')).toBeInTheDocument()

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-2')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(await screen.findByText('Hello from resource 2')).toBeInTheDocument()

    resourceOneGetDeferred.resolve(
      new Response(
        JSON.stringify([
          {
            id: 'resource-1-version-1',
            resourceId: 'resource-1',
            languageCode: 'es-es',
            value: 'Hola from resource 1',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ]),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    await waitFor(() => {
      expect(screen.queryByText('Hola from resource 1')).not.toBeInTheDocument()
      expect(screen.getByText('Hello from resource 2')).toBeInTheDocument()
    })
  })

  it('closes and resets automatic modal on resource change and ignores stale automatic post completion', async () => {
    const resourceOnePostDeferred = createDeferred<Response>()
    const automaticPostPayloads: Array<{ sourceLanguageCode: string }> = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'resource-1-version-1',
            resourceId: 'resource-1',
            languageCode: 'es-es',
            value: 'Hola resource 1',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-2/versions') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'resource-2-version-1',
            resourceId: 'resource-2',
            languageCode: 'en-uk',
            value: 'Hello resource 2',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/automatic-translations') && method === 'POST') {
        automaticPostPayloads.push(JSON.parse(String(init?.body)) as { sourceLanguageCode: string })
        return resourceOnePostDeferred.promise
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-stale-post',
        refreshToken: 'refresh-token-stale-post',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-stale-post',
          email: 'stale-post@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-1')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Añadir traducciones automáticas' }))
    const firstDialog = await screen.findByRole('dialog', { name: 'Añadir traducciones automáticas' })
    fireEvent.click(within(firstDialog).getByRole('button', { name: 'Generar y guardar' }))

    await waitFor(() => {
      expect(within(firstDialog).getByRole('button', { name: 'Generando...' })).toBeDisabled()
    })

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-2')
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Añadir traducciones automáticas' })).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Hello resource 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir traducciones automáticas' }))
    const secondDialog = await screen.findByRole('dialog', { name: 'Añadir traducciones automáticas' })
    expect(within(secondDialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(secondDialog).getByLabelText('Idioma de origen')).toHaveValue('en-uk')
    expect(within(secondDialog).getByLabelText('Texto de origen')).toHaveValue('Hello resource 2')

    resourceOnePostDeferred.resolve(
      new Response(
        JSON.stringify({
          translations: [
            {
              id: 'resource-1-version-2',
              resourceId: 'resource-1',
              languageCode: 'pt-br',
              value: 'Ola resource 1',
              createdAt: '2026-01-02T00:00:00Z',
              updatedAt: '2026-01-02T00:00:00Z',
              isDeleted: false,
            },
          ],
        }),
        {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    await waitFor(() => {
      expect(screen.queryByText('Ola resource 1')).not.toBeInTheDocument()
      expect(within(secondDialog).getByLabelText('Texto de origen')).toHaveValue('Hello resource 2')
      expect(within(secondDialog).getByLabelText('Idioma de origen')).toHaveValue('en-uk')
    })

    expect(automaticPostPayloads).toEqual([{ sourceLanguageCode: 'es-es' }])
  })

  it('retries automatic translations post once after 401 refresh with identical payload', async () => {
    const automaticPostAuthorizations: string[] = []
    const automaticPostPayloads: Array<{ sourceLanguageCode: string }> = []
    let refreshCalls = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'resource-version-1',
            resourceId: 'resource-1',
            languageCode: 'es-es',
            value: 'Hola',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (input.endsWith('/api/v1/auth/refresh') && method === 'POST') {
        refreshCalls += 1
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'refresh-token-auto-refresh' })
        return buildJsonResponse({
          accessToken: 'access-token-auto-refreshed',
          refreshToken: 'refresh-token-auto-refreshed',
          tokenType: 'Bearer',
          expiresIn: 900,
          user: {
            id: 'user-auto-refresh',
            email: 'auto-refresh@example.com',
            lastLoginAt: '2026-01-01T00:00:00Z',
          },
        })
      }

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/automatic-translations') && method === 'POST') {
        automaticPostAuthorizations.push(new Headers(init?.headers).get('Authorization') ?? '')
        automaticPostPayloads.push(JSON.parse(String(init?.body)) as { sourceLanguageCode: string })

        if (automaticPostAuthorizations.length === 1) {
          return buildJsonResponse({ title: 'Unauthorized', detail: 'Expired access token.' }, 401)
        }

        return buildJsonResponse(
          {
            translations: [
              {
                id: 'resource-version-2',
                resourceId: 'resource-1',
                languageCode: 'pt-br',
                value: 'Ola',
                createdAt: '2026-01-02T00:00:00Z',
                updatedAt: '2026-01-02T00:00:00Z',
                isDeleted: false,
              },
            ],
          },
          201,
        )
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-auto-expired',
        refreshToken: 'refresh-token-auto-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-auto-refresh',
          email: 'auto-refresh@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-1')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Añadir traducciones automáticas' }))
    const dialog = await screen.findByRole('dialog', { name: 'Añadir traducciones automáticas' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Generar y guardar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Añadir traducciones automáticas' })).not.toBeInTheDocument()
    })

    expect(screen.queryByRole('dialog', { name: 'Añadir traducciones automáticas' })).not.toBeInTheDocument()
    expect(refreshCalls).toBe(1)
    expect(automaticPostAuthorizations).toEqual(['Bearer access-token-auto-expired', 'Bearer access-token-auto-refreshed'])
    expect(automaticPostPayloads).toEqual([{ sourceLanguageCode: 'es-es' }, { sourceLanguageCode: 'es-es' }])
  })

  it('clears modal error and reinitializes source selection after close and reopen', async () => {
    let automaticPostCalls = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected URL: ${String(input)}`)
      }

      const method = init?.method ?? 'GET'
      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/versions') && method === 'GET') {
        return buildJsonResponse([
          {
            id: 'resource-version-1',
            resourceId: 'resource-1',
            languageCode: 'es-es',
            value: 'Hola',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
          {
            id: 'resource-version-2',
            resourceId: 'resource-1',
            languageCode: 'en-uk',
            value: 'Hello',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isDeleted: false,
          },
        ])
      }

      if (input.includes('/pages/page-1/versions/page-version-1/resources/resource-1/automatic-translations') && method === 'POST') {
        automaticPostCalls += 1
        if (automaticPostCalls === 1) {
          return buildJsonResponse(
            {
              title: 'Bad Request',
              detail: 'No se pudieron generar traducciones automáticas.',
            },
            400,
          )
        }

        return buildJsonResponse({ translations: [] }, 201)
      }

      throw new Error(`Unexpected URL: ${input} (${method})`)
    })

    localStorage.setItem(
      'resources-auth-session',
      JSON.stringify({
        accessToken: 'access-token-auto-reopen',
        refreshToken: 'refresh-token-auto-reopen',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-auto-reopen',
          email: 'auto-reopen@example.com',
          lastLoginAt: '2026-01-01T00:00:00Z',
        },
      }),
    )

    window.history.pushState({}, '', '/projects/project-1/page-1/page-version-1/resource-1')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Añadir traducciones automáticas' }))
    const firstOpenDialog = await screen.findByRole('dialog', { name: 'Añadir traducciones automáticas' })
    const sourceSelect = within(firstOpenDialog).getByLabelText('Idioma de origen')

    fireEvent.change(sourceSelect, { target: { value: 'en-uk' } })
    expect(within(firstOpenDialog).getByLabelText('Texto de origen')).toHaveValue('Hello')
    fireEvent.click(within(firstOpenDialog).getByRole('button', { name: 'Generar y guardar' }))

    expect(await within(firstOpenDialog).findByRole('alert')).toHaveTextContent('No se pudieron generar traducciones automáticas.')

    fireEvent.click(within(firstOpenDialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Añadir traducciones automáticas' })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Añadir traducciones automáticas' }))
    const secondOpenDialog = await screen.findByRole('dialog', { name: 'Añadir traducciones automáticas' })
    expect(within(secondOpenDialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(secondOpenDialog).getByLabelText('Idioma de origen')).toHaveValue('es-es')
    expect(within(secondOpenDialog).getByLabelText('Texto de origen')).toHaveValue('Hola')
  })
})
