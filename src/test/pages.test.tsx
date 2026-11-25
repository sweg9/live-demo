import { render, screen, waitFor, within } from '@testing-library/react'
import { hub } from '../mocks/hub'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { failureReasons, frequentDevices, successRates, verifiedShare } from '../pages/stats'
import { mappings, runs } from '../mocks/fixtures'

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
    expect(successRates(runs)).toEqual({ wireless: 0.5, arm: 0.5 })
  })

  it('ranks why runs did not succeed, by the cancel reason or by result and channel', () => {
    expect(failureReasons(runs)).toEqual([
      { key: 'failure · WIFI', count: 1 },
      { key: 'person_in_work_area', count: 1 },
      { key: 'unsure · ARM', count: 1 },
    ])
  })

  it('ranks the most used devices', () => {
    expect(frequentDevices(runs)[0]).toEqual({ key: 'dev-ceiling', count: 2 })
  })

  it('counts the verified share without rejected mappings (C-08)', () => {
    expect(verifiedShare(mappings)).toBe(4 / 6) // 4 Verified of 6, none Rejected
    expect(verifiedShare([{ ...mappings[0], status: 'Rejected' }, mappings[1]])).toBe(0) // 0 of 1 open
    expect(verifiedShare([])).toBeNull()
  })

  it('shows the rankings on the page', async () => {
    renderAt('/history')
    const reasons = await screen.findByLabelText('Why runs did not succeed')
    expect(within(reasons).getByText('person_in_work_area')).toBeInTheDocument()
    const used = screen.getByLabelText('Most used devices')
    expect(await within(used).findByText('Ceiling light')).toBeInTheDocument()
  })
})

describe('FR-02 mappings (C-06, C-08)', () => {
  it('confirms a Pending mapping', async () => {
    renderAt('/mappings')
    const row = (await screen.findByRole('cell', { name: 'Fan' })).closest('tr')!
    expect(within(row).getByText('Pending')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Confirm' }))
    expect(await within(row).findByText('Verified')).toBeInTheDocument()
  })
})

describe('FR-08 failures (C-09)', () => {
  const row = async (text: RegExp) => (await screen.findByText(text)).closest('li')!

  it('lists failed, unsure and cancelled runs and does nothing until the resident chooses', async () => {
    renderAt('/failures')
    expect(await screen.findByText(/could not tell whether the desk lamp/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(3)
    expect(hub.state.runs.some((r) => r.resolution)).toBe(false)
    expect(hub.timers).toHaveLength(0) // nothing was started on its own
  })

  it('Leave it takes the run off the list and keeps it in History', async () => {
    renderAt('/failures')
    await userEvent.click(within(await row(/Wi-Fi did not answer/)).getByRole('button', { name: 'Leave it' }))
    expect(await screen.findByText(/Left as it is/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/Wi-Fi did not answer/)).toBeNull())
    expect(hub.state.runs.find((r) => r.run_id === 'run-1')?.resolution).toBe('left')
  })

  it('Try again starts a new run only when asked', async () => {
    renderAt('/failures')
    await userEvent.click(within(await row(/someone was near the power strip/)).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/Trying again/)).toBeInTheDocument()
    expect(hub.state.runs.find((r) => r.run_id === 'run-3')?.resolution).toBe('retried')
    expect(hub.timers.length).toBeGreaterThan(0)
  })

  it('C-08: refuses to retry a device whose switch is not Verified', async () => {
    renderAt('/failures')
    await userEvent.click(within(await row(/desk lamp turned on/)).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not Verified/)
    expect(hub.timers).toHaveLength(0)
  })
})
