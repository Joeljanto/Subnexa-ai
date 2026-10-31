import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/layout/DashboardLayout'

// Auth pages
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'

// Dashboard pages
import Dashboard from './pages/Dashboard'
import RadarPage from './pages/RadarPage'
import RiskAnalysis from './pages/RiskAnalysis'
import RecoverySimulator from './pages/RecoverySimulator'
import RecoveryTracking from './pages/RecoveryTracking'
import Customers from './pages/Customers'
import Subscriptions from './pages/Subscriptions'
import Invoices from './pages/Invoices'
import Payments from './pages/Payments'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected dashboard routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="radar" element={<RadarPage />} />
            <Route path="risk" element={<RiskAnalysis />} />
            <Route path="simulator" element={<RecoverySimulator />} />
            <Route path="recovery" element={<RecoveryTracking />} />
            <Route path="customers" element={<Customers />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="payments" element={<Payments />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Unauthorized */}
          <Route path="/unauthorized" element={
            <div className="min-h-screen flex items-center justify-center bg-[#fbfbfd]">
              <div className="apple-card p-10 text-center max-w-sm mx-auto shadow-xl">
                <div className="text-4xl mb-3">🛡️</div>
                <h1 className="text-xl font-bold text-[#1d1d1f] mb-1">Access Restricted</h1>
                <p className="text-xs text-[#86868b] mb-5">Your role does not have authorization to view this resource.</p>
                <a href="/dashboard" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] transition-all shadow-xs">
                  ← Back to Dashboard
                </a>
              </div>
            </div>
          } />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
