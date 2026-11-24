import { Placeholder } from '../components/Placeholder'

export function FlowPage() {
  return (
    <Placeholder
      title="Situation → run"
      plan={[
        'How a routine is made from a situation',
        'Wireless result per device: success, failure or no wireless channel',
        'Devices left for the robot, as an ordered visit list',
        'Progress: move → press → done, started by the system, not by hand',
      ]}
      needs={[
        'A "situation" in the API (Run.trigger has only sensor, time, routine)',
        'Per-device channel attempts and the visit order; a Run has one channel',
        'A scenario from the mock server (or the browser mock until then)',
      ]}
    />
  )
}
