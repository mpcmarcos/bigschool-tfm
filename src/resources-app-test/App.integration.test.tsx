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
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    })
    expect(localStorage.getItem('resources-auth-session')).toBeNull()
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
