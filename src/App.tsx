import { Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { NowPage } from './pages/NowPage'
import { FlowPage } from './pages/FlowPage'
import { FailuresPage } from './pages/FailuresPage'
import { MappingsPage } from './pages/MappingsPage'
import { RobotPage } from './pages/RobotPage'
import { RoutinesPage } from './pages/RoutinesPage'
import { HistoryPage } from './pages/HistoryPage'
import { MenuPage } from './pages/MenuPage'

export default function App() {
  return (
    <AuthGate>
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<NowPage />} />
        <Route path="flow" element={<FlowPage />} />
        <Route path="failures" element={<FailuresPage />} />
        <Route path="mappings" element={<MappingsPage />} />
        <Route path="robot" element={<RobotPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="routines" element={<RoutinesPage />} />
        <Route path="menu" element={<MenuPage />} />
      </Route>
      </Routes>
    </AuthGate>
  )
}
