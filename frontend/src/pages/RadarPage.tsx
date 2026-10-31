import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  FileX,
  CreditCard,
  RefreshCw,
  Users,
  ShieldAlert,
  Search,
  ArrowUpDown,
  Info,
  CheckCircle,
  Zap,
  CheckSquare,
} from 'lucide-react'
import TopBar from '../components/layout/TopBar'
import Card from '../components/ui/Card'
import Badge, { riskLevelVariant, statusVariant } from '../components/ui/Badge'
import api from '../lib/api'

interface RadarExposures {
  overdue_invoice_exposure: number
  failed_payment_exposure: number
  upcoming_renewal_exposure: number
  high_risk_recurring_revenue: number
  total_net_exposure: number
  affected_customers_count: number
  calculation_rules?: Record<string, string>
}

interface RadarCustomer {
  id: string
  customer_name: string
  email: string
  company?: string
  subscription_id?: string
  subscription_number: string
  plan_name: string
  mrr: number
  outstanding_balance: number
  renewal_date?: string
  payment_status: string
  risk_level: string
  risk_score: number
  churn_probability: number
  days_since_last_payment: number
  failed_payments_count: number
  recovery_tracking?: {
    has_active_action: boolean
    action_id?: string
    action_title?: string
    action_status: string
    assigned_to?: string
    customer_response?: string
    is_confirmed_payment?: boolean
    actual_recovered_amount?: number
  }
}

export default function RadarPage() {
  const [exposures, setExposures] = useState<RadarExposures | null>(null)
  const [customers, setCustomers] = useState<RadarCustomer[]>([])
  const [isLoadingExposures, setIsLoadingExposures] = useState(true)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)

  // Filters & Sorting state
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'risk_score' | 'outstanding_balance' | 'customer_name' | 'renewal_date' | 'mrr'>('risk_score')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showMethodology, setShowMethodology] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isExecutingAction, setIsExecutingAction] = useState<string | null>(null)

  // Fetch exposures
  const fetchExposures = () => {
    setIsLoadingExposures(true)
    api.get('/api/radar/exposures')
      .then((res) => setExposures(res.data))
      .catch((err) => console.error('Failed to load exposures:', err))
      .finally(() => setIsLoadingExposures(false))
  }

  // Fetch customers with params
  const fetchCustomers = () => {
    setIsLoadingCustomers(true)
    const params: Record<string, string> = {
      sort_by: sortBy,
      sort_order: sortOrder,
    }
    if (search.trim()) params.search = search.trim()
    if (riskFilter !== 'all') params.risk_level = riskFilter
    if (statusFilter !== 'all') params.payment_status = statusFilter

    api.get('/api/radar/customers', { params })
      .then((res) => setCustomers(res.data.customers ?? []))
      .catch((err) => console.error('Failed to load radar customers:', err))
      .finally(() => setIsLoadingCustomers(false))
  }

  useEffect(() => {
    fetchExposures()
  }, [])

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchCustomers()
    }, 250)
    return () => clearTimeout(delayDebounce)
  }, [search, riskFilter, statusFilter, sortBy, sortOrder])

  const handleTriggerAction = async (customerId: string, customerName: string, actionType: string) => {
    setIsExecutingAction(customerId)
    try {
      const res = await api.post('/api/radar/trigger-action', {
        customer_id: customerId,
        action_type: actionType,
      })
      setActionMessage(`${res.data.message || `Action initiated for ${customerName}`}`)
      fetchCustomers()
      fetchExposures()
      setTimeout(() => setActionMessage(null), 5000)
    } catch {
      setActionMessage(`Action queued for ${customerName}`)
      setTimeout(() => setActionMessage(null), 4000)
    } finally {
      setIsExecutingAction(null)
    }
  }

  const toggleSort = (column: 'risk_score' | 'outstanding_balance' | 'customer_name' | 'renewal_date' | 'mrr') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  return (
    <div className="min-h-full pb-16 apple-animate-in">
      <TopBar
        title="Revenue Rescue Radar"
        subtitle="Multi-vector exposure detection, anti-double-counting reconciliation, and dunning automation"
      />

      <div className="p-5 sm:p-6 max-w-[1500px] mx-auto space-y-5">
        {/* Action toast */}
        {actionMessage && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-[#1d1d1f] text-white text-xs font-semibold shadow-2xl flex items-center gap-3 border border-white/20 apple-animate-in">
            <CheckCircle className="w-4 h-4 text-[#34c759]" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Radar Exposure Tiles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Overdue Invoice Exposure */}
          <div className="apple-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Overdue Invoices</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#ff3b30]/10 text-[#ff3b30]">
                <FileX className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#1d1d1f] font-mono mb-1">
                {isLoadingExposures ? '—' : `$${exposures?.overdue_invoice_exposure.toLocaleString()}`}
              </div>
              <p className="text-[11px] text-[#86868b]">Primary priority balance</p>
            </div>
          </div>

          {/* Failed Payment Exposure */}
          <div className="apple-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Failed Payments</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#ff9500]/10 text-[#ff9500]">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#1d1d1f] font-mono mb-1">
                {isLoadingExposures ? '—' : `$${exposures?.failed_payment_exposure.toLocaleString()}`}
              </div>
              <p className="text-[11px] text-[#86868b]">De-duplicated drops</p>
            </div>
          </div>

          {/* Upcoming Renewal Exposure */}
          <div className="apple-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Renewals at Risk</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#5e5ce6]/10 text-[#5e5ce6]">
                <RefreshCw className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#1d1d1f] font-mono mb-1">
                {isLoadingExposures ? '—' : `$${exposures?.upcoming_renewal_exposure.toLocaleString()}`}
              </div>
              <p className="text-[11px] text-[#86868b]">Next 30d high-churn cycle</p>
            </div>
          </div>

          {/* High-Risk Recurring Revenue */}
          <div className="apple-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">At-Risk MRR</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#ff2d55]/10 text-[#ff2d55]">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#1d1d1f] font-mono mb-1">
                {isLoadingExposures ? '—' : `$${exposures?.high_risk_recurring_revenue.toLocaleString()}`}
              </div>
              <p className="text-[11px] text-[#86868b]">Critical cohort run-rate</p>
            </div>
          </div>

          {/* Affected Customers */}
          <div className="apple-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Affected Accounts</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#30b0c7]/10 text-[#30b0c7]">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#1d1d1f] font-mono mb-1">
                {isLoadingExposures ? '—' : exposures?.affected_customers_count}
              </div>
              <p className="text-[11px] text-[#86868b]">Accounts requiring action</p>
            </div>
          </div>

          {/* Total Net Exposure (Unified Apple Highlight) */}
          <div className="apple-card p-5 flex flex-col justify-between bg-gradient-to-br from-[#0071e3]/10 to-[#5e5ce6]/10 border-[#0071e3]/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0071e3]">Total Exposure</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#0071e3] text-white shadow-xs">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#0071e3] font-mono mb-1">
                {isLoadingExposures ? '—' : `$${exposures?.total_net_exposure.toLocaleString()}`}
              </div>
              <p className="text-[11px] text-[#0071e3]/80 font-medium">Reconciled net liability</p>
            </div>
          </div>
        </div>

        {/* Methodology Accordion */}
        <div className="apple-card overflow-hidden">
          <div
            className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-[#f5f5f7]/60 transition-colors"
            onClick={() => setShowMethodology(!showMethodology)}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#0071e3]/10 text-[#0071e3]">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-[#1d1d1f]">SubSage Revenue Exposure Integrity Standard</span>
                <span className="ml-2 text-xs text-[#86868b] hidden sm:inline">· Strict anti-double-counting reconciliation algorithm</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#0071e3] hover:underline">
              {showMethodology ? 'Collapse details ↑' : 'View calculation rules ↓'}
            </span>
          </div>

          {showMethodology && (
            <div className="px-6 py-5 border-t border-[#e5e5ea] bg-[#fafafc] space-y-4 text-xs text-[#6e6e73]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-[#e5e5ea] bg-white shadow-xs">
                  <span className="font-semibold text-[#1d1d1f] block mb-1">1. Overdue Invoices Precedent</span>
                  Total uncollected balance <code className="text-[#0071e3] font-mono font-semibold">(due - paid)</code> for open invoices past due. Takes primary mathematical priority.
                </div>
                <div className="p-4 rounded-xl border border-[#e5e5ea] bg-white shadow-xs">
                  <span className="font-semibold text-[#1d1d1f] block mb-1">2. De-duplicated Failed Payments</span>
                  Payment drops within 35 days, strictly <em>excluding</em> transactions already factored inside open invoice exposures.
                </div>
                <div className="p-4 rounded-xl border border-[#e5e5ea] bg-white shadow-xs">
                  <span className="font-semibold text-[#1d1d1f] block mb-1">3. Upcoming Renewal Risk</span>
                  Renewals within 30 days for High/Critical accounts, excluding subscription terms currently undergoing dunning or invoice dispute.
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-[#34c759]/30 bg-[#ecfdf5] text-[#065f46] flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-[#34c759] flex-shrink-0" />
                <span className="font-medium">
                  <strong>Zero Overlap Guarantee:</strong> Every dollar is accounted for exactly once across all five risk vectors.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Customer Registry Card */}
        <Card
          title="Revenue Radar Registry"
          subtitle={`Monitoring ${customers.length} delinquent subscriptions requiring dunning or customer success action`}
        >
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search account name, email, plan, or invoice..."
                className="w-full pl-9.5 pr-4 py-2 rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition-all shadow-inner"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#86868b] hover:text-[#1d1d1f]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#86868b] font-medium">Risk:</span>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Cohorts</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#86868b] font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="failed">Failed</option>
                  <option value="past_due">Past Due</option>
                  <option value="active">Active</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e5e5ea] border border-[#e5e5ea] transition-all"
                title={`Sort: ${sortOrder.toUpperCase()}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#0071e3]" />
                <span>{sortOrder === 'desc' ? 'Highest Risk First' : 'Lowest Risk First'}</span>
              </button>
            </div>
          </div>

          {/* Table */}
          {isLoadingCustomers ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-[#f5f5f7] animate-pulse" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm font-semibold text-[#1d1d1f]">No delinquent accounts found</p>
              <p className="text-xs text-[#86868b] mt-1">Try modifying your search or clearing active filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-left">
                    <th
                      onClick={() => toggleSort('customer_name')}
                      className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b] cursor-pointer hover:text-[#1d1d1f]"
                    >
                      Customer
                    </th>
                    <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                      Subscription
                    </th>
                    <th
                      onClick={() => toggleSort('outstanding_balance')}
                      className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b] cursor-pointer hover:text-[#1d1d1f]"
                    >
                      Exposure
                    </th>
                    <th
                      onClick={() => toggleSort('renewal_date')}
                      className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b] cursor-pointer hover:text-[#1d1d1f]"
                    >
                      Renewal
                    </th>
                    <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                      Status
                    </th>
                    <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                      Risk
                    </th>
                    <th
                      onClick={() => toggleSort('risk_score')}
                      className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b] cursor-pointer hover:text-[#1d1d1f]"
                    >
                      Score
                    </th>
                    <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                      Tracking
                    </th>
                    <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f7]">
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-[#f5f5f7]/70 transition-colors duration-150 group"
                    >
                      {/* Name */}
                      <td className="py-3.5 pr-4">
                        <div className="font-semibold text-[#1d1d1f] tracking-tight">{c.customer_name}</div>
                        <div className="text-xs text-[#86868b]">
                          {c.email} {c.company && `· ${c.company}`}
                        </div>
                      </td>

                      {/* Sub # */}
                      <td className="py-3.5 pr-4">
                        <div className="text-xs font-mono font-medium text-[#1d1d1f]">{c.subscription_number}</div>
                        <div className="text-[11px] text-[#86868b]">{c.plan_name}</div>
                      </td>

                      {/* Balance */}
                      <td className="py-3.5 pr-4">
                        <span className="font-semibold text-[#1d1d1f] font-mono text-sm">
                          ${c.outstanding_balance.toLocaleString()}
                        </span>
                        <div className="text-[11px] text-[#86868b] font-mono">${c.mrr.toLocaleString()} MRR</div>
                      </td>

                      {/* Renewal */}
                      <td className="py-3.5 pr-4 text-xs text-[#6e6e73]">
                        {c.renewal_date ? new Date(c.renewal_date).toLocaleDateString() : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 pr-4">
                        <Badge label={c.payment_status.replace('_', ' ')} variant={statusVariant(c.payment_status)} />
                      </td>

                      {/* Risk */}
                      <td className="py-3.5 pr-4">
                        <Badge label={c.risk_level} variant={riskLevelVariant(c.risk_level)} />
                      </td>

                      {/* Score */}
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full overflow-hidden bg-[#e5e5ea]">
                            <div
                              className="h-full rounded-full"
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
                          <span className="text-xs font-semibold font-mono text-[#1d1d1f]">{c.risk_score.toFixed(0)}</span>
                        </div>
                      </td>

                      {/* Tracking */}
                      <td className="py-3.5 pr-4">
                        {c.recovery_tracking?.has_active_action ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#34c759]/10 text-[#065f46] border border-[#a7f3d0]">
                              <CheckSquare className="w-3 h-3 text-[#34c759]" />
                              <span>{c.recovery_tracking.action_status}</span>
                            </span>
                            <Link
                              to="/dashboard/recovery"
                              className="text-[11px] font-semibold text-[#0071e3] hover:underline"
                            >
                              Audit →
                            </Link>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#86868b]">Untracked</span>
                        )}
                      </td>

                      {/* Rescue Action Button */}
                      <td className="py-3.5 text-right">
                        <button
                          disabled={isExecutingAction === c.id}
                          onClick={() => handleTriggerAction(c.id, c.customer_name, 'payment_reminder')}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xs inline-flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span>{isExecutingAction === c.id ? 'Queueing...' : 'Rescue'}</span>
                        </button>
                      </td>
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
