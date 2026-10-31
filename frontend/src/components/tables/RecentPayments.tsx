import Badge, { statusVariant } from '../ui/Badge'
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'

interface Payment {
  id: string
  customer_id: string
  amount: number
  currency: string
  status: string
  method: string
  description?: string
  created_at: string
}

interface Props {
  payments: Payment[]
  isLoading?: boolean
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function RecentPayments({ payments, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-[#f5f5f7] animate-pulse" />
        ))}
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm font-medium text-[#1d1d1f]">No transactions recorded</p>
        <p className="text-xs text-[#86868b] mt-1">Cleared transactions appear here automatically.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {payments.map((p) => {
        const isSuccess = p.status === 'succeeded'
        return (
          <div
            key={p.id}
            className="flex items-center justify-between p-3.5 rounded-xl border border-[#e5e5ea]/60 bg-[#ffffff] hover:border-[#0071e3]/30 hover:shadow-xs transition-all duration-200 group"
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                  isSuccess
                    ? 'bg-[#34c759]/10 text-[#34c759]'
                    : 'bg-[#ff3b30]/10 text-[#ff3b30]'
                }`}
              >
                {isSuccess ? (
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-[#1d1d1f] tracking-tight">
                  {p.description || `Transaction #${p.id.slice(0, 8)}`}
                </div>
                <div className="text-[11px] text-[#86868b] mt-0.5">
                  <span className="capitalize">{p.method.replace('_', ' ')}</span>
                  <span className="mx-1.5">·</span>
                  <span>{p.created_at ? timeAgo(p.created_at) : '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <Badge label={p.status} variant={statusVariant(p.status)} />
              <span
                className={`text-sm font-semibold font-mono tracking-tight ${
                  isSuccess ? 'text-[#1d1d1f]' : 'text-[#ff3b30]'
                }`}
              >
                {p.status === 'refunded' ? '-' : ''}${p.amount.toLocaleString()}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
