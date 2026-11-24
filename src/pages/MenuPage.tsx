import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { useOpenFailures } from '../components/Layout'
import { ProactiveToggle } from '../components/ProactiveToggle'
import { SignOut } from '../components/SignOut'
import { useWide } from '../components/useWide'

// Menu (mobile tab): the pages that are not tabs, grouped, and the settings. On a desktop the
// sidebar holds the settings, so this page leaves them out: each control exists once.

const GROUPS: Array<{ title: string; items: Array<{ to: string; label: string; icon: IconName }> }> = [
  {
    title: 'Runs and the robot',
    items: [
      { to: '/flow', label: 'Situation → run', icon: 'flow' },
      { to: '/failures', label: 'Failures', icon: 'alert' },
      { to: '/robot', label: 'Send the robot', icon: 'robot' },
    ],
  },
]

export function MenuPage() {
  const open = useOpenFailures()
  const wide = useWide()
  return (
    <section className="menu">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <h2 className="group-title">{g.title}</h2>
          <ul className="list-card">
            {g.items.map((i) => (
              <li key={i.to}>
                <Link to={i.to}>
                  <span className={`list-icon icon-${i.icon}`}><Icon name={i.icon} /></span>
                  <span className="list-label">{i.label}</span>
                  {i.to === '/failures' && open > 0 && <span className="count">{open}</span>}
                  <Icon name="chevron" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!wide && (
        <>
          <h2 className="group-title">Settings</h2>
          <div className="list-card settings">
            <ProactiveToggle />
            <SignOut />
          </div>
        </>
      )}
    </section>
  )
}
