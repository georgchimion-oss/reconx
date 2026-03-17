import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './screens/Dashboard'
import MatchingEngine from './screens/MatchingEngine'
import Items from './screens/Items'
import BalancePools from './screens/BalancePools'
import Exceptions from './screens/Exceptions'
import ReconReport from './screens/ReconReport'
import MatchGroups from './screens/MatchGroups'
import CarryForward from './screens/CarryForward'
import AgingAnalysis from './screens/AgingAnalysis'
import AuditTrail from './screens/AuditTrail'
import { useReconStore } from './store/reconStore'

export default function App() {
  const initialize = useReconStore(s => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/matching" element={<MatchingEngine />} />
        <Route path="/items" element={<Items />} />
        <Route path="/balance-pools" element={<BalancePools />} />
        <Route path="/exceptions" element={<Exceptions />} />
        <Route path="/match-groups" element={<MatchGroups />} />
        <Route path="/report" element={<ReconReport />} />
        <Route path="/carry-forward" element={<CarryForward />} />
        <Route path="/aging" element={<AgingAnalysis />} />
        <Route path="/audit-trail" element={<AuditTrail />} />
      </Route>
    </Routes>
  )
}
