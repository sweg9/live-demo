// A page that waits on something outside this repo. `needs` says what, so the gap is visible.
export function Placeholder({ title, plan, needs }: { title: string; plan: string[]; needs: string[] }) {
  return (
    <section>
      <h1>{title}</h1>
      <p className="muted">Not built yet.</p>
      <h2>Will show</h2>
      <ul>{plan.map((p) => <li key={p}>{p}</li>)}</ul>
      <h2>Waiting on</h2>
      <ul className="needs">{needs.map((n) => <li key={n}>{n}</li>)}</ul>
    </section>
  )
}
