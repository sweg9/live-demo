import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { LiveProvider } from './live/LiveProvider'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

async function start() {
  // 목업은 개발 모드에서 기본으로 켜짐. 실제 서버로 붙이려면 `npm run dev:real`.
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK !== 'off') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledFrame: 'bypass' })
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <LiveProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </LiveProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

start()
