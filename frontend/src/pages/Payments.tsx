import { useEffect, useState } from 'react'
import TopBar from '../components/layout/TopBar'
import Card from '../components/ui/Card'
import RecentPayments from '../components/tables/RecentPayments'
import api from '../lib/api'

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/api/payments/')
      .then((r) => setPayments(r.data.payments ?? []))
      .catch((err) => console.error('Failed to load payments:', err))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="min-h-full pb-16 apple-animate-in">
      <TopBar title="Transaction Ledger" subtitle={`${payments.length} verified payment attempts recorded`} />
      <div className="p-5 sm:p-6 max-w-[1500px] mx-auto">
        <Card title="Payment Processing History" subtitle="Real-time clearinghouse records and transaction state">
          <RecentPayments payments={payments} isLoading={isLoading} />
        </Card>
      </div>
    </div>
  )
}
