import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  trend?: number    // positive = up, negative = down, undefined = neutral
  accentColor?: string
  isLoading?: boolean
}

export default function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accentColor = '#0071e3',
  isLoading,
}: KPICardProps) {
  const TrendIcon = trend === undefined ? Minus : trend > 0 ? TrendingUp : TrendingDown
  const trendColor = trend === undefined ? '#86868b' : trend > 0 ? '#34c759' : '#ff3b30'

  return (
    <div className="apple-card min-h-[132px] p-4 flex flex-col justify-between group hover:-translate-y-0.5 transition-all duration-300">
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-4 rounded-md bg-[#f0f0f4] w-2/3" />
          <div className="h-8 rounded-lg bg-[#f0f0f4] w-1/2" />
          <div className="h-3 rounded-md bg-[#f0f0f4] w-4/5" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-[#86868b]">{title}</p>
            </div>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
              style={{
                background: `${accentColor}12`,
                color: accentColor,
              }}
            >
              {icon}
            </div>
          </div>

          <div className="mb-2">
            <span className="text-[26px] font-bold tracking-tight text-[#1d1d1f] font-sans">
              {value}
            </span>
          </div>

          {(subtitle || trend !== undefined) && (
            <div className="flex items-center gap-2 pt-1 border-t border-[#f2f2f7]">
              {trend !== undefined && (
                <div
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold"
                  style={{
                    background: `${trendColor}12`,
                    color: trendColor,
                  }}
                >
                  <TrendIcon className="w-3 h-3" />
                  <span>{Math.abs(trend)}%</span>
                </div>
              )}
              {subtitle && <span className="text-xs text-[#86868b] truncate">{subtitle}</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
