const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

type HealthResponse = {
  status: string
}

type EchoResponse = {
  message: string
  source: string
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Request failed (${response.status}): ${message}`)
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
