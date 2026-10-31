import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface DataPoint {
  month: string
  revenue: number
  failed: number
}

interface Props {
  data: DataPoint[]
  isLoading?: boolean
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-4 py-3 text-xs border border-[#e5e5ea] shadow-xl bg-white/95 backdrop-blur-md">
      <p className="font-semibold text-[#1d1d1f] mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1.5 last:mb-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-[#6e6e73]">{p.name}:</span>
          </div>
          <span className="font-semibold text-[#1d1d1f] font-mono">${p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function RevenueChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center rounded-xl bg-[#f5f5f7]/60">
        <div className="flex items-center gap-2 text-xs text-[#86868b]">
          <div className="w-3.5 h-3.5 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
          <span>Rendering analytics...</span>
        </div>
      </div>
    )
  }

  const chartData = data.length > 0 ? data : [
    { month: 'No data', revenue: 0, failed: 0 },
  ]

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenueLight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0071e3" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#0071e3" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="colorFailedLight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff3b30" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#ff3b30" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#86868b', fontSize: 11 }}
          axisLine={{ stroke: '#e5e5ea' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#86868b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#6e6e73', paddingTop: 16 }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Recovered Revenue"
          stroke="#0071e3"
          strokeWidth={2.5}
          fill="url(#colorRevenueLight)"
          dot={false}
          activeDot={{ r: 5, fill: '#0071e3', stroke: '#ffffff', strokeWidth: 2 }}
        />
        <Area
          type="monotone"
          dataKey="failed"
          name="Delinquent Exposure"
          stroke="#ff3b30"
          strokeWidth={2}
          fill="url(#colorFailedLight)"
          dot={false}
          activeDot={{ r: 5, fill: '#ff3b30', stroke: '#ffffff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
