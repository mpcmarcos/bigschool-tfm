import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

describe('App login flow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    window.history.pushState({}, '', '/')
    cleanup()
  })

  it('renders login screen for anonymous user', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument()
  })

  it('redirects authenticated user to projects and allows logout', async () => {
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

    render(<App />)
    fireEvent.change(screen.getByLabelText('ID Token (desarrollo)'), {
      target: { value: 'test-token:user-2:user2@example.com' },
    })
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

    render(<App />)
    fireEvent.change(screen.getByLabelText('ID Token (desarrollo)'), {
      target: { value: 'invalid-token' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid token.')
    })
  })
})
