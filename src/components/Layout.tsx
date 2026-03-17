import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Zap, Table2, Scale, AlertTriangle, FileText,
  ArrowRightLeft, BarChart2, Link2, Shield,
} from 'lucide-react'
import { useReconStore } from '../store/reconStore'

// ─── Counterparty abbreviation map ───────────────────────────
const ABBREV_MAP: Record<string, string> = {
  'JPMorgan Chase': 'JPM',
  'Deutsche Bank':  'DB',
  'Barclays':       'BARC',
  'State Street':   'SST',
}

function abbrev(name: string): string {
  return ABBREV_MAP[name] ?? name.slice(0, 3).toUpperCase()
}

// ─── User names per role ──────────────────────────────────────
const ROLE_USERS: Record<string, string> = {
  SUPERVISOR: 'Thomas Mueller',
  ANALYST:    'Sarah Chen',
}

// ─── Bloomberg-style UTC clock + date ────────────────────────
function UtcClock() {
  const [display, setDisplay] = useState({ time: '', date: '' })

  useEffect(() => {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const tick = () => {
      const now = new Date()
      const hh  = String(now.getUTCHours()).padStart(2, '0')
      const mm  = String(now.getUTCMinutes()).padStart(2, '0')
      const ss  = String(now.getUTCSeconds()).padStart(2, '0')
      const dd  = String(now.getUTCDate()).padStart(2, '0')
      const mon = MONTHS[now.getUTCMonth()]
      const yr  = now.getUTCFullYear()
      setDisplay({ time: `${hh}:${mm}:${ss}`, date: `${dd}-${mon}-${yr}` })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontFamily: "'Inter', monospace",
        fontSize: 11,
        fontWeight: 600,
        color: '#f1f5f9',
        letterSpacing: '0.06em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {display.time}
      </span>
      <span style={{ color: '#64748b', fontSize: 10, fontWeight: 500 }}>UTC</span>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: '#94a3b8',
        letterSpacing: '0.03em',
      }}>
        {display.date}
      </span>
    </span>
  )
}

// ─── Nav items ────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard'        },
  { to: '/matching',      icon: Zap,             label: 'Matching Engine'  },
  { to: '/items',         icon: Table2,          label: 'Items'            },
  { to: '/match-groups',  icon: Link2,           label: 'Match Groups'     },
  { to: '/balance-pools', icon: Scale,           label: 'Balance Pools'    },
  { to: '/exceptions',    icon: AlertTriangle,   label: 'Exceptions'       },
  { to: '/carry-forward', icon: ArrowRightLeft,  label: 'Carry Forward'    },
  { to: '/aging',         icon: BarChart2,       label: 'Aging Analysis'   },
  { to: '/report',        icon: FileText,        label: 'Recon Report'     },
  { to: '/audit-trail',   icon: Shield,          label: 'Audit Trail'      },
]

const TITLES: Record<string, string> = {
  '/':               'Dashboard',
  '/matching':       'Matching Engine',
  '/items':          'Items',
  '/match-groups':   'Match Groups',
  '/balance-pools':  'Balance Pools',
  '/exceptions':     'Exceptions',
  '/carry-forward':  'Carry Forward Manager',
  '/aging':          'Aging Analysis',
  '/report':         'Recon Report',
  '/audit-trail':    'Audit Trail & Compliance',
}

// ─── Role dot colours ─────────────────────────────────────────
const ROLE_DOT: Record<string, string> = {
  SUPERVISOR: '#818cf8',
  ANALYST:    '#34d399',
}

export default function Layout() {
  const location    = useLocation()
  const contexts    = useReconStore(s => s.contexts)
  const activeRole  = useReconStore(s => s.activeRole)
  const setActiveRole = useReconStore(s => s.setActiveRole)
  const title       = TITLES[location.pathname] || 'ReconX'
  const userName    = ROLE_USERS[activeRole] ?? activeRole

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-header" style={{ padding: '14px 16px', gap: 8 }}>
          <span
            className="sidebar-logo"
            style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#06B6D4',
              background: 'none',
              WebkitBackgroundClip: 'unset',
              WebkitTextFillColor: '#06B6D4',
            }}
          >
            RECONX
          </span>
          <span
            className="sidebar-version"
            style={{
              fontSize: 9,
              color: '#475569',
              background: 'none',
              padding: '1px 0',
              fontWeight: 500,
              letterSpacing: '0.04em',
            }}
          >
            v1.0
          </span>
        </div>

        {/* Navigation */}
        <nav>
          <div className="nav-section-label" style={{ paddingTop: 14 }}>Reconciliation</div>
          <ul className="nav-list" style={{ padding: '8px 8px' }}>
            {NAV_ITEMS.map(item => (
              <li key={item.to} className="nav-item" style={{ marginBottom: 1 }}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  end={item.to === '/'}
                  style={{ gap: 9, padding: '7px 12px', fontSize: 12 }}
                >
                  <item.icon
                    className="nav-icon"
                    style={{ width: 16, height: 16 }}
                  />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Active Contexts — abbreviated dots */}
        <div style={{ padding: '0 8px 10px', marginTop: 'auto' }}>
          <div className="nav-section-label" style={{ paddingTop: 10, paddingBottom: 4 }}>
            Active Contexts
          </div>
          {contexts.map(ctx => (
            <div
              key={ctx.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '4px 12px',
                fontSize: 11,
                color: 'var(--text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span className={`health-dot ${ctx.healthStatus.toLowerCase()}`} />
              <span style={{ fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                {abbrev(ctx.counterparty)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {ctx.matchRate}%
              </span>
            </div>
          ))}
        </div>

        {/* Role indicator */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: ROLE_DOT[activeRole] ?? '#94a3b8',
            flexShrink: 0,
            boxShadow: `0 0 5px ${ROLE_DOT[activeRole] ?? '#94a3b8'}`,
          }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {activeRole}
          </span>
          <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>
            {userName.split(' ')[1]}
          </span>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        {/* Health Bar */}
        <div
          className="health-bar"
          style={{ height: 30, padding: '0 20px', gap: 0 }}
        >
          {contexts.map(ctx => {
            const exc = Math.floor(ctx.totalItems * (100 - ctx.matchRate) / 100)
            const excColor = ctx.matchRate < 95 ? 'var(--warning)' : 'var(--text-muted)'
            return (
              <div
                key={ctx.id}
                className="health-item"
                style={{ gap: 6, padding: '0 14px' }}
              >
                <span className={`health-dot ${ctx.healthStatus.toLowerCase()}`} />
                <span className="health-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#cbd5e1' }}>
                  {abbrev(ctx.counterparty)}
                </span>
                <span className="health-value" style={{ fontSize: 11 }}>
                  {ctx.matchRate}%
                </span>
                <span style={{ fontSize: 10, color: excColor, marginLeft: 2 }}>
                  ({exc} exc)
                </span>
              </div>
            )
          })}

          {/* Right side: user + clock */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>
              {userName}
            </span>
            <UtcClock />
          </div>
        </div>

        {/* Top Bar */}
        <div className="top-bar" style={{ padding: '10px 24px' }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px' }}>{title}</h1>
          <div className="top-bar-right">
            <div
              className="role-toggle"
              style={{
                borderRadius: 4,
                padding: 2,
                gap: 2,
                background: 'rgba(15,17,23,0.7)',
              }}
            >
              {(['ANALYST', 'SUPERVISOR'] as const).map(role => (
                <button
                  key={role}
                  className={`role-btn ${activeRole === role ? 'active' : ''}`}
                  onClick={() => setActiveRole(role)}
                  style={{
                    borderRadius: 3,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    ...(activeRole === role
                      ? { background: '#06B6D4', color: '#0f1117' }
                      : {}),
                  }}
                >
                  {role === 'ANALYST' ? 'Analyst' : 'Supervisor'}
                </button>
              ))}
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
