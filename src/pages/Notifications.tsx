import { Link } from 'react-router-dom'
import type { Notification } from '../api/proposed'
import { useLive } from '../live/LiveProvider'

// The live notifications on Home, newest first. Some ask the resident: after a failure (retry or
// leave, C-09) or before acting (approve or dismiss, FR-06); those lead to the page to answer.

export function NoteText({ n }: { n: Notification }) {
  const answer = n.choices?.includes('retry') ? '/failures' : n.choices?.includes('approve') ? '/flow' : null
  return (
    <>
      {n.message}
      {answer && (
        <>
          {' '}
          <Link to={answer}>Choose</Link>
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
