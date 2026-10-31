import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Radar,
  AlertTriangle,
  FlaskConical,
  CheckSquare,
  Users,
  CreditCard,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: Radar, label: 'Revenue Rescue', to: '/dashboard/radar' },
  { icon: AlertTriangle, label: 'Risk Engine', to: '/dashboard/risk' },
  { icon: FlaskConical, label: 'What-if Simulator', to: '/dashboard/simulator' },
  { icon: CheckSquare, label: 'Recovery Tracker', to: '/dashboard/recovery' },
  { type: 'divider' },
  { icon: Users, label: 'Customers', to: '/dashboard/customers' },
  { icon: CreditCard, label: 'Subscriptions', to: '/dashboard/subscriptions' },
  { icon: FileText, label: 'Reports', to: '/dashboard/invoices' },
  { type: 'divider' },
  { icon: Settings, label: 'Settings', to: '/dashboard/settings' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="flex flex-col h-screen w-64 flex-shrink-0 border-r border-[#e5e5ea] bg-[#f5f5f7]/90 backdrop-blur-xl">
      {/* Brand Header */}
      <div className="flex items-center px-5 py-5 border-b border-[#e5e5ea]/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-tr from-[#0071e3] to-[#5e5ce6] text-white shadow-sm font-black text-sm">
            ⚡
          </div>
          <div>
            <div className="text-base font-bold text-[#1d1d1f] tracking-tight flex items-center gap-1.5">
              <span>SubNexa</span>
              <span className="text-[#0071e3]">AI</span>
            </div>
            <div className="text-[11px] text-[#86868b] font-medium tracking-tight">Revenue Rescue Platform</div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {navItems.map((item, i) => {
          if (item.type === 'divider') {
            return <div key={i} className="my-2.5 border-t border-[#e5e5ea]/80 mx-2" />
          }
          const Icon = item.icon!
          return (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-white text-[#0071e3] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.03)] border border-[#e5e5ea]'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/60'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 tracking-tight">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-[#e5e5ea]/80 p-3 bg-white/50 backdrop-blur-md">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 border border-[#e5e5ea]/70 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-xs bg-gradient-to-tr from-[#0071e3] to-[#5e5ce6]">
              {(user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[#1d1d1f] truncate">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email}
              </div>
              <div className="text-[11px] capitalize text-[#86868b] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse" />
                <span className="font-medium text-[#6e6e73]">{user?.role || 'Staff'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
