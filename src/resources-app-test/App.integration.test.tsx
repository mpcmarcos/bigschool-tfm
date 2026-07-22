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
})
