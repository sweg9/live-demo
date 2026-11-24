import { Placeholder } from '../components/Placeholder'

export function RobotPage() {
  return (
    <Placeholder
      title="Send the robot"
      plan={['Pick a device on the 3D map: "go here", or "stop here, then go there"']}
      needs={[
        'An API route for a move order (none in the spec yet); every move still passes the safety gate (C-04)',
        'The 3D map with device positions (map team)',
      ]}
    />
  )
}
