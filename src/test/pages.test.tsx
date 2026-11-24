import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { stats } from '../pages/HistoryPage'
import { runs } from '../mocks/fixtures'

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FR-12 history (C-07)', () => {
  it('shows every run as a plain sentence', async () => {
    renderAt('/history')
    expect(await screen.findByText(/ceiling light was turned off over Wi-Fi/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').filter((li) => li.classList.contains('run'))).toHaveLength(runs.length)
  })

  it('leaves cancelled runs out of the success rates', () => {
    // WIFI: 1 success, 1 failure. ARM: 1 success, 1 unsure, 1 cancelled (left out).
    expect(stats(runs)).toEqual({ wireless: 0.5, arm: 0.5 })
  })
})

describe('FR-02 mappings (C-06, C-08)', () => {
  it('confirms a Pending mapping', async () => {
    renderAt('/mappings')
    const row = (await screen.findByText('Fan')).closest('tr')!
    expect(within(row).getByText('Pending')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Confirm' }))
    expect(await within(row).findByText('Verified')).toBeInTheDocument()
  })
})

describe('C-09 failures', () => {
  it('lists failed, unsure and cancelled runs and never retries on its own', async () => {
    renderAt('/failures')
    expect(await screen.findByText(/could not tell whether the desk lamp/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Try again' }).every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
  })
})
