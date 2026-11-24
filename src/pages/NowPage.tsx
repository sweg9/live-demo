import { Placeholder } from '../components/Placeholder'

export function NowPage() {
  return (
    <Placeholder
      title="Now"
      plan={[
        'The situation that came in and the runs it started or queued',
        'What the robot is doing: stage, target device, wireless or press',
        'The robot on the 3D map',
      ]}
      needs={[
        'A typed payload for app.event run.progress (stage, device, channel); data is an untyped object today',
        'The robot status (hub.status) passed on to the app',
        'The 3D map (map team). No live camera: video never leaves the home (C-05)',
      ]}
    />
  )
}
