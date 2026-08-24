import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  return (
    <main className="page-shell">
      <section className="welcome-panel" aria-labelledby="page-title">
        <p className="eyebrow">Retail operations</p>
        <h1 id="page-title">Retail Price Automation Dashboard</h1>
        <p className="status-message">
          The API connection will be added in a later phase.
        </p>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)