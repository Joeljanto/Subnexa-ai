import { useAuth } from '../contexts/AuthContext'
import TopBar from '../components/layout/TopBar'
import Card from '../components/ui/Card'

export default function Settings() {
  const { user } = useAuth()

  return (
    <div className="min-h-full pb-16 apple-animate-in">
      <TopBar title="Settings & Preferences" subtitle="Manage profile, SubSage intelligence engine, and platform integrations" />

      <div className="p-5 sm:p-6 max-w-[1500px] mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title="User Account Profile" subtitle="Active credentials and organization identity">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-sm bg-gradient-to-tr from-[#0071e3] to-[#5e5ce6]"
              >
                {(user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-[#1d1d1f] text-base">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Alex Vance'}
                </div>
                <div className="text-xs text-[#6e6e73] mt-0.5">{user?.email}</div>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
                  <span>{user?.role}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="SubSage Intelligence Engine" subtitle="Inference runtime and feature attribution configuration">
            <div className="space-y-3 text-xs">
              {[
                { label: 'Engine Architecture', value: 'SubSage v2.4 (Interpretable Gradient Attribution)' },
                { label: 'ML Framework', value: 'Python 3.13 / Scikit-Learn 1.6' },
                { label: 'Fallback Logic', value: 'Audited Deterministic Rules (No Fabricated Accuracy)' },
                { label: 'Radar Sync Cadence', value: 'Real-Time / Continuous Event Dunning' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-[#f2f2f7] last:border-0">
                  <span className="text-[#6e6e73]">{item.label}</span>
                  <span className="text-[#1d1d1f] font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Deployment Environment" subtitle="Active services and persistent storage parameters">
            <div className="space-y-3 text-xs">
              {[
                { label: 'REST API Endpoint', value: 'http://127.0.0.1:5000' },
                { label: 'Database Engine', value: 'SQLite 3 (subnexa.db)' },
                { label: 'Security & Token', value: 'HMAC-SHA256 JWT (3600s Expiry)' },
                { label: 'Google Identity Services', value: 'OAuth 2.0 Web Client' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-[#f2f2f7] last:border-0">
                  <span className="text-[#6e6e73]">{item.label}</span>
                  <span className="font-mono text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] px-2 py-0.5 rounded-md">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
