import Badge, { riskLevelVariant, statusVariant } from '../ui/Badge'

interface Customer {
  id: string
  name: string
  email: string
  company?: string
  mrr: number
  risk_score: number
  risk_level: string
  status: string
  churn_probability: number
  failed_payments_count: number
}

interface Props {
  customers: Customer[]
  isLoading?: boolean
}

export default function CustomerRiskTable({ customers, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-[#f5f5f7] animate-pulse" />
        ))}
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm font-medium text-[#1d1d1f]">No accounts detected at risk</p>
        <p className="text-xs mt-1 text-[#86868b]">SubSage is actively monitoring all subscriptions.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e5e5ea] text-left">
            {['Account', 'MRR', 'Risk Score', 'Classification', 'Health', 'Churn Risk', 'Delinquencies'].map((h) => (
              <th key={h} className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f2f2f7]">
          {customers.map((c) => (
            <tr
              key={c.id}
              className="hover:bg-[#f5f5f7]/70 transition-colors duration-150 group"
            >
              <td className="py-3.5 pr-4">
                <div className="font-semibold text-[#1d1d1f] tracking-tight">{c.name}</div>
                <div className="text-xs text-[#86868b]">{c.email}</div>
              </td>
              <td className="py-3.5 pr-4 font-semibold text-[#1d1d1f] font-mono">
                ${c.mrr.toLocaleString()}
              </td>
              <td className="py-3.5 pr-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-20 h-2 rounded-full overflow-hidden bg-[#e5e5ea]/80 p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${c.risk_score}%`,
                        background:
                          c.risk_score > 75
                            ? '#ff3b30'
                            : c.risk_score > 50
                            ? '#ff9500'
                            : c.risk_score > 25
                            ? '#5e5ce6'
                            : '#34c759',
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#1d1d1f] font-mono">{c.risk_score.toFixed(0)}</span>
                </div>
              </td>
              <td className="py-3.5 pr-4">
                <Badge label={c.risk_level} variant={riskLevelVariant(c.risk_level)} />
              </td>
              <td className="py-3.5 pr-4">
                <Badge label={c.status.replace('_', ' ')} variant={statusVariant(c.status)} />
              </td>
              <td className="py-3.5 pr-4 text-xs font-semibold text-[#1d1d1f] font-mono">
                {(c.churn_probability * 100).toFixed(0)}%
              </td>
              <td className="py-3.5 pr-4">
                <span
                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${
                    c.failed_payments_count > 0
                      ? 'bg-[#ff3b30]/10 text-[#ff3b30]'
                      : 'text-[#86868b]'
                  }`}
                >
                  {c.failed_payments_count}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
