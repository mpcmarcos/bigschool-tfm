const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174'

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

export type ProjectResponse = {
  id: string
  name: string
  description: string | null
  ownerUserId: string
  ownerEmail: string
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

export type ProjectMemberResponse = {
  id: string
  projectId: string
  userId: string
  email: string
  role: string
  createdAt: string
  updatedAt: string
  isDeleted: boolean
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

const buildAuthHeaders = (accessToken: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${accessToken}`,
})

export const getProjects = async (accessToken: string): Promise<ProjectResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects`, {
    headers: buildAuthHeaders(accessToken),
  })

  return parseResponse<ProjectResponse[]>(response)
}

export const postProject = async (
  accessToken: string,
  payload: { name: string; description: string },
): Promise<ProjectResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  })

  return parseResponse<ProjectResponse>(response)
}

export const putProject = async (
  accessToken: string,
  projectId: string,
  payload: { name: string; description: string },
): Promise<ProjectResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
    method: 'PUT',
    headers: buildAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  })

  return parseResponse<ProjectResponse>(response)
}

export const deleteProject = async (accessToken: string, projectId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(accessToken),
  })

  if (!response.ok) {
    await parseResponse<unknown>(response)
  }
}

export const getProjectMembers = async (
  accessToken: string,
  projectId: string,
): Promise<ProjectMemberResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/members`, {
    headers: buildAuthHeaders(accessToken),
  })

  return parseResponse<ProjectMemberResponse[]>(response)
}

export const postProjectMember = async (
  accessToken: string,
  projectId: string,
  payload: { email: string; role: string },
): Promise<ProjectMemberResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/members`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  })

  return parseResponse<ProjectMemberResponse>(response)
}
