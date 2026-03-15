import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Zap, Table2, Scale, AlertTriangle, FileText,
} from 'lucide-react'
import { useReconStore } from '../store/reconStore'

function UtcClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toUTCString().slice(17, 25))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{ fontFamily: "'Inter', monospace", fontSize: 12, fontWeight: 600, color: '#f1f5f9', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
      {time} <span style={{ color: '#64748b', fontSize: 10 }}>UTC</span>
    </span>
  )
}

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/matching', icon: Zap, label: 'Matching Engine' },
  { to: '/items', icon: Table2, label: 'Items' },
  { to: '/balance-pools', icon: Scale, label: 'Balance Pools' },
  { to: '/exceptions', icon: AlertTriangle, label: 'Exceptions' },
  { to: '/report', icon: FileText, label: 'Recon Report' },
]

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/matching': 'Matching Engine',
  '/items': 'Items',
  '/balance-pools': 'Balance Pools',
  '/exceptions': 'Exceptions',
  '/report': 'Recon Report',
}

export default function Layout() {
  const location = useLocation()
  const contexts = useReconStore(s => s.contexts)
  const activeRole = useReconStore(s => s.activeRole)
  const setActiveRole = useReconStore(s => s.setActiveRole)
  const title = TITLES[location.pathname] || 'ReconX'

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">ReconX</span>
          <span className="sidebar-version">v1.0</span>
        </div>
        <nav>
          <div className="nav-section-label">Reconciliation</div>
          <ul className="nav-list">
            {NAV_ITEMS.map(item => (
              <li key={item.to} className="nav-item">
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  end={item.to === '/'}
                >
                  <item.icon className="nav-icon" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contexts in sidebar */}
        <div style={{ padding: '0 10px 16px', marginTop: 'auto' }}>
          <div className="nav-section-label">Active Contexts</div>
          {contexts.map(ctx => (
            <div key={ctx.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', fontSize: 12, color: 'var(--text-secondary)',
            }}>
              <span className={`health-dot ${ctx.healthStatus.toLowerCase()}`} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ctx.name}
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Health Bar */}
        <div className="health-bar">
          {contexts.map(ctx => (
            <div key={ctx.id} className="health-item">
              <span className={`health-dot ${ctx.healthStatus.toLowerCase()}`} />
              <span className="health-label">{ctx.counterparty}</span>
              <span className="health-value">{ctx.matchRate}%</span>
              <span style={{ color: ctx.matchRate < 95 ? 'var(--warning)' : 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>
                {Math.floor(ctx.totalItems * (100 - ctx.matchRate) / 100)} exc
              </span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <UtcClock />
          </div>
        </div>

        {/* Top Bar */}
        <div className="top-bar">
          <h1>{title}</h1>
          <div className="top-bar-right">
            <div className="role-toggle">
              <button
                className={`role-btn ${activeRole === 'ANALYST' ? 'active' : ''}`}
                onClick={() => setActiveRole('ANALYST')}
              >
                Analyst
              </button>
              <button
                className={`role-btn ${activeRole === 'SUPERVISOR' ? 'active' : ''}`}
                onClick={() => setActiveRole('SUPERVISOR')}
              >
                Supervisor
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
