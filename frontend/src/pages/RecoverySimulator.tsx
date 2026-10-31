import { useEffect, useState, useMemo } from 'react'
import {
  ShieldCheck,
  Save,
  Trash2,
  CheckCircle,
  Sparkles,
  PhoneCall,
  Mail,
  RefreshCw,
  Gift,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import TopBar from '../components/layout/TopBar'
import Card from '../components/ui/Card'
import api from '../lib/api'

interface SimSummary {
  targeted_customers_count: number
  revenue_at_risk: number
  expected_recovery_rate: number
  estimated_recovered_revenue: number
  discount_costs: number
  operational_costs: number
  total_intervention_costs: number
  estimated_net_recovery: number
  roi_multiple: number
  projected_unrecovered_loss: number
}


interface SavedScenarioItem {
  id: string
  name: string
  description?: string
  created_at?: string
  parameters: Record<string, any>
  projected_net_recovery: number
  expected_recovery_rate: number
  targeted_customers_count: number
}

export default function RecoverySimulator() {
  // Simulator input parameters
  const [cohortFilter, setCohortFilter] = useState<'all' | 'high_critical' | 'critical_only'>('all')
  const [minMrr, setMinMrr] = useState<number>(0)
  const [paymentRemindersEnabled, setPaymentRemindersEnabled] = useState<boolean>(true)
  const [paymentRemindersIntensity, setPaymentRemindersIntensity] = useState<'standard' | 'aggressive'>('aggressive')
  const [personalFollowupEnabled, setPersonalFollowupEnabled] = useState<boolean>(true)
  const [personalFollowupMinMrr, setPersonalFollowupMinMrr] = useState<number>(2500)
  const [renewalRemindersEnabled, setRenewalRemindersEnabled] = useState<boolean>(true)
  const [eligibleDiscountsEnabled, setEligibleDiscountsEnabled] = useState<boolean>(true)
  const [discountPercent, setDiscountPercent] = useState<number>(15)
  const [discountDurationMonths, setDiscountDurationMonths] = useState<number>(3)
  const [customOverrideEnabled, setCustomOverrideEnabled] = useState<boolean>(false)
  const [customRecoveryRate, setCustomRecoveryRate] = useState<number>(45)

  // Simulation output state
  const [summary, setSummary] = useState<SimSummary | null>(null)

  // Saved scenarios state
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioItem[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [scenarioName, setScenarioName] = useState('')
  const [scenarioDesc, setScenarioDesc] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Fetch saved scenarios on load
  const loadSavedScenarios = () => {
    api.get('/api/simulator/scenarios')
      .then((res) => setSavedScenarios(res.data.scenarios ?? []))
      .catch((err) => console.error(err))
  }

  useEffect(() => {
    loadSavedScenarios()
  }, [])

  // Run simulation whenever parameters change
  useEffect(() => {
    const timer = setTimeout(() => {
      const payload: Record<string, any> = {
        cohort_filter: cohortFilter,
        min_mrr: minMrr,
        payment_reminders_enabled: paymentRemindersEnabled,
        payment_reminders_intensity: paymentRemindersIntensity,
        personal_followup_enabled: personalFollowupEnabled,
        personal_followup_min_mrr: personalFollowupMinMrr,
        renewal_reminders_enabled: renewalRemindersEnabled,
        eligible_discounts_enabled: eligibleDiscountsEnabled,
        discount_percent: discountPercent,
        discount_duration_months: discountDurationMonths,
      }
      if (customOverrideEnabled) {
        payload.custom_recovery_rate_override = customRecoveryRate
      }

      api.post('/api/simulator/simulate', payload)
        .then((res) => {
          setSummary(res.data.summary)
        })
        .catch((err) => console.error('Simulation error:', err))
    }, 200)

    return () => clearTimeout(timer)
  }, [
    cohortFilter,
    minMrr,
    paymentRemindersEnabled,
    paymentRemindersIntensity,
    personalFollowupEnabled,
    personalFollowupMinMrr,
    renewalRemindersEnabled,
    eligibleDiscountsEnabled,
    discountPercent,
    discountDurationMonths,
    customOverrideEnabled,
    customRecoveryRate,
  ])

  // Presets
  const applyPreset = (preset: 'aggressive' | 'conservative' | 'balanced' | 'discounts_only') => {
    if (preset === 'aggressive') {
      setCohortFilter('all')
      setMinMrr(0)
      setPaymentRemindersEnabled(true)
      setPaymentRemindersIntensity('aggressive')
      setPersonalFollowupEnabled(true)
      setPersonalFollowupMinMrr(1500)
      setRenewalRemindersEnabled(true)
      setEligibleDiscountsEnabled(true)
      setDiscountPercent(20)
      setDiscountDurationMonths(3)
      setCustomOverrideEnabled(false)
    } else if (preset === 'conservative') {
      setCohortFilter('high_critical')
      setMinMrr(1000)
      setPaymentRemindersEnabled(true)
      setPaymentRemindersIntensity('standard')
      setPersonalFollowupEnabled(true)
      setPersonalFollowupMinMrr(3000)
      setRenewalRemindersEnabled(true)
      setEligibleDiscountsEnabled(false)
      setCustomOverrideEnabled(false)
    } else if (preset === 'balanced') {
      setCohortFilter('all')
      setMinMrr(500)
      setPaymentRemindersEnabled(true)
      setPaymentRemindersIntensity('standard')
      setPersonalFollowupEnabled(true)
      setPersonalFollowupMinMrr(2500)
      setRenewalRemindersEnabled(true)
      setEligibleDiscountsEnabled(true)
      setDiscountPercent(15)
      setDiscountDurationMonths(3)
      setCustomOverrideEnabled(false)
    } else if (preset === 'discounts_only') {
      setPaymentRemindersEnabled(false)
      setPersonalFollowupEnabled(false)
      setRenewalRemindersEnabled(false)
      setEligibleDiscountsEnabled(true)
      setDiscountPercent(25)
      setDiscountDurationMonths(4)
      setCustomOverrideEnabled(false)
    }
  }

  const handleSaveScenario = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scenarioName.trim()) return
    setIsSaving(true)
    try {
      const payload = {
        name: scenarioName.trim(),
        description: scenarioDesc.trim(),
        parameters: {
          cohortFilter,
          minMrr,
          paymentRemindersEnabled,
          paymentRemindersIntensity,
          personalFollowupEnabled,
          personalFollowupMinMrr,
          renewalRemindersEnabled,
          eligibleDiscountsEnabled,
          discountPercent,
          discountDurationMonths,
          customOverrideEnabled,
          customRecoveryRate,
        },
      }
      await api.post('/api/simulator/scenarios', payload)
      loadSavedScenarios()
      setShowSaveModal(false)
      setScenarioName('')
      setScenarioDesc('')
      setActionMessage('Scenario successfully saved')
      setTimeout(() => setActionMessage(null), 4000)
    } catch {
      setActionMessage('Failed to save scenario')
      setTimeout(() => setActionMessage(null), 4000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLoadScenario = (sc: SavedScenarioItem) => {
    const p = sc.parameters || {}
    if (p.cohortFilter !== undefined) setCohortFilter(p.cohortFilter)
    if (p.minMrr !== undefined) setMinMrr(p.minMrr)
    if (p.paymentRemindersEnabled !== undefined) setPaymentRemindersEnabled(p.paymentRemindersEnabled)
    if (p.paymentRemindersIntensity !== undefined) setPaymentRemindersIntensity(p.paymentRemindersIntensity)
    if (p.personalFollowupEnabled !== undefined) setPersonalFollowupEnabled(p.personalFollowupEnabled)
    if (p.personalFollowupMinMrr !== undefined) setPersonalFollowupMinMrr(p.personalFollowupMinMrr)
    if (p.renewalRemindersEnabled !== undefined) setRenewalRemindersEnabled(p.renewalRemindersEnabled)
    if (p.eligibleDiscountsEnabled !== undefined) setEligibleDiscountsEnabled(p.eligibleDiscountsEnabled)
    if (p.discountPercent !== undefined) setDiscountPercent(p.discountPercent)
    if (p.discountDurationMonths !== undefined) setDiscountDurationMonths(p.discountDurationMonths)
    if (p.customOverrideEnabled !== undefined) setCustomOverrideEnabled(p.customOverrideEnabled)
    if (p.customRecoveryRate !== undefined) setCustomRecoveryRate(p.customRecoveryRate)

    setActionMessage(`Loaded scenario "${sc.name}"`)
    setTimeout(() => setActionMessage(null), 4000)
  }

  const handleDeleteScenario = async (id: string, name: string) => {
    try {
      await api.delete(`/api/simulator/scenarios/${id}`)
      loadSavedScenarios()
      setActionMessage(`Deleted scenario "${name}"`)
      setTimeout(() => setActionMessage(null), 4000)
    } catch {
      setActionMessage('Failed to delete scenario')
      setTimeout(() => setActionMessage(null), 4000)
    }
  }

  // Comparison Chart Data
  const comparisonChartData = useMemo(() => {
    if (!summary) return []
    return [
      {
        name: 'Gross Exposure',
        amount: summary.revenue_at_risk,
        fill: '#ff3b30', // Apple Red
      },
      {
        name: 'Gross Recovered',
        amount: summary.estimated_recovered_revenue,
        fill: '#0071e3', // Apple Blue
      },
      {
        name: 'Concessions & Costs',
        amount: summary.total_intervention_costs,
        fill: '#ff9500', // Apple Orange
      },
      {
        name: 'Net Recovery',
        amount: summary.estimated_net_recovery,
        fill: '#34c759', // Apple Green
      },
    ]
  }, [summary])

  return (
    <div className="min-h-full pb-16 apple-animate-in">
      <TopBar
        title="What-If Revenue Recovery Simulator"
        subtitle="Simulate intervention campaigns, discount costs, and projected net recovery without altering core records"
      />

      <div className="p-5 sm:p-6 max-w-[1500px] mx-auto space-y-5">
        {/* Sandbox Guarantee Banner */}
        <div className="p-4 rounded-2xl border border-[#34c759]/30 bg-[#ecfdf5] text-[#065f46] flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-3 font-medium">
            <ShieldCheck className="w-5 h-5 text-[#34c759] flex-shrink-0" />
            <span>
              <strong>Deterministic Sandbox Active:</strong> This simulator operates strictly read-only on your billing tables. Simulations will <em>never</em> alter or trigger real invoices, charges, or subscriptions.
            </span>
          </div>
          <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full bg-white text-[#065f46] border border-[#a7f3d0] font-mono text-[11px] font-semibold">
            100% Non-Destructive
          </span>
        </div>

        {/* Action Toast */}
        {actionMessage && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-[#1d1d1f] text-white text-xs font-semibold shadow-2xl flex items-center gap-3 border border-white/20 apple-animate-in">
            <CheckCircle className="w-4 h-4 text-[#34c759]" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Strategy Presets Bar */}
        <div className="apple-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0071e3]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f]">Strategy Presets:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => applyPreset('balanced')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3] transition-all"
            >
              Balanced Optimization
            </button>
            <button
              onClick={() => applyPreset('aggressive')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3] transition-all"
            >
              Aggressive Maximum Recovery
            </button>
            <button
              onClick={() => applyPreset('conservative')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3] transition-all"
            >
              High-MRR White Glove Only
            </button>
            <button
              onClick={() => applyPreset('discounts_only')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3] transition-all"
            >
              Retention Concessions Only
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] transition-all flex items-center gap-1.5 ml-2 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Scenario</span>
            </button>
          </div>
        </div>

        {/* 2-Column: Controls vs Live Projections */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Interactive Controls */}
          <div className="lg:col-span-6 space-y-6">
            {/* Cohort Targeting */}
            <Card title="Targeting & Cohort Scope" subtitle="Define which delinquent accounts enter the simulation">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-2">Delinquent Risk Cohort</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'all', label: 'All Accounts' },
                      { id: 'high_critical', label: 'High & Critical' },
                      { id: 'critical_only', label: 'Critical Only' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCohortFilter(opt.id as any)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                          cohortFilter === opt.id
                            ? 'bg-white border-[#0071e3] text-[#0071e3] shadow-xs'
                            : 'bg-[#f5f5f7] border-transparent text-[#6e6e73] hover:bg-[#e5e5ea]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-[#1d1d1f]">Minimum Monthly Revenue (MRR) Filter</span>
                    <span className="font-mono font-bold text-[#0071e3]">${minMrr.toLocaleString()}/mo</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="8000"
                    step="500"
                    value={minMrr}
                    onChange={(e) => setMinMrr(Number(e.target.value))}
                    className="w-full h-2 rounded-lg bg-[#e5e5ea] accent-[#0071e3] cursor-pointer"
                  />
                </div>
              </div>
            </Card>

            {/* Interventions */}
            <Card title="Intervention Levers" subtitle="Configure multichannel dunning, personal outreach, and retention offers">
              <div className="space-y-5">
                {/* 1. Automated Dunning */}
                <div className="p-4 rounded-xl border border-[#e5e5ea] bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#0071e3]" />
                      <span className="text-xs font-bold text-[#1d1d1f]">Automated Dunning Reminders</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={paymentRemindersEnabled}
                      onChange={(e) => setPaymentRemindersEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#0071e3] rounded cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-[#6e6e73] mb-3">Multi-touch automated reminder sequences triggered on payment drop.</p>
                  {paymentRemindersEnabled && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#f2f2f7]">
                      <button
                        type="button"
                        onClick={() => setPaymentRemindersIntensity('standard')}
                        className={`py-1.5 rounded-lg text-xs font-semibold border ${
                          paymentRemindersIntensity === 'standard'
                            ? 'bg-[#0071e3]/10 border-[#0071e3] text-[#0071e3]'
                            : 'border-[#e5e5ea] text-[#86868b]'
                        }`}
                      >
                        Standard (22% Baseline)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentRemindersIntensity('aggressive')}
                        className={`py-1.5 rounded-lg text-xs font-semibold border ${
                          paymentRemindersIntensity === 'aggressive'
                            ? 'bg-[#0071e3]/10 border-[#0071e3] text-[#0071e3]'
                            : 'border-[#e5e5ea] text-[#86868b]'
                        }`}
                      >
                        Aggressive SMS + In-App (34%)
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Personal CS Follow-up */}
                <div className="p-4 rounded-xl border border-[#e5e5ea] bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-[#5e5ce6]" />
                      <span className="text-xs font-bold text-[#1d1d1f]">High-Touch Customer Success Outreach</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={personalFollowupEnabled}
                      onChange={(e) => setPersonalFollowupEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#0071e3] rounded cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-[#6e6e73] mb-3">Dedicated call intervention (45% lift, $75 labor cost per account).</p>
                  {personalFollowupEnabled && (
                    <div className="space-y-2 pt-2 border-t border-[#f2f2f7]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#86868b]">Min MRR for Executive Outreach:</span>
                        <span className="font-mono font-bold text-[#5e5ce6]">${personalFollowupMinMrr.toLocaleString()}/mo</span>
                      </div>
                      <input
                        type="range"
                        min="1000"
                        max="8000"
                        step="500"
                        value={personalFollowupMinMrr}
                        onChange={(e) => setPersonalFollowupMinMrr(Number(e.target.value))}
                        className="w-full h-2 rounded-lg bg-[#e5e5ea] accent-[#5e5ce6] cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Proactive Renewal Sequences */}
                <div className="p-4 rounded-xl border border-[#e5e5ea] bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-[#30b0c7]" />
                      <span className="text-xs font-bold text-[#1d1d1f]">Proactive Renewal Rescue</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={renewalRemindersEnabled}
                      onChange={(e) => setRenewalRemindersEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#0071e3] rounded cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-[#6e6e73]">30-day early outreach targeting accounts approaching renewal with elevated churn risk.</p>
                </div>

                {/* 4. Eligible Retention Concessions */}
                <div className="p-4 rounded-xl border border-[#e5e5ea] bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-[#ff9500]" />
                      <span className="text-xs font-bold text-[#1d1d1f]">Retention Discount Concessions</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={eligibleDiscountsEnabled}
                      onChange={(e) => setEligibleDiscountsEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#0071e3] rounded cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-[#6e6e73] mb-3">Model discount margin costs vs. voluntary churn prevention lift.</p>
                  {eligibleDiscountsEnabled && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#f2f2f7]">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#86868b]">Discount:</span>
                          <span className="font-mono font-bold text-[#ff9500]">{discountPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="35"
                          step="5"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(Number(e.target.value))}
                          className="w-full h-2 rounded-lg bg-[#e5e5ea] accent-[#ff9500] cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#86868b]">Duration:</span>
                          <span className="font-mono font-bold text-[#ff9500]">{discountDurationMonths} mos</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="6"
                          step="1"
                          value={discountDurationMonths}
                          onChange={(e) => setDiscountDurationMonths(Number(e.target.value))}
                          className="w-full h-2 rounded-lg bg-[#e5e5ea] accent-[#ff9500] cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Live Projections & Comparison */}
          <div className="lg:col-span-6 space-y-6">
            {/* Executive Projections Highlight Card */}
            <div className="apple-card p-6 bg-gradient-to-br from-white via-white to-[#0071e3]/5 border-[#e5e5ea]">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#0071e3] mb-1">
                Projected Rescue Economics
              </div>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-4xl font-extrabold tracking-tight text-[#1d1d1f] font-mono">
                  ${summary ? summary.estimated_net_recovery.toLocaleString() : '—'}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#34c759]/10 text-[#065f46] border border-[#a7f3d0]">
                  Estimated Net Rescue
                </span>
              </div>

              {/* Summary Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#e5e5ea]">
                <div>
                  <span className="text-[11px] text-[#86868b] block">Modeled Exposure</span>
                  <span className="text-sm font-bold text-[#1d1d1f] font-mono">
                    ${summary ? summary.revenue_at_risk.toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#86868b] block">Expected Rate</span>
                  <span className="text-sm font-bold text-[#0071e3] font-mono">
                    {summary ? `${(summary.expected_recovery_rate * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#86868b] block">Intervention Costs</span>
                  <span className="text-sm font-bold text-[#ff9500] font-mono">
                    ${summary ? summary.total_intervention_costs.toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#86868b] block">Projected ROI</span>
                  <span className="text-sm font-bold text-[#34c759] font-mono">
                    {summary ? `${summary.roi_multiple.toFixed(1)}x` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Waterfall Chart */}
            <Card
              title="Projected Recovery Breakdown"
              subtitle="Comparison of gross exposure against costs and projected net recovery"
            >
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#86868b', fontSize: 11 }} axisLine={{ stroke: '#e5e5ea' }} tickLine={false} />
                    <YAxis tick={{ fill: '#86868b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Amount']}
                      contentStyle={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid #e5e5ea', borderRadius: '12px', fontSize: '12px', color: '#1d1d1f' }}
                    />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {comparisonChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Saved Scenarios Registry */}
            <Card title="Saved Executive Scenarios" subtitle="Compare prior simulation configurations">
              {savedScenarios.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#86868b]">
                  No saved scenarios. Use "Save Scenario" above to persist models.
                </div>
              ) : (
                <div className="space-y-2">
                  {savedScenarios.map((sc) => (
                    <div
                      key={sc.id}
                      className="p-3.5 rounded-xl border border-[#e5e5ea] bg-white flex items-center justify-between hover:border-[#0071e3]/30 transition-all"
                    >
                      <div>
                        <div className="text-xs font-semibold text-[#1d1d1f]">{sc.name}</div>
                        <div className="text-[11px] text-[#86868b] mt-0.5">
                          Net: <strong className="text-[#34c759] font-mono">${sc.projected_net_recovery?.toLocaleString()}</strong> · Rate: {(sc.expected_recovery_rate * 100)?.toFixed(1)}% · {sc.targeted_customers_count} accounts
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleLoadScenario(sc)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#0071e3] bg-[#0071e3]/10 hover:bg-[#0071e3] hover:text-white transition-all"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => handleDeleteScenario(sc.id, sc.name)}
                          className="p-1.5 rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm apple-animate-in">
          <div className="apple-card max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[#1d1d1f] mb-1">Save Simulation Scenario</h3>
            <p className="text-xs text-[#6e6e73] mb-4">Persist the current slider parameters and financial projections.</p>
            <form onSubmit={handleSaveScenario} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Scenario Title</label>
                <input
                  type="text"
                  required
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="e.g. Q4 Executive Retention Blitz"
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">Description (Optional)</label>
                <textarea
                  value={scenarioDesc}
                  onChange={(e) => setScenarioDesc(e.target.value)}
                  placeholder="Strategic notes or assumptions..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed]"
                >
                  {isSaving ? 'Saving...' : 'Save Scenario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
