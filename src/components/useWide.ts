import { useSyncExternalStore } from 'react'

// Desktop or phone. Must match the breakpoint in styles.css. Where matchMedia does not exist
// (tests), it counts as desktop.
export const WIDE = '(min-width: 900px)'

const subscribe = (cb: () => void) => {
  const m = globalThis.matchMedia?.(WIDE)
  m?.addEventListener('change', cb)
  return () => m?.removeEventListener('change', cb)
}

export const useWide = () => useSyncExternalStore(subscribe, () => globalThis.matchMedia?.(WIDE).matches ?? true)
