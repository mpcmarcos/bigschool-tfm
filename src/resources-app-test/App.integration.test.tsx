import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../resources-app/src/App'

const buildJsonResponse = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  )

describe('App communication flow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('loads health status from API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (typeof input === 'string' && input.endsWith('/health')) {
        return buildJsonResponse({ status: 'ok' })
      }

      throw new Error(`Unexpected URL: ${String(input)}`)
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar health' }))

    await waitFor(() => {
      expect(screen.getByTestId('health-result')).toHaveTextContent('Status: ok')
    })
  })

  it('posts echo and renders API payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (typeof input === 'string' && input.endsWith('/echo') && init?.method === 'POST') {
        return buildJsonResponse({ message: 'hola', source: 'api' })
      }

      throw new Error(`Unexpected URL: ${String(input)}`)
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar echo' }))

    await waitFor(() => {
      expect(screen.getByTestId('echo-result')).toHaveTextContent('Echo: hola (api)')
    })
  })
})
