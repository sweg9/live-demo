import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { handlers } from '../mocks/handlers'
import { hub } from '../mocks/hub'

export const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  hub.reset() // every test starts from the demo data, signed in
  cleanup()
})
afterAll(() => server.close())
