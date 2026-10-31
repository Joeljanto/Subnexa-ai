import { useEffect, useState } from 'react'
import TopBar from '../components/layout/TopBar'
import Card from '../components/ui/Card'
import Badge, { statusVariant } from '../components/ui/Badge'
import api from '../lib/api'

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/api/billing/invoices')
      .then((r) => setInvoices(r.data.invoices ?? []))
      .catch((err) => console.error('Failed to load invoices:', err))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="min-h-full pb-16 apple-animate-in">
      <TopBar title="Billing & Invoices" subtitle={`${invoices.length} invoices generated across active billing cycles`} />
      <div className="p-5 sm:p-6 max-w-[1500px] mx-auto">
        <Card title="Invoice Statements" subtitle="Comprehensive receivables register and payment reconciliation log">
          {isLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-[#f5f5f7] animate-pulse" />)}</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#86868b]">No invoices generated yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-left">
                    {['Invoice Reference', 'Billed Amount', 'Cleared Amount', 'Payment State', 'Due By'].map((h) => (
                      <th key={h} className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f7]">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#f5f5f7]/70 transition-colors group">
                      <td className="py-3.5 pr-4 font-mono text-xs font-semibold text-[#1d1d1f]">{inv.invoice_number}</td>
                      <td className="py-3.5 pr-4 font-mono font-semibold text-[#1d1d1f]">${inv.amount_due.toLocaleString()}</td>
                      <td className="py-3.5 pr-4 font-mono font-semibold text-[#34c759]">${inv.amount_paid.toLocaleString()}</td>
                      <td className="py-3.5 pr-4"><Badge label={inv.status} variant={statusVariant(inv.status)} /></td>
                      <td className="py-3.5 pr-4 text-xs text-[#86868b]">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
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
