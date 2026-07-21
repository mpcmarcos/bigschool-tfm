const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

export type HealthResponse = {
  status: string
}

export type EchoResponse = {
  message: string
  source: string
}

export type UserProfileResponse = {
  id: string
  email: string
  lastLoginAt: string
}

export type AuthResponse = {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: UserProfileResponse
}

type ProblemDetails = {
  detail?: string
  title?: string
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as ProblemDetails
      const message = body.detail ?? body.title ?? 'Request failed'
      throw new Error(message)
    }

    const message = await response.text()
    throw new Error(message || `Request failed (${response.status})`)
  }

  return (await response.json()) as T
}

export const getHealth = async (): Promise<HealthResponse> => {
  const response = await fetch(`${API_BASE_URL}/health`)
  return parseResponse<HealthResponse>(response)
}

export const postEcho = async (message: string): Promise<EchoResponse> => {
  const response = await fetch(`${API_BASE_URL}/echo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })

  return parseResponse<EchoResponse>(response)
}

export const postSocialLogin = async (provider: string, idToken: string): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/social/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider, idToken }),
  })

  return parseResponse<AuthResponse>(response)
}

export const postLogout = async (refreshToken: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    await parseResponse<unknown>(response)
  }
}
