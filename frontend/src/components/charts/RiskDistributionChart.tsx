import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Props {
  data: Record<string, number>
  isLoading?: boolean
}

const COLORS = {
  low:      '#34c759', // Apple Green
  medium:   '#5e5ce6', // Apple Indigo
  high:     '#ff9500', // Apple Orange
  critical: '#ff3b30', // Apple Red
}

const LABELS: Record<string, string> = {
  low:      'Low Risk',
  medium:   'Medium Risk',
  high:     'High Risk',
  critical: 'Critical Risk',
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="rounded-xl px-3.5 py-2 text-xs border border-[#e5e5ea] shadow-lg bg-white/95 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: COLORS[name as keyof typeof COLORS] ?? '#86868b' }}
        />
        <span className="font-semibold text-[#1d1d1f]">{LABELS[name] ?? name}:</span>
        <span className="font-mono text-[#0071e3] font-semibold">{value} accounts</span>
      </div>
    </div>
  )
}

export default function RiskDistributionChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="h-52 flex items-center justify-center rounded-xl bg-[#f5f5f7]/60">
        <div className="flex items-center gap-2 text-xs text-[#86868b]">
          <div className="w-3.5 h-3.5 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
          <span>Computing risk distribution...</span>
        </div>
      </div>
    )
  }

  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: key, value }))

  if (chartData.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-xs text-[#86868b]">
        No cohort distribution available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.name}
              fill={COLORS[entry.name as keyof typeof COLORS] ?? '#86868b'}
              stroke="#ffffff"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-[#6e6e73] font-medium">{LABELS[value] ?? value}</span>
          )}
          wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
