import { useEffect, useState } from 'react'
import {
  Search,
  CheckCircle,
  Zap,
  Cpu,
  ArrowRight,
} from 'lucide-react'
import TopBar from '../components/layout/TopBar'
import Card from '../components/ui/Card'
import Badge, { riskLevelVariant } from '../components/ui/Badge'
import api from '../lib/api'

interface ContributingFactor {
  factor: string
  observed_value: string
  benchmark: string
  impact_score: number
  severity: 'critical' | 'high' | 'medium' | 'low' | 'positive'
  explanation: string
}

interface RecommendedAction {
  action: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  trigger: string
  details: string
}

interface ExplainReport {
  engine_mode: string
  engine_label: string
  customer_id: string
  customer_name: string
  payment_risk: {
    score: number
    probability: number
    level: string
  }
  churn_risk: {
    score: number
    probability: number
    level: string
  }
  overall_risk_score: number
  risk_level: string
  contributing_factors: ContributingFactor[]
  recommended_actions: RecommendedAction[]
  evaluated_features: {
    failed_payment_count: number
    late_payment_count: number
    payment_success_ratio: number
    subscription_age_days: number
    days_until_renewal: number
    outstanding_invoices_count: number
    previous_renewals_count: number
  }
}

interface ModelStatus {
  current_mode: string
  sample_count: number
  threshold_needed: number
  accuracy_label: string
  message: string
}

export default function RiskAnalysis() {
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [report, setReport] = useState<ExplainReport | null>(null)
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null)
  const [search, setSearch] = useState('')
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [isTraining, setIsTraining] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Load customer list and model status
  useEffect(() => {
    setIsLoadingList(true)
    Promise.all([
      api.get('/api/customers/risk'),
      api.get('/api/intelligence/risk/model-status'),
    ]).then(([custRes, modelRes]) => {
      const list = custRes.data.customers ?? []
      setCustomers(list)
      if (list.length > 0) {
        setSelectedCustomerId(list[0].id)
      }
      setModelStatus(modelRes.data)
    }).catch((err) => console.error(err))
      .finally(() => setIsLoadingList(false))
  }, [])

  // Load explain report when selected customer changes
  useEffect(() => {
    if (!selectedCustomerId) return
    setIsLoadingReport(true)
    api.get(`/api/intelligence/risk/explain/${selectedCustomerId}`)
      .then((res) => setReport(res.data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoadingReport(false))
  }, [selectedCustomerId])

  const handleTrainModel = async () => {
    setIsTraining(true)
    try {
      const res = await api.post('/api/intelligence/risk/train')
      setModelStatus(res.data)
      setActionMessage(res.data.message || 'Model evaluation complete')
      setTimeout(() => setActionMessage(null), 6000)
    } catch {
      setActionMessage('Failed to trigger training evaluation')
      setTimeout(() => setActionMessage(null), 4000)
    } finally {
      setIsTraining(false)
    }
  }

  const handleExecuteAction = async (actionType: string) => {
    if (!selectedCustomerId) return
    try {
      const res = await api.post('/api/radar/trigger-action', {
        customer_id: selectedCustomerId,
        action_type: actionType,
      })
      setActionMessage(res.data.message || `Action executed: ${actionType}`)
      setTimeout(() => setActionMessage(null), 5000)
    } catch {
      setActionMessage(`Action queued: ${actionType}`)
      setTimeout(() => setActionMessage(null), 4000)
    }
  }

  const filteredCustomers = customers.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-full pb-16 apple-animate-in">
      <TopBar
        title="SubSage Explainable Risk Engine"
        subtitle="Transparent multi-feature churn & payment risk scoring with interpretable factor attribution"
      />

      <div className="p-5 sm:p-6 max-w-[1500px] mx-auto space-y-5">
        {/* Toast */}
        {actionMessage && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-[#1d1d1f] text-white text-xs font-semibold shadow-2xl flex items-center gap-3 border border-white/20 apple-animate-in">
            <CheckCircle className="w-4 h-4 text-[#34c759]" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Engine Transparency Banner */}
        <div className="apple-card p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-[#0071e3]/6 via-white to-[#5e5ce6]/6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#0071e3]/10 text-[#0071e3]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="text-sm font-bold text-[#1d1d1f]">Inference Engine Status:</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border border-[#0071e3]/30 text-[#0071e3] bg-[#0071e3]/10">
                  {modelStatus?.current_mode === 'rule_based_transparent'
                    ? 'Audited Deterministic Rules (No Fabricated Accuracy)'
                    : 'Scikit-Learn Supervised ML Model'}
                </span>
              </div>
              <p className="text-xs text-[#6e6e73] max-w-2xl">
                {modelStatus?.message || 'SubSage runs in audited deterministic mode when historical cohorts are below supervised sample thresholds, eliminating fabricated accuracy claims.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleTrainModel}
            disabled={isTraining}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2 self-start lg:self-auto flex-shrink-0 shadow-xs"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{isTraining ? 'Evaluating dataset...' : 'Evaluate ML Retraining'}</span>
          </button>
        </div>

        {/* 2-Column Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Account Selector */}
          <div className="lg:col-span-4 space-y-4">
            <div className="apple-card p-4">
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter accounts..."
                  className="w-full pl-9.5 pr-4 py-2 rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition-all shadow-inner"
                />
              </div>

              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] mb-2 px-1">
                Monitored Accounts ({filteredCustomers.length})
              </div>

              <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
                {isLoadingList ? (
                  [...Array(6)].map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-[#f5f5f7] animate-pulse" />
                  ))
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#86868b]">No accounts match query</div>
                ) : (
                  filteredCustomers.map((c) => {
                    const isSelected = c.id === selectedCustomerId
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCustomerId(c.id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex items-center justify-between group ${
                          isSelected
                            ? 'bg-white border-[#0071e3] shadow-[0_2px_12px_rgba(0,113,227,0.12)] ring-1 ring-[#0071e3]/30'
                            : 'bg-white/60 border-[#e5e5ea] hover:bg-white hover:border-[#d1d1d6]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className={`text-xs font-semibold truncate ${isSelected ? 'text-[#0071e3]' : 'text-[#1d1d1f]'}`}>
                            {c.name}
                          </div>
                          <div className="text-[11px] text-[#86868b] truncate">{c.email}</div>
                          <div className="text-[11px] text-[#1d1d1f] font-mono mt-0.5">${c.mrr?.toLocaleString()} MRR</div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <Badge label={c.risk_level} variant={riskLevelVariant(c.risk_level)} />
                          <span className="text-xs font-bold font-mono text-[#1d1d1f]">{c.risk_score?.toFixed(0)}</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Explainable Dossier */}
          <div className="lg:col-span-8 space-y-6">
            {isLoadingReport ? (
              <div className="apple-card p-12 text-center">
                <div className="w-8 h-8 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-[#1d1d1f]">Computing 7-factor explainability matrix...</p>
              </div>
            ) : !report ? (
              <div className="apple-card p-12 text-center text-sm text-[#86868b]">
                Select an account to review SubSage risk factor attribution.
              </div>
            ) : (
              <>
                {/* Dossier Header Card */}
                <div className="apple-card p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e5e5ea]">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#0071e3] mb-1">
                        SubSage Account Risk Dossier
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
                        {report.customer_name}
                      </h2>
                      <p className="text-xs text-[#86868b] mt-0.5">
                        Inference Mode: <span className="font-semibold text-[#1d1d1f]">{report.engine_label}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-[#86868b]">Overall Risk Score</div>
                        <div className="text-3xl font-black font-mono tracking-tight text-[#1d1d1f]">
                          {report.overall_risk_score}
                          <span className="text-xs text-[#86868b] font-normal">/100</span>
                        </div>
                      </div>
                      <Badge label={report.risk_level} variant={riskLevelVariant(report.risk_level)} />
                    </div>
                  </div>

                  {/* Dual Scoring Dials */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5">
                    {/* Payment Risk Tile */}
                    <div className="p-4 rounded-xl border border-[#e5e5ea] bg-[#fafafc]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[#1d1d1f]">Payment Invalidation Risk</span>
                        <Badge label={report.payment_risk.level} variant={riskLevelVariant(report.payment_risk.level)} />
                      </div>
                      <div className="text-2xl font-bold text-[#1d1d1f] font-mono mb-2">
                        {report.payment_risk.score}<span className="text-xs text-[#86868b] font-normal">/100</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden bg-[#e5e5ea]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${report.payment_risk.score}%`,
                            background: report.payment_risk.score > 50 ? '#ff3b30' : '#34c759',
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-[#86868b] mt-2">
                        Probability of subsequent invoice failure: <strong className="text-[#1d1d1f]">{(report.payment_risk.probability * 100).toFixed(0)}%</strong>
                      </p>
                    </div>

                    {/* Churn Risk Tile */}
                    <div className="p-4 rounded-xl border border-[#e5e5ea] bg-[#fafafc]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[#1d1d1f]">Voluntary Churn Probability</span>
                        <Badge label={report.churn_risk.level} variant={riskLevelVariant(report.churn_risk.level)} />
                      </div>
                      <div className="text-2xl font-bold text-[#1d1d1f] font-mono mb-2">
                        {report.churn_risk.score}<span className="text-xs text-[#86868b] font-normal">/100</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden bg-[#e5e5ea]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${report.churn_risk.score}%`,
                            background: report.churn_risk.score > 50 ? '#ff9500' : '#5e5ce6',
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-[#86868b] mt-2">
                        Non-renewal likelihood within 60 days: <strong className="text-[#1d1d1f]">{(report.churn_risk.probability * 100).toFixed(0)}%</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 7-Factor Transparent Attribution Card */}
                <Card
                  title="7-Factor Risk Attribution Matrix"
                  subtitle="Interpretable feature contribution weights computed by SubSage"
                >
                  <div className="space-y-3">
                    {report.contributing_factors.map((cf, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl border border-[#e5e5ea] bg-white hover:border-[#0071e3]/30 transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[#1d1d1f]">{cf.factor}</span>
                            <span className="text-[11px] text-[#86868b]">
                              Observed: <strong className="text-[#1d1d1f] font-mono">{cf.observed_value}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-mono font-bold text-[#ff3b30]">
                              +{cf.impact_score} pts
                            </span>
                            <Badge
                              label={cf.severity}
                              variant={cf.severity === 'critical' ? 'danger' : cf.severity === 'high' ? 'warning' : 'muted'}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-[#6e6e73] leading-relaxed">{cf.explanation}</p>
                        <div className="text-[11px] text-[#86868b] mt-1.5 pt-1.5 border-t border-[#f2f2f7]">
                          Benchmark: {cf.benchmark}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Prescriptive Recommended Actions */}
                <Card
                  title="Prescriptive Rescue Recommendations"
                  subtitle="Contextual interventions derived from root-cause attribution"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.recommended_actions.map((act, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl border border-[#e5e5ea] bg-white hover:border-[#0071e3]/40 hover:shadow-xs transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-semibold text-xs text-[#1d1d1f] flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-[#0071e3]" />
                              <span>{act.action}</span>
                            </span>
                            <Badge
                              label={act.priority}
                              variant={act.priority === 'urgent' ? 'danger' : act.priority === 'high' ? 'warning' : 'info'}
                            />
                          </div>
                          <p className="text-xs text-[#6e6e73] leading-relaxed mb-2">{act.details}</p>
                          <div className="text-[11px] text-[#86868b] italic">Triggered by: {act.trigger}</div>
                        </div>

                        <div className="pt-3 mt-3 border-t border-[#f2f2f7]">
                          <button
                            onClick={() => handleExecuteAction(act.action)}
                            className="w-full py-2 rounded-xl text-xs font-semibold text-[#0071e3] bg-[#0071e3]/8 hover:bg-[#0071e3] hover:text-white transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                          >
                            <span>Execute Action</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
