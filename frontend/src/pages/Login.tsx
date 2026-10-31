import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import GoogleSignInButton from '../components/auth/GoogleSignInButton'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail)
    setPassword(demoPass)
    setError('')
    setIsLoading(true)
    try {
      await login(demoEmail, demoPass)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#fbfbfd] relative overflow-hidden apple-animate-in">
      {/* Apple Subtle Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-[#0071e3]/6 to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md my-12">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm bg-gradient-to-tr from-[#0071e3] to-[#5e5ce6] text-white">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
              SubNexa <span className="text-[#0071e3]">AI</span>
            </span>
          </div>
          <p className="text-sm text-[#86868b] tracking-tight">The Revenue Rescue Platform · SubSage Studio</p>
        </div>

        {/* Card */}
        <div className="apple-card p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-3xl bg-white border border-[#e5e5ea]">
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] mb-1">Sign In</h1>
          <p className="text-xs text-[#86868b] mb-5">Access your portfolio intelligence and revenue rescue workflows</p>

          {/* Quick Demo Login Pills */}
          <div className="mb-6 p-3.5 rounded-2xl border border-[#e5e5ea] bg-[#f5f5f7]/70">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] mb-2.5 flex items-center justify-between">
              <span>Quick Demo Access</span>
              <span className="text-[10px] text-[#0071e3] font-bold font-mono">1-Click</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickLogin('admin@subnexa.ai', 'Admin@1234')}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-left border border-[#e5e5ea] bg-white hover:border-[#0071e3] hover:shadow-xs transition-all active:scale-[0.98]"
              >
                <div className="text-[#0071e3] font-bold">⚡ Admin Demo</div>
                <div className="text-[11px] text-[#86868b] truncate mt-0.5">admin@subnexa.ai</div>
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickLogin('staff@subnexa.ai', 'Staff@1234')}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-left border border-[#e5e5ea] bg-white hover:border-[#5e5ce6] hover:shadow-xs transition-all active:scale-[0.98]"
              >
                <div className="text-[#5e5ce6] font-bold">🛡️ Staff Demo</div>
                <div className="text-[11px] text-[#86868b] truncate mt-0.5">staff@subnexa.ai</div>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl text-xs border border-[#ff3b30]/30 bg-[#ff3b30]/10 text-[#d70015] font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#1d1d1f]">Password</label>
                <Link to="/forgot-password" className="text-xs text-[#0071e3] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] transition-all disabled:opacity-50 mt-2 shadow-xs"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#e5e5ea]" />
            <span className="text-[11px] font-semibold text-[#86868b]">OR</span>
            <div className="flex-1 h-px bg-[#e5e5ea]" />
          </div>

          {/* Google Sign-In */}
          <GoogleSignInButton text="continue_with" onError={(msg) => setError(msg)} />

          {/* Register Link */}
          <p className="text-center text-xs text-[#86868b] mt-5">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-[#0071e3] hover:underline">
              Create account
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-[#86868b] mt-6">
          Powered by SubSage Intelligence™ · Apple Design Edition
        </p>
      </div>
    </div>
  )
}
