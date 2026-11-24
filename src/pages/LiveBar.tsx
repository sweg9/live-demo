import { useLive } from '../live/LiveProvider'

// Connection state of the live updates, and (mock only) a button to play the scenario again.
export function LiveBar() {
  const { connected, replay } = useLive()
  return (
    <div className="live-bar">
      <span className={`dot ${connected ? 'on' : 'off'}`} />
      {connected ? 'Live' : 'Not connected: the lists may be out of date'}
      {replay && (
        <button type="button" onClick={replay}>
          Play the demo scenario again
        </button>
      )}
    </div>
  )
}
