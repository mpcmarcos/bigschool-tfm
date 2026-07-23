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

export type PageResponse = {
  id: string
  projectId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

export type PageVersionResponse = {
  id: string
  pageId: string
  name: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

export type ResourceResponse = {
  id: string
  projectId: string
  key: string
  description: string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

export type ResourceVersionResponse = {
  id: string
  resourceId: string
  name: string
  value: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

export type ResourcePageResponse = {
  id: string
  pageVersionId: string
  resourceVersionId: string
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

export const getPages = async (accessToken: string, projectId: string): Promise<PageResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/pages`, {
    headers: buildAuthHeaders(accessToken),
  })

  return parseResponse<PageResponse[]>(response)
}

export const postPage = async (
  accessToken: string,
  projectId: string,
  payload: { name: string; description: string },
): Promise<PageResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/pages`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  })

  return parseResponse<PageResponse>(response)
}

export const getPageVersions = async (
  accessToken: string,
  projectId: string,
  pageId: string,
): Promise<PageVersionResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/pages/${pageId}/versions`, {
    headers: buildAuthHeaders(accessToken),
  })

  return parseResponse<PageVersionResponse[]>(response)
}

export const setDefaultPageVersion = async (
  accessToken: string,
  projectId: string,
  pageId: string,
  pageVersionId: string,
): Promise<PageVersionResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/pages/${pageId}/versions/${pageVersionId}/set-default`,
    {
      method: 'POST',
      headers: buildAuthHeaders(accessToken),
    },
  )

  return parseResponse<PageVersionResponse>(response)
}

export const getResources = async (accessToken: string, projectId: string): Promise<ResourceResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/resources`, {
    headers: buildAuthHeaders(accessToken),
  })

  return parseResponse<ResourceResponse[]>(response)
}

export const postResource = async (
  accessToken: string,
  projectId: string,
  payload: { key: string; description: string },
): Promise<ResourceResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/resources`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  })

  return parseResponse<ResourceResponse>(response)
}

export const getResourceVersions = async (
  accessToken: string,
  projectId: string,
  resourceId: string,
): Promise<ResourceVersionResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/resources/${resourceId}/versions`, {
    headers: buildAuthHeaders(accessToken),
  })

  return parseResponse<ResourceVersionResponse[]>(response)
}

export const postResourceVersion = async (
  accessToken: string,
  projectId: string,
  resourceId: string,
  payload: { name: string; value: string },
): Promise<ResourceVersionResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/resources/${resourceId}/versions`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  })

  return parseResponse<ResourceVersionResponse>(response)
}

export const setDefaultResourceVersion = async (
  accessToken: string,
  projectId: string,
  resourceId: string,
  resourceVersionId: string,
): Promise<ResourceVersionResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/resources/${resourceId}/versions/${resourceVersionId}/set-default`,
    {
      method: 'POST',
      headers: buildAuthHeaders(accessToken),
    },
  )

  return parseResponse<ResourceVersionResponse>(response)
}

export const getResourcePages = async (
  accessToken: string,
  projectId: string,
  pageId: string,
  pageVersionId: string,
): Promise<ResourcePageResponse[]> => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/pages/${pageId}/versions/${pageVersionId}/resource-pages`,
    {
      headers: buildAuthHeaders(accessToken),
    },
  )

  return parseResponse<ResourcePageResponse[]>(response)
}

export const postResourcePage = async (
  accessToken: string,
  projectId: string,
  pageId: string,
  pageVersionId: string,
  payload: { resourceVersionId?: string; resourceId?: string },
): Promise<ResourcePageResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/pages/${pageId}/versions/${pageVersionId}/resource-pages`,
    {
      method: 'POST',
      headers: buildAuthHeaders(accessToken),
      body: JSON.stringify(payload),
    },
  )

  return parseResponse<ResourcePageResponse>(response)
}
