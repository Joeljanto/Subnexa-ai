import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
  actions?: ReactNode
}

export default function Card({ children, className = '', title, subtitle, actions }: CardProps) {
  return (
    <div className={`apple-card overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-[#e5e5ea]/80 bg-white px-5 py-4">
          <div>
            {title && <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-[#86868b] mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
