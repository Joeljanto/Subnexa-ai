import { useEffect, useState } from 'react'
import TopBar from '../components/layout/TopBar'
import Card from '../components/ui/Card'
import Badge, { statusVariant } from '../components/ui/Badge'
import api from '../lib/api'

export default function Subscriptions() {
  const [subs, setSubs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/api/subscriptions/')
      .then((r) => setSubs(r.data.subscriptions ?? []))
      .catch((err) => console.error('Failed to load subscriptions:', err))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="min-h-full pb-16 apple-animate-in">
      <TopBar title="Active Subscriptions" subtitle={`${subs.length} recurring SaaS plans under active management`} />
      <div className="p-5 sm:p-6 max-w-[1500px] mx-auto">
        <Card title="Subscription Contracts" subtitle="Real-time recurring billing schedules and renewal terms">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-[#f5f5f7] animate-pulse" />)}
            </div>
          ) : subs.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#86868b]">No active subscription contracts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-left">
                    {['Subscription Plan', 'Contract Amount', 'Billing Cadence', 'Lifecycle Status', 'Period Expiration'].map((h) => (
                      <th key={h} className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f7]">
                  {subs.map((s) => (
                    <tr key={s.id} className="hover:bg-[#f5f5f7]/70 transition-colors group">
                      <td className="py-3.5 pr-4 font-semibold text-[#1d1d1f] tracking-tight">{s.plan_name}</td>
                      <td className="py-3.5 pr-4 text-sm font-semibold text-[#1d1d1f] font-mono">${s.amount.toLocaleString()}</td>
                      <td className="py-3.5 pr-4 text-xs capitalize text-[#6e6e73]">{s.billing_interval}</td>
                      <td className="py-3.5 pr-4"><Badge label={s.status.replace('_', ' ')} variant={statusVariant(s.status)} /></td>
                      <td className="py-3.5 pr-4 text-xs text-[#86868b]">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
