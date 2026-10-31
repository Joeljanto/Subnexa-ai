import { useEffect, useRef, useState } from 'react'
import { Bell, Search, Sparkles, AlertTriangle, CreditCard, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../lib/api'

interface NotificationItem {
  id: string
  title: string
  message: string
  href: string
  kind: 'risk' | 'payment'
}

interface TopBarProps {
  title: string
  subtitle?: string
}

export default function TopBar({ title }: TopBarProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [loadedNotifications, setLoadedNotifications] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || loadedNotifications) return

    let cancelled = false
    setLoadingNotifications(true)
    Promise.allSettled([
      api.get('/api/customers/risk'),
      api.get('/api/payments/recent'),
    ]).then(([customersResult, paymentsResult]) => {
      if (cancelled) return

      const items: NotificationItem[] = []
      if (customersResult.status === 'fulfilled') {
        const customers = customersResult.value.data.customers ?? []
        customers
          .filter((customer: any) => ['high', 'critical'].includes(String(customer.risk_level).toLowerCase()))
          .slice(0, 5)
          .forEach((customer: any) => items.push({
            id: `risk-${customer.id}`,
            title: `${customer.risk_level} risk account`,
            message: `${customer.name || customer.email || 'Customer'} · score ${Math.round(customer.risk_score ?? 0)}`,
            href: '/dashboard/customers',
            kind: 'risk',
          }))
      }
      if (paymentsResult.status === 'fulfilled') {
        const payments = paymentsResult.value.data.payments ?? []
        payments
          .filter((payment: any) => String(payment.status).toLowerCase() === 'failed')
          .slice(0, 5)
          .forEach((payment: any) => items.push({
            id: `payment-${payment.id}`,
            title: 'Payment failed',
            message: `${payment.customer_name || payment.customer_email || 'Customer'} · $${Number(payment.amount ?? 0).toLocaleString()}`,
            href: '/dashboard/payments',
            kind: 'payment',
          }))
      }
      setNotifications(items)
      setLoadedNotifications(true)
    }).finally(() => {
      if (!cancelled) setLoadingNotifications(false)
    })

    return () => { cancelled = true }
  }, [open, loadedNotifications])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <header className="sticky top-0 z-20 flex min-h-[64px] items-center justify-between gap-4 border-b border-[#e5e5ea]/80 bg-white/80 px-6 py-3 backdrop-blur-xl sm:px-7">
      <div>
        <div className="text-sm font-bold tracking-tight text-[#1d1d1f]">The Revenue Rescue Platform</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#86868b]">
          <Sparkles className="h-3.5 w-3.5 text-[#0071e3]" />
          <span>Powered by <span className="font-semibold text-[#0071e3]">SubSage Intelligence</span></span>
          <span className="mx-1 text-[#d1d1d6]">·</span><span>{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Apple Style Search input with ⌘K badge */}
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" />
          <input
            type="text"
            placeholder="Search accounts, invoices..."
            className="w-56 rounded-full border border-[#e5e5ea] bg-[#f5f5f7] py-2 pl-9 pr-10 text-xs text-[#1d1d1f] transition-all placeholder:text-[#86868b] focus:w-72 focus:bg-white focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/15 focus:outline-none"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#86868b] bg-white border border-[#e5e5ea] shadow-2xs pointer-events-none">
            ⌘K
          </kbd>
        </div>

        {/* Notification bell */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            aria-label="Notifications"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((current) => !current)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[#6e6e73] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff3b30] ring-2 ring-white" />}
          </button>

          {open && (
            <section role="dialog" aria-label="Notifications" className="absolute right-0 top-11 z-50 w-80 sm:w-96 overflow-hidden rounded-2xl border border-[#e5e5ea] bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-[#f0f0f2] px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#1d1d1f]">Notifications</h2>
                  <p className="text-[11px] text-[#86868b]">Account risk and payment activity</p>
                </div>
                {notifications.length > 0 && <span className="rounded-full bg-[#ff3b30]/10 px-2 py-0.5 text-[10px] font-semibold text-[#ff3b30]">{notifications.length} new</span>}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loadingNotifications ? (
                  <p className="px-4 py-8 text-center text-xs text-[#86868b]">Loading notifications…</p>
                ) : notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-[#86868b]">You’re all caught up.</p>
                ) : notifications.map((item) => (
                  <Link key={item.id} to={item.href} onClick={() => setOpen(false)} className="flex items-start gap-3 border-b border-[#f5f5f7] px-4 py-3 transition-colors hover:bg-[#f9f9fb] last:border-0">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${item.kind === 'risk' ? 'bg-[#ff9500]/10 text-[#ff9500]' : 'bg-[#ff3b30]/10 text-[#ff3b30]'}`}>
                      {item.kind === 'risk' ? <AlertTriangle className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-[#1d1d1f]">{item.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-[#86868b]">{item.message}</span>
                    </span>
                    <ArrowRight className="mt-2 h-3.5 w-3.5 shrink-0 text-[#c7c7cc]" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Avatar */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17191f] text-xs font-semibold text-white shadow-sm">
          {(user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
        </div>
      </div>
    </header>
  )
}
