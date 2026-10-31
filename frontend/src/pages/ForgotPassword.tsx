import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Zap, ArrowLeft, CheckCircle } from 'lucide-react'
import api from '../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#fbfbfd] relative overflow-hidden apple-animate-in">
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-[#0071e3]/6 to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md my-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm bg-gradient-to-tr from-[#0071e3] to-[#5e5ce6] text-white">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
              SubNexa <span className="text-[#0071e3]">AI</span>
            </span>
          </div>
          <p className="text-sm text-[#86868b]">Password recovery assistance</p>
        </div>

        <div className="apple-card p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-3xl bg-white border border-[#e5e5ea]">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#34c759]/10 text-[#34c759] flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-[#1d1d1f] mb-2">Check your email</h2>
              <p className="text-xs text-[#6e6e73] mb-6 leading-relaxed">
                If an account with <strong className="text-[#1d1d1f] font-semibold">{email}</strong> exists, we've sent password reset instructions.
              </p>
              <Link to="/login" className="inline-flex items-center gap-2 text-xs font-semibold text-[#0071e3] hover:underline">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] mb-1">Reset Password</h1>
              <p className="text-xs text-[#86868b] mb-6">
                Enter your verified email to receive a recovery link.
              </p>

              {error && (
                <div className="mb-5 p-3.5 rounded-2xl text-xs border border-[#ff3b30]/30 bg-[#ff3b30]/10 text-[#d70015] font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] transition-all disabled:opacity-50 mt-2 shadow-xs"
                >
                  {isLoading ? 'Sending instructions...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-[#86868b] hover:text-[#1d1d1f]">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
