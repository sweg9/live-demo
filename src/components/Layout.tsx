import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useLive } from '../live/LiveProvider'
import { useOpenFailures } from '../live/runs'
import { NoteText } from '../pages/Notifications'
import { EmergencyStop } from './EmergencyStop'
import { Icon, type IconName } from './Icon'
import { ProactiveToggle } from './ProactiveToggle'
import { SignOut } from './SignOut'
import { useWide } from './useWide'

// One responsive shell. Desktop: sidebar with every page, top bar with the page title.
// Mobile (iPhone 13 Pro, 390 px): the same top bar, a bottom tab bar with four tabs and the
// rest under Menu. Each control exists once in the page: the emergency stop is one element
// that CSS places (top bar or floating), and pause and sign-out render in the sidebar on a
// desktop or in Menu on a phone (C-04, C-06).

type Nav = { to: string; label: string; icon: IconName; tab?: boolean }

export const NAV: readonly Nav[] = [
  { to: '/', label: 'Home', icon: 'home', tab: true },
  { to: '/flow', label: 'Situation → run', icon: 'flow' },
  { to: '/robot', label: 'Send the robot', icon: 'robot' },
  { to: '/mappings', label: 'Devices', icon: 'devices', tab: true },
  { to: '/routines', label: 'Routines', icon: 'flow' },
  { to: '/failures', label: 'Failures', icon: 'alert' },
  { to: '/history', label: 'History & stats', icon: 'activity', tab: true },
  { to: '/demo', label: 'Live demo', icon: 'play' },
  { to: '/menu', label: 'Menu', icon: 'menu', tab: true },
]

export function Layout() {
  const { pathname } = useLocation()
  const page = NAV.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))
  const open = useOpenFailures()
  const wide = useWide()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          NOVA
        </div>
        <nav aria-label="Pages" className="side-nav">
          {NAV.filter((n) => n.to !== '/menu').map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.to === '/failures' && open > 0 && <span className="count" aria-label={`${open} waiting`}>{open}</span>}
            </NavLink>
          ))}
        </nav>
        {wide && (
          <div className="sidebar-foot">
            <ProactiveToggle />
            <SignOut />
          </div>
        )}
      </aside>

      <header className="topbar">
        <h1>{page?.label ?? 'NOVA'}</h1>
        <div className="topbar-actions">
          <Notifications />
          <EmergencyStop />
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav aria-label="Tabs" className="tabbar">
        {NAV.filter((n) => n.tab).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <span className="tab-icon">
              <Icon name={n.icon} size={26} />
              {n.to === '/menu' && open > 0 && <span className="dot" aria-label={`${open} failures waiting`} />}
            </span>
            <span>{n.to === '/history' ? 'Activity' : n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** The bell: live notifications (C-03 high-risk runs and others), newest first. */
function Notifications() {
  const { notifications } = useLive()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(0)
  const unread = Math.max(0, notifications.length - seen)
  return (
    <div className="bell">
      <button
        type="button"
        className="icon-button"
        aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o)
          setSeen(notifications.length)
        }}
      >
        <Icon name="bell" />
        {unread > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover-head">
            <strong>Notifications</strong>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setOpen(false)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          {notifications.length === 0 ? <p className="muted">Nothing new.</p> : <ul>{notifications.map((n, i) => <li key={i}><NoteText n={n} /></li>)}</ul>}
        </div>
      )}
    </div>
  )
}
