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
    const row = (await screen.findByRole('combobox', { name: 'Device for Switch 2' })).closest('tr')!
    expect(within(row).getByText('Pending')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Confirm' }))
    expect(await within(row).findByText('Verified')).toBeInTheDocument()
  })

  it('changes the device of a Verified mapping, which goes back to Pending (PATCH /mappings/{id})', async () => {
    renderAt('/mappings')
    const pick = await screen.findByRole('combobox', { name: 'Device for Switch 1' })
    const row = pick.closest('tr')!
    expect(within(row).getByText('Verified')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Save' })).toBeNull() // nothing to save yet
    await userEvent.selectOptions(pick, 'dev-fan')
    expect(hub.state.mappings.find((m) => m.mapping_id === 'map-1')!.device_id).toBe('dev-ceiling') // not before Save
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }))
    expect(await within(row).findByText('Pending')).toBeInTheDocument()
    expect(hub.state.mappings.find((m) => m.mapping_id === 'map-1')).toMatchObject({ device_id: 'dev-fan', status: 'Pending' })
    expect(within(row).queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('refuses an unknown device as the hub does', () => {
    expect(hub.changeDevice('map-1', 'dev-nope')).toMatchObject({ status: 404, body: { code: 'unknown_device' } })
    expect(hub.changeDevice('map-nope', 'dev-fan')).toMatchObject({ status: 404, body: { code: 'unknown_mapping' } })
  })
})

describe('FR-08 failures (C-09)', () => {
  const row = async (text: RegExp) => (await screen.findByText(text)).closest('li')!

  it('lists failed, unsure and cancelled runs and does nothing until the resident chooses', async () => {
    renderAt('/failures')
    expect(await screen.findByText(/could not tell whether the desk lamp/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(3)
    expect(hub.state.runs.some((r) => r.resolution)).toBe(false)
    expect(hub.state.active.size).toBe(0)
    expect(hub.timers).toHaveLength(0) // nothing was started on its own
  })

  it('Leave it takes the run off the list and keeps it in History', async () => {
    renderAt('/failures')
    await userEvent.click(within(await row(/Wi-Fi did not answer/)).getByRole('button', { name: 'Leave it' }))
    expect(await screen.findByText(/Left as it is/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/Wi-Fi did not answer/)).toBeNull())
    expect(hub.state.runs.find((r) => r.run_id === 'run-1')?.resolution).toEqual({ choice: 'leave', retry_run_id: null })
  })

  it('Try again starts a new run only when asked', async () => {
    renderAt('/failures')
    await userEvent.click(within(await row(/someone was near the power strip/)).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/Trying again/)).toBeInTheDocument()
    expect(hub.state.runs.find((r) => r.run_id === 'run-3')?.resolution).toMatchObject({ choice: 'retry' })
    expect(hub.timers.length).toBeGreaterThan(0)
  })

  it('C-08: refuses to retry a device whose switch is not Verified', async () => {
    renderAt('/failures')
    await userEvent.click(within(await row(/desk lamp turned on/)).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not Verified/)
    expect(hub.timers).toHaveLength(0)
  })
})

describe('FR-04, FR-06 routines (C-06)', () => {
  const routine = async (name: RegExp) => (await screen.findByRole('listitem', { name })) as HTMLElement

  it('lists each routine with its device and how much it may do alone', async () => {
    renderAt('/routines')
    const row = await routine(/Routine: Ceiling light/)
    expect(within(row).getByRole('combobox')).toHaveValue('act_and_tell')
    expect(within(await routine(/Routine: Heater/)).getByText(/never turned on without asking/)).toBeInTheDocument() // C-03
  })

  it('changes how independently a routine acts', async () => {
    renderAt('/routines')
    const row = await routine(/Routine: Ceiling light/)
    await userEvent.selectOptions(within(row).getByRole('combobox'), 'ask_first')
    await userEvent.click(within(row).getByRole('button', { name: 'Save change' }))
    expect(await screen.findByText('Changed.')).toBeInTheDocument()
    expect(hub.state.routines.find((r) => r.routine_id === 'rt-1')?.independence).toBe('ask_first')
  })

  it('removes a routine only after the resident confirms', async () => {
    renderAt('/routines')
    const row = await routine(/Routine: Ceiling light/)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    expect(hub.state.routines).toHaveLength(2)
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.queryByRole('listitem', { name: /Routine: Ceiling light/ })).toBeNull())
    expect(hub.state.routines.map((r) => r.routine_id)).toEqual(['rt-2'])
    confirm.mockRestore()
  })
})

describe('FR-12 stats scope (C-07)', () => {
  it('says which runs the stats come from', async () => {
    renderAt('/history')
    expect(await screen.findByLabelText('Stats scope')).toHaveTextContent(`From all ${runs.length} runs so far.`)
  })
})
