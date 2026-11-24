import { NavLink, Outlet } from 'react-router-dom'
import { EmergencyStop } from './EmergencyStop'
import { ProactiveToggle } from './ProactiveToggle'
import { SignOut } from './SignOut'

export const NAV = [
  { to: '/', label: 'Now' },
  { to: '/flow', label: 'Situation → run' },
  { to: '/failures', label: 'Failures' },
  { to: '/mappings', label: 'Mappings' },
  { to: '/robot', label: 'Send the robot' },
  { to: '/history', label: 'History & stats' },
] as const

// The safety bar sits outside <Outlet/>, so every page shows it (C-04, C-06).
export function Layout() {
  return (
    <div className="app">
      <header className="safety-bar">
        <strong className="brand">NOVA</strong>
        <ProactiveToggle />
        <EmergencyStop />
        <SignOut />
      </header>
      <nav className="side-nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
