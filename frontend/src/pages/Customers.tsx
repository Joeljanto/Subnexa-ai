import { useEffect, useState } from 'react'
import TopBar from '../components/layout/TopBar'
import Card from '../components/ui/Card'
import Badge, { statusVariant } from '../components/ui/Badge'
import api from '../lib/api'

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/api/customers/')
      .then((r) => setCustomers(r.data.customers ?? []))
      .catch((err) => console.error('Failed to load customers:', err))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="min-h-full pb-16 apple-animate-in">
      <TopBar title="Customers Directory" subtitle={`${customers.length} total monitored business accounts`} />
      <div className="p-5 sm:p-6 max-w-[1500px] mx-auto">
        <Card title="Customer Accounts Ledger" subtitle="Complete registry of subscribers and contractual billing commitments">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-[#f5f5f7] animate-pulse" />)}
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#86868b]">No customer accounts registered yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-left">
                    {['Customer Account', 'Email Address', 'Company Entity', 'Monthly Revenue', 'Account State', 'Registered On'].map((h) => (
                      <th key={h} className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f7]">
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-[#f5f5f7]/70 transition-colors group"
                    >
                      <td className="py-3.5 pr-4 font-semibold text-[#1d1d1f] tracking-tight">{c.name}</td>
                      <td className="py-3.5 pr-4 text-xs text-[#6e6e73]">{c.email}</td>
                      <td className="py-3.5 pr-4 text-xs text-[#6e6e73]">{c.company || '—'}</td>
                      <td className="py-3.5 pr-4 text-sm font-semibold text-[#1d1d1f] font-mono">${c.mrr.toLocaleString()}</td>
                      <td className="py-3.5 pr-4"><Badge label={c.status.replace('_', ' ')} variant={statusVariant(c.status)} /></td>
                      <td className="py-3.5 pr-4 text-xs text-[#86868b]">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
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
