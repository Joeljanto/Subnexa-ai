interface BadgeProps {
  label: string
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'violet'
}

const variants = {
  success: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  warning: { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  danger:  { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  info:    { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  muted:   { bg: '#f4f4f5', color: '#52525b', border: '#e4e4e7' },
  violet:  { bg: '#f5f3ff', color: '#5b21b6', border: '#ddd6fe' },
}

export default function Badge({ label, variant = 'muted' }: BadgeProps) {
  const style = variants[variant] || variants.muted
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-tight border transition-all"
      style={{
        background: style.bg,
        color: style.color,
        borderColor: style.border,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: style.color }} />
      {label}
    </span>
  )
}

export function riskLevelVariant(level: string): BadgeProps['variant'] {
  switch (level?.toLowerCase()) {
    case 'critical': return 'danger'
    case 'high':     return 'warning'
    case 'medium':   return 'violet'
    case 'low':      return 'success'
    default:         return 'muted'
  }
}

export function statusVariant(status: string): BadgeProps['variant'] {
  switch (status?.toLowerCase()) {
    case 'active':    return 'success'
    case 'at_risk':   return 'warning'
    case 'churned':   return 'danger'
    case 'suspended': return 'muted'
    case 'succeeded': return 'success'
    case 'failed':    return 'danger'
    case 'pending':   return 'info'
    case 'refunded':  return 'violet'
    default:          return 'muted'
  }
}
