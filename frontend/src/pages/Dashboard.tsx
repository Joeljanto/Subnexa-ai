import { useEffect, useState } from 'react'
import { DollarSign, Users, XCircle, TrendingUp } from 'lucide-react'
import TopBar from '../components/layout/TopBar'
import KPICard from '../components/ui/KPICard'
import Card from '../components/ui/Card'
import RevenueChart from '../components/charts/RevenueChart'
import RiskDistributionChart from '../components/charts/RiskDistributionChart'
import CustomerRiskTable from '../components/tables/CustomerRiskTable'
import RecentPayments from '../components/tables/RecentPayments'
import api from '../lib/api'

interface KPIs {
  revenue_at_risk: number
  high_risk_customers: number
  failed_payments_count: number
  failed_payments_amount: number
  potential_recovery: number
  total_mrr: number
  total_customers: number
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [riskDist, setRiskDist] = useState<Record<string, number>>({})
  const [revenueTrend, setRevenueTrend] = useState<any[]>([])
  const [riskCustomers, setRiskCustomers] = useState<any[]>([])
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingCharts, setLoadingCharts] = useState(true)
  const [loadingTable, setLoadingTable] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(true)

  useEffect(() => {
    // KPIs
    api.get('/api/intelligence/dashboard/kpis')
      .then((r) => setKpis(r.data))
      .catch((err) => console.error('Failed to load KPIs:', err))
      .finally(() => setLoadingKpis(false))

    // Risk distribution
    api.get('/api/intelligence/risk/distribution')
      .then((r) => setRiskDist(r.data.distribution ?? {}))
      .catch((err) => console.error('Failed to load risk distribution:', err))
      .finally(() => setLoadingCharts(false))

    // Revenue trend
    api.get('/api/intelligence/revenue/trend')
      .then((r) => setRevenueTrend(r.data.trend ?? []))
      .catch((err) => console.error('Failed to load revenue trend:', err))

    // Customer risk table
    api.get('/api/customers/risk')
      .then((r) => setRiskCustomers(r.data.customers ?? []))
      .catch((err) => console.error('Failed to load customer risk table:', err))
      .finally(() => setLoadingTable(false))

    // Recent payments
    api.get('/api/payments/recent')
      .then((r) => setRecentPayments(r.data.payments ?? []))
      .catch((err) => console.error('Failed to load recent payments:', err))
      .finally(() => setLoadingPayments(false))
  }, [])

  return (
    <div className="min-h-full pb-8 apple-animate-in">
      <TopBar
        title="Overview"
        subtitle="SubSage Intelligence · Real-time portfolio exposure & recovery radar"
      />

      <div className="mx-auto max-w-[1500px] space-y-5 p-5 sm:p-6">
        {/* Apple Style Hero Header */}
        <div className="flex flex-col justify-between gap-4 px-1 py-1 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-xs font-semibold mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-ping" />
              <span>Live Portfolio Telemetry</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#1d1d1f] sm:text-[28px]">
              Revenue Health Overview
            </h2>
            <p className="mt-1 text-xs text-[#86868b]">
              Real-time portfolio exposure, automated dunning metrics, and rescue intelligence.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* Apple Segmented Filter Pill */}
            <div className="flex items-center p-1 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
              {['7D', '30D', '90D', 'YTD'].map((period, i) => (
                <button
                  key={period}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    i === 1
                      ? 'bg-white text-[#1d1d1f] shadow-xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            title="Revenue at Risk"
            value={kpis ? `$${kpis.revenue_at_risk.toLocaleString()}` : '—'}
            subtitle="High & critical risk cohort"
            icon={<DollarSign className="w-5 h-5" />}
            accentColor="#ff3b30"
            isLoading={loadingKpis}
          />
          <KPICard
            title="High-Risk Accounts"
            value={kpis?.high_risk_customers ?? '—'}
            subtitle="Need immediate intervention"
            icon={<Users className="w-5 h-5" />}
            accentColor="#ff9500"
            isLoading={loadingKpis}
          />
          <KPICard
            title="Failed Transactions"
            value={kpis?.failed_payments_count ?? '—'}
            subtitle={kpis ? `$${kpis.failed_payments_amount.toLocaleString()} delinquent` : 'Last 30 days'}
            icon={<XCircle className="w-5 h-5" />}
            accentColor="#5e5ce6"
            isLoading={loadingKpis}
          />
          <KPICard
            title="Potential Recovery"
            value={kpis ? `$${kpis.potential_recovery.toLocaleString()}` : '—'}
            subtitle="Estimated recoverable balance"
            icon={<TrendingUp className="w-5 h-5" />}
            accentColor="#34c759"
            isLoading={loadingKpis}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card
            title="Revenue Trajectory & Recovery"
            subtitle="Historical collected subscription revenue vs. delinquent balance"
            className="xl:col-span-2"
          >
            <RevenueChart data={revenueTrend} isLoading={loadingCharts} />
          </Card>

          <Card title="Risk Distribution" subtitle="Active customer accounts segmented by SubSage score">
            <RiskDistributionChart data={riskDist} isLoading={loadingCharts} />
          </Card>
        </div>

        {/* Table & Activity Row */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card
            title="Delinquent Accounts Table"
            subtitle="Prioritized by churn probability and outstanding exposure"
            className="xl:col-span-2"
          >
            <CustomerRiskTable customers={riskCustomers} isLoading={loadingTable} />
          </Card>

          <Card title="Payment Stream Activity" subtitle="Verified real-time transaction ledger">
            <RecentPayments payments={recentPayments} isLoading={loadingPayments} />
          </Card>
        </div>
      </div>
    </div>
  )
}
