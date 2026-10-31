import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, User, Zap, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import GoogleSignInButton from '../components/auth/GoogleSignInButton'

const passwordRules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /\d/.test(p) },
  { label: 'Special character', test: (p: string) => /[@$!%*?&_.#\-]/.test(p) },
]

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    const allPass = passwordRules.every((r) => r.test(password))
    if (!allPass) {
      setError('Password does not meet all security requirements.')
      return
    }
    setIsLoading(true)
    try {
      await register(email, password, firstName, lastName)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#fbfbfd] relative overflow-hidden apple-animate-in">
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-[#0071e3]/6 to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md my-8">
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
          <p className="text-sm text-[#86868b] tracking-tight">Create your enterprise intelligence account</p>
        </div>

        {/* Card */}
        <div className="apple-card p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-3xl bg-white border border-[#e5e5ea]">
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] mb-1">Create Account</h1>
          <p className="text-xs text-[#86868b] mb-6">Start recovering lost recurring revenue with SubSage</p>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl text-xs border border-[#ff3b30]/30 bg-[#ff3b30]/10 text-[#d70015] font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">First name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    className="w-full pl-10 pr-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Vance"
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength checklist */}
              {password && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#f5f5f7] space-y-1 text-[11px]">
                  {passwordRules.map((rule) => {
                    const pass = rule.test(password)
                    return (
                      <div key={rule.label} className={`flex items-center gap-1.5 ${pass ? 'text-[#34c759]' : 'text-[#86868b]'}`}>
                        <Check className={`w-3 h-3 ${pass ? 'stroke-[2.5]' : 'opacity-30'}`} />
                        <span>{rule.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 rounded-xl text-xs text-[#1d1d1f] bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] transition-all disabled:opacity-50 mt-3 shadow-xs"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#e5e5ea]" />
            <span className="text-[11px] font-semibold text-[#86868b]">OR</span>
            <div className="flex-1 h-px bg-[#e5e5ea]" />
          </div>

          <GoogleSignInButton text="signup_with" onError={(msg) => setError(msg)} />

          <p className="text-center text-xs text-[#86868b] mt-5">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#0071e3] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
