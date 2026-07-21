import { useState } from 'react'
import type { FormEvent } from 'react'
import { getHealth, postEcho } from './api'
import './App.css'

function App() {
  const [message, setMessage] = useState('hola')
  const [healthResult, setHealthResult] = useState<string>('')
  const [echoResult, setEchoResult] = useState<string>('')
  const [error, setError] = useState<string>('')

  const handleHealthClick = async () => {
    setError('')
    try {
      const response = await getHealth()
      setHealthResult(response.status)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  const handleEchoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    try {
      const response = await postEcho(message)
      setEchoResult(`${response.message} (${response.source})`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    }
  }

  return (
    <main className="container">
      <h1>Resources base communication demo</h1>

      <section className="card">
        <h2>Health</h2>
        <button type="button" onClick={handleHealthClick}>
          Comprobar health
        </button>
        <p data-testid="health-result">
          {healthResult ? `Status: ${healthResult}` : 'Sin respuesta'}
        </p>
      </section>

      <section className="card">
        <h2>Echo</h2>
        <form onSubmit={handleEchoSubmit}>
          <label htmlFor="message-input">Mensaje</label>
          <input
            id="message-input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <button type="submit">Enviar echo</button>
        </form>
        <p data-testid="echo-result">{echoResult ? `Echo: ${echoResult}` : 'Sin respuesta'}</p>
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  )
}

export default App
