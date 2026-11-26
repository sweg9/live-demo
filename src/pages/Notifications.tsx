import { Link } from 'react-router-dom'
import type { Notification } from '../api/proposed'
import { useLive } from '../live/LiveProvider'

// The live notifications on Home, newest first. Some ask the resident: after a failure (retry or
// leave, C-09) or before acting (approve or dismiss, FR-06); those lead to the page to answer.
// After a hub error (`task_failed`, C-04) the hand stopped and the runs going on were cancelled:
// they wait on Failures, and nothing is tried again on its own.

function linkFor(n: Notification): { to: string; text: string } | null {
  if (n.choices?.includes('retry')) return { to: '/failures', text: 'Choose' }
  if (n.choices?.includes('approve')) return { to: '/flow', text: 'Choose' }
  if (n.topic === 'task_failed') return { to: '/failures', text: 'Review the cancelled runs' }
  return null
}

export function NoteText({ n }: { n: Notification }) {
  const link = linkFor(n)
  return (
    <>
      {n.message}
      {link && (
        <>
          {' '}
          <Link to={link.to}>{link.text}</Link>
        </>
      )}
    </>
  )
}

export function Notifications() {
  const { notifications } = useLive()
  if (notifications.length === 0) return null
  return (
    <>
      <div className="section-head">
        <h2>Notifications</h2>
      </div>
      <ul className="list-card notes">
        {notifications.map((n, i) => (
          <li key={i} className={n.level === 'warning' ? 'warn' : undefined}>
            <NoteText n={n} />
          </li>
        ))}
      </ul>
    </>
  )
}
