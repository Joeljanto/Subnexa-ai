import { useState, useEffect } from 'react'
import {
  CheckCircle2,
  History,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import TopBar from '../components/layout/TopBar'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import api from '../lib/api'

interface ComparisonSummary {
  initial_revenue_at_risk: number
  simulated_recovery: number
  actual_collected_recovery: number
  intervention_costs: number
  net_recovered_revenue: number
  realization_rate: number
}

interface ActionCounts {
  total_actions: number
  completed: number
  in_progress: number
  assigned: number
}

interface RecoveryComparisonResponse {
  summary: ComparisonSummary
  counts: ActionCounts
  accounting_rule: string
}

interface RecoveryActionItem {
  id: string
  customer_id: string
  customer_name: string
  customer_email?: string
  customer_company?: string
  subscription_id?: string
  action_type: string
  title: string
  description?: string
  assigned_to?: string
  status: 'assigned' | 'in_progress' | 'completed' | 'failed'
  customer_response: string
  customer_response_notes?: string
  responded_at?: string
  initial_revenue_at_risk: number
  simulated_recovery_amount: number
  actual_recovered_amount: number
  is_confirmed_payment: boolean
  intervention_costs: number
  net_recovered_revenue: number
  recovery_date?: string
  created_at: string
}

interface AuditLogItem {
  id: string
  action_id: string
  actor_email: string
  event_type: string
  old_value?: string
  new_value?: string
  notes?: string
  metadata?: Record<string, any>
  created_at: string
}

export default function RecoveryTracking() {
  const [comparison, setComparison] = useState<RecoveryComparisonResponse | null>(null)
  const [actions, setActions] = useState<RecoveryActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState<RecoveryActionItem | null>(null)
  const [showResponseModal, setShowResponseModal] = useState<RecoveryActionItem | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState<RecoveryActionItem | null>(null)
  const [showAuditModal, setShowAuditModal] = useState<RecoveryActionItem | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  // Form states
  const [customersList, setCustomersList] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [assignActionType, setAssignActionType] = useState('payment_reminder')
  const [assignTitle, setAssignTitle] = useState('')
  const [assignDescription, setAssignDescription] = useState('')
  const [assignSimulatedAmount, setAssignSimulatedAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Response Form
  const [responseStatus, setResponseStatus] = useState('promised_to_pay')
  const [responseNotes, setResponseNotes] = useState('')

  // Status Change Form
  const [newStatus, setNewStatus] = useState<'assigned' | 'in_progress' | 'completed' | 'failed'>('in_progress')
  const [statusNotes, setStatusNotes] = useState('')

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentCosts, setPaymentCosts] = useState('0')
  const [isConfirmedPayment, setIsConfirmedPayment] = useState(true)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotes, setPaymentNotes] = useState('')

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [compRes, actRes] = await Promise.all([
        api.get('/api/recovery/comparison'),
        api.get('/api/recovery/actions', {
          params: statusFilter !== 'all' ? { status: statusFilter } : {},
        }),
      ])
      setComparison(compRes.data)
      setActions(actRes.data.actions || [])
    } catch (err) {
      console.error('Failed to load recovery data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])

  // Load customer options for Assign Modal
  useEffect(() => {
    if (showAssignModal) {
      api.get('/api/radar/customers')
        .then((res) => {
          setCustomersList(res.data.customers || [])
          if (res.data.customers && res.data.customers.length > 0 && !selectedCustomer) {
            const first = res.data.customers[0]
            setSelectedCustomer(first.id)
            const simulated = Math.round((first.outstanding_balance || first.mrr || 100) * 0.45)
            setAssignSimulatedAmount(simulated.toString())
          }
        })
        .catch((err) => console.error('Failed to load customers for modal:', err))
    }
  }, [showAssignModal])

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomer(customerId)
    const cust = customersList.find((c) => c.id === customerId)
    if (cust) {
      const simulated = Math.round((cust.outstanding_balance || cust.mrr || 100) * 0.45)
      setAssignSimulatedAmount(simulated.toString())
    }
  }

  const handleAssignAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) return
    setSubmitting(true)
    try {
      await api.post('/api/recovery/actions', {
        customer_id: selectedCustomer,
        action_type: assignActionType,
        title: assignTitle || `${assignActionType.replace('_', ' ')} campaign`,
        description: assignDescription,
        simulated_recovery_amount: parseFloat(assignSimulatedAmount) || 0,
      })
      showToast('Recovery action assigned and audit log recorded.')
      setShowAssignModal(false)
      setAssignTitle('')
      setAssignDescription('')
      loadData()
    } catch (err) {
      showToast('Failed to assign recovery action')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showStatusModal) return
    setSubmitting(true)
    try {
      await api.patch(`/api/recovery/actions/${showStatusModal.id}/status`, {
        status: newStatus,
        notes: statusNotes,
      })
      showToast(`Action status advanced to "${newStatus}"`)
      setShowStatusModal(null)
      setStatusNotes('')
      loadData()
    } catch (err) {
      showToast('Failed to update status')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecordResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showResponseModal) return
    setSubmitting(true)
    try {
      await api.post(`/api/recovery/actions/${showResponseModal.id}/response`, {
        response_status: responseStatus,
        notes: responseNotes,
      })
      showToast('Customer response and notes recorded in audit trail.')
      setShowResponseModal(null)
      setResponseNotes('')
      loadData()
    } catch (err) {
      showToast('Failed to record customer response')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showPaymentModal) return
    setSubmitting(true)
    try {
      await api.post(`/api/recovery/actions/${showPaymentModal.id}/record-payment`, {
        amount: parseFloat(paymentAmount) || 0,
        intervention_costs: parseFloat(paymentCosts) || 0,
        is_confirmed_payment: isConfirmedPayment,
        recovery_date: paymentDate,
        notes: paymentNotes,
      })
      showToast(isConfirmedPayment ? 'Confirmed collected payment verified & credited!' : 'Unconfirmed payment logged (uncredited).')
      setShowPaymentModal(null)
      setPaymentAmount('')
      setPaymentCosts('0')
      setPaymentNotes('')
      loadData()
    } catch (err) {
      showToast('Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenAudit = async (action: RecoveryActionItem) => {
    setShowAuditModal(action)
    setAuditLoading(true)
    try {
      const res = await api.get(`/api/recovery/actions/${action.id}/audit`)
      setAuditLogs(res.data.audit_trail || [])
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setAuditLoading(false)
    }
  }

  const filteredActions = actions.filter((a) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.customer_name?.toLowerCase().includes(q) ||
      a.title?.toLowerCase().includes(q) ||
      a.customer_company?.toLowerCase().includes(q) ||
      a.customer_email?.toLowerCase().includes(q)
    )
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge label="Completed" variant="success" />
      case 'in_progress':
        return <Badge label="In Progress" variant="violet" />
      case 'assigned':
        return <Badge label="Assigned" variant="info" />
      case 'failed':
        return <Badge label="Failed" variant="danger" />
      default:
        return <Badge label={status} variant="muted" />
    }
  }

  const getResponseBadge = (resp: string) => {
    switch (resp) {
      case 'promised_to_pay':
        return <Badge label="Promised to Pay" variant="info" />
      case 'paid_in_full':
        return <Badge label="Paid in Full" variant="success" />
      case 'requested_discount':
        return <Badge label="Requested Discount" variant="violet" />
      case 'updated_payment_method':
        return <Badge label="Updated Method" variant="info" />
      case 'disputed':
        return <Badge label="Disputed" variant="warning" />
      case 'declined':
        return <Badge label="Declined" variant="danger" />
      case 'unresponsive':
      case 'none':
        return <Badge label="Awaiting Response" variant="muted" />
      default:
        return <Badge label={resp.replace(/_/g, ' ')} variant="muted" />
    }
  }

  return (
    <div className="min-h-full pb-16 apple-animate-in">
      <TopBar
        title="Recovery Tracking & Audit"
        subtitle="Staff action management, verifiable collected revenue, and immutable audit trails"
      />

      <div className="p-5 sm:p-6 max-w-[1500px] mx-auto space-y-5">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-[#1d1d1f] text-white text-xs font-semibold shadow-2xl flex items-center gap-3 border border-white/20 apple-animate-in">
            <CheckCircle2 className="w-4 h-4 text-[#34c759]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Strict Accounting Policy Banner */}
        <div className="apple-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-[#34c759]/10 via-white to-[#0071e3]/10">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#34c759]/10 text-[#34c759]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
                Strict Accounting Rule Enforced
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#34c759]/15 text-[#065f46]">
                  Audit Verified
                </span>
              </div>
              <div className="text-xs text-[#6e6e73] mt-0.5">
                Only verified, confirmed collected payments are credited to actual and net recovery metrics. Unconfirmed promises remain strictly segregated from recognized revenue.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 self-end sm:self-auto flex-shrink-0">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#1d1d1f] border border-[#e5e5ea] bg-white hover:bg-[#f5f5f7] transition-all shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Assign Rescue Action</span>
            </button>
          </div>
        </div>

        {/* Comparison KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="apple-card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] mb-1">
              Initial Revenue at Risk
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#ff3b30] font-mono">
              ${comparison ? comparison.summary.initial_revenue_at_risk.toLocaleString() : '—'}
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">Snapshot at assignment</p>
          </div>

          <div className="apple-card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] mb-1">
              Simulated Recovery
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#0071e3] font-mono">
              ${comparison ? comparison.summary.simulated_recovery.toLocaleString() : '—'}
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">Projected model target</p>
          </div>

          <div className="apple-card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] mb-1">
              Actual Collected
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#34c759] font-mono">
              ${comparison ? comparison.summary.actual_collected_recovery.toLocaleString() : '—'}
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">Cleared confirmed payments</p>
          </div>

          <div className="apple-card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] mb-1">
              Intervention Costs
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#ff9500] font-mono">
              ${comparison ? comparison.summary.intervention_costs.toLocaleString() : '—'}
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">Discounts + CS labor</p>
          </div>

          <div className="apple-card p-5 bg-gradient-to-br from-[#34c759]/10 to-white border-[#34c759]/30">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#065f46] mb-1">
              Net Recovered Revenue
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#065f46] font-mono">
              ${comparison ? comparison.summary.net_recovered_revenue.toLocaleString() : '—'}
            </div>
            <p className="text-[11px] text-[#065f46]/80 font-medium mt-1">
              Realization: {comparison ? `${(comparison.summary.realization_rate * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Action Registry Card */}
        <Card
          title="Active Recovery Actions Ledger"
          subtitle={`Tracking ${actions.length} assigned intervention workflows with chronological audit histories`}
        >
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search account, staff member, or action title..."
                className="w-full pl-9.5 pr-4 py-2 rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition-all shadow-inner"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
              {['all', 'assigned', 'in_progress', 'completed', 'failed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    statusFilter === st
                      ? 'bg-white text-[#0071e3] shadow-xs'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-[#f5f5f7] animate-pulse" />
              ))}
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#86868b]">
              No recovery actions match criteria. Click "Assign Rescue Action" to initiate workflow.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-left">
                    <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Account</th>
                    <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Action Plan</th>
                    <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Status</th>
                    <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Customer Response</th>
                    <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Simulated / Confirmed</th>
                    <th className="py-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Net Recovered</th>
                    <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Workflow Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f7]">
                  {filteredActions.map((act) => (
                    <tr key={act.id} className="hover:bg-[#f5f5f7]/70 transition-colors group">
                      <td className="py-3.5 pr-4">
                        <div className="font-semibold text-[#1d1d1f] tracking-tight">{act.customer_name}</div>
                        <div className="text-xs text-[#86868b]">{act.customer_email || '—'}</div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="text-xs font-semibold text-[#1d1d1f]">{act.title}</div>
                        <div className="text-[11px] text-[#86868b] capitalize">{act.action_type.replace('_', ' ')} · Assigned to: {act.assigned_to || 'CS Team'}</div>
                      </td>
                      <td className="py-3.5 pr-4">
                        {getStatusBadge(act.status)}
                      </td>
                      <td className="py-3.5 pr-4">
                        {getResponseBadge(act.customer_response)}
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-xs">
                        <div className="text-[#86868b]">Sim: ${act.simulated_recovery_amount.toLocaleString()}</div>
                        <div className={`font-semibold ${act.is_confirmed_payment ? 'text-[#34c759]' : 'text-[#86868b]'}`}>
                          Collected: ${act.actual_recovered_amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-xs font-bold text-[#1d1d1f]">
                        ${act.net_recovered_revenue.toLocaleString()}
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setShowStatusModal(act)
                              setNewStatus(act.status)
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#0071e3] bg-[#0071e3]/8 hover:bg-[#0071e3] hover:text-white transition-all"
                            title="Update status"
                          >
                            Status
                          </button>
                          <button
                            onClick={() => {
                              setShowResponseModal(act)
                              setResponseStatus(act.customer_response !== 'none' ? act.customer_response : 'promised_to_pay')
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#5e5ce6] bg-[#5e5ce6]/8 hover:bg-[#5e5ce6] hover:text-white transition-all"
                            title="Record feedback"
                          >
                            Response
                          </button>
                          <button
                            onClick={() => {
                              setShowPaymentModal(act)
                              setPaymentAmount(act.actual_recovered_amount > 0 ? act.actual_recovered_amount.toString() : act.simulated_recovery_amount.toString())
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#34c759] bg-[#34c759]/10 hover:bg-[#34c759] hover:text-white transition-all"
                            title="Collect payment"
                          >
                            Collect
                          </button>
                          <button
                            onClick={() => handleOpenAudit(act)}
                            className="p-1 rounded-lg text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
                            title="Audit trail"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm apple-animate-in">
          <div className="apple-card max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">Assign Recommended Rescue Action</h3>
            <p className="text-xs text-[#6e6e73] mb-4">Initializes an action workflow with pre-calculated revenue exposure baselines.</p>
            <form onSubmit={handleAssignAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Select Account</label>
                <select
                  required
                  value={selectedCustomer}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                >
                  {customersList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name} ({c.risk_level.toUpperCase()} - Exposure: ${c.outstanding_balance || c.mrr})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Action Type</label>
                  <select
                    value={assignActionType}
                    onChange={(e) => setAssignActionType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                  >
                    <option value="payment_reminder">Payment Reminder</option>
                    <option value="personal_follow_up">Executive Follow-Up</option>
                    <option value="renewal_reminder">Renewal Reminder</option>
                    <option value="retention_offer">Retention Offer</option>
                    <option value="dunning_retry">Dunning Retry</option>
                    <option value="contact_customer">Success Check-in</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Simulated Recovery ($)</label>
                  <input
                    type="number"
                    value={assignSimulatedAmount}
                    onChange={(e) => setAssignSimulatedAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Action Title</label>
                <input
                  type="text"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  placeholder="e.g. Dunning sequence #3 with updated card link"
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed]"
                >
                  {submitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm apple-animate-in">
          <div className="apple-card max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#1d1d1f] mb-1">Update Action Status</h3>
            <p className="text-xs text-[#86868b] mb-4">{showStatusModal.customer_name} · {showStatusModal.title}</p>
            <form onSubmit={handleStatusChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">New Workflow Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as 'assigned' | 'completed' | 'failed' | 'in_progress')}
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                >
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed / Escalated</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Status Notes</label>
                <textarea
                  rows={3}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Document outreach attempts, agent notes or escalations..."
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed]"
                >
                  {submitting ? 'Saving...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Response Modal */}
      {showResponseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm apple-animate-in">
          <div className="apple-card max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#1d1d1f] mb-1">Record Customer Response</h3>
            <p className="text-xs text-[#86868b] mb-4">{showResponseModal.customer_name} · {showResponseModal.title}</p>
            <form onSubmit={handleRecordResponse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Customer Reaction / Sentiment</label>
                <select
                  value={responseStatus}
                  onChange={(e) => setResponseStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                >
                  <option value="promised_to_pay">Promised to pay within 48h</option>
                  <option value="disputed_charge">Disputed invoice charge</option>
                  <option value="card_expired">Card expired, updating payment method</option>
                  <option value="insufficient_funds">Temporary liquidity / insufficient funds</option>
                  <option value="churn_request">Explicit cancellation request</option>
                  <option value="unresponsive">Unresponsive after outreach</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Call / Email Notes</label>
                <textarea
                  rows={3}
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  placeholder="Key discussion points, customer quote, commitments..."
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResponseModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#5e5ce6] hover:bg-[#524fd6]"
                >
                  {submitting ? 'Recording...' : 'Record Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm apple-animate-in">
          <div className="apple-card max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#1d1d1f] mb-1">Record Actual Payment Collected</h3>
            <p className="text-xs text-[#86868b] mb-4">{showPaymentModal.customer_name} · {showPaymentModal.title}</p>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Collected Amount ($)</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Intervention Costs ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={paymentCosts}
                    onChange={(e) => setPaymentCosts(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Recovery Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isConfirmedPayment}
                    onChange={(e) => setIsConfirmedPayment(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0071e3] focus:ring-0"
                  />
                  <span className="text-xs font-semibold text-[#1d1d1f]">Payment Confirmed & Settled in Bank/Stripe</span>
                </label>
                <p className="text-[11px] text-[#86868b] mt-1 pl-6">
                  Only verified collected payments flow into GAAP recovered metrics and the Radar.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Receipt / Transaction Ref</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Stripe charge ch_3M... or Bank wire ref"
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#34c759] hover:bg-[#30b753]"
                >
                  {submitting ? 'Confirming...' : 'Record & Verify Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm apple-animate-in">
          <div className="apple-card max-w-xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
              <div>
                <h3 className="text-base font-bold text-[#1d1d1f]">Immutable Audit Trail</h3>
                <p className="text-xs text-[#86868b]">{showAuditModal.customer_name} · {showAuditModal.title}</p>
              </div>
              <button
                onClick={() => setShowAuditModal(null)}
                className="text-xs text-[#86868b] hover:text-[#1d1d1f] p-1"
              >
                Close ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {auditLoading ? (
                <div className="text-center py-8 text-xs text-[#86868b]">Loading chronological records...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#86868b]">No audit logs recorded.</div>
              ) : (
                <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e5e5ea]">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="relative">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-[#0071e3] ring-4 ring-white" />
                      <div className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-2">
                        <span>{log.event_type.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-[#86868b] font-normal font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6e6e73] mt-0.5">{log.notes || 'No qualitative notes provided'}</div>
                      <div className="text-[10px] text-[#86868b] font-mono mt-0.5">Actor: {log.actor_email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
