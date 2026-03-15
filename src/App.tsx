import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './screens/Dashboard'
import MatchingEngine from './screens/MatchingEngine'
import Items from './screens/Items'
import BalancePools from './screens/BalancePools'
import Exceptions from './screens/Exceptions'
import ReconReport from './screens/ReconReport'
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
        <Route path="/report" element={<ReconReport />} />
      </Route>
    </Routes>
  )
}
