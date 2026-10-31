import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HelpCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../lib/api'

interface GoogleSignInButtonProps {
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  onError?: (msg: string) => void
}

export default function GoogleSignInButton({
  text = 'continue_with',
  onError,
}: GoogleSignInButtonProps) {
  const { googleLogin } = useAuth()
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)

  const [clientId, setClientId] = useState<string>(
    (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  )
  const [isConfigured, setIsConfigured] = useState<boolean>(Boolean(clientId))
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  // Fetch Client ID from backend /auth/config if not defined in Vite env
  useEffect(() => {
    if (!clientId) {
      api.get('/auth/config')
        .then((res) => {
          const fetchedId = (res.data.google_client_id || '').trim()
          if (fetchedId) {
            setClientId(fetchedId)
            setIsConfigured(true)
          } else {
            setIsConfigured(false)
          }
        })
        .catch(() => {
          setIsConfigured(false)
        })
    }
  }, [clientId])

  // Initialize and render Google Identity Services button
  useEffect(() => {
    if (!clientId || !isConfigured) return

    let isSubscribed = true

    const tryRenderGoogleButton = () => {
      if (!isSubscribed) return
      if (window.google?.accounts?.id && buttonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              if (!response?.credential) {
                onError?.('Failed to receive Google ID token.')
                return
              }
              setIsAuthenticating(true)
              try {
                await googleLogin(response.credential)
                navigate('/dashboard')
              } catch (err: any) {
                const errorMsg =
                  err.response?.data?.error ||
                  'Google authentication failed. Please verify credentials.'
                onError?.(errorMsg)
              } finally {
                setIsAuthenticating(false)
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          })

          buttonRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(buttonRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: text,
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 380,
          })
        } catch (e: any) {
          console.error('Failed to initialize Google Sign-In:', e)
        }
      }
    }

    // Try immediately, or poll briefly until script tag finishes loading
    if (window.google?.accounts?.id) {
      tryRenderGoogleButton()
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval)
          tryRenderGoogleButton()
        }
      }, 200)

      const timeout = setTimeout(() => clearInterval(interval), 4000)
      return () => {
        isSubscribed = false
        clearInterval(interval)
        clearTimeout(timeout)
      }
    }

    return () => {
      isSubscribed = false
    }
  }, [clientId, isConfigured, text, googleLogin, navigate, onError])

  return (
    <div className="w-full">
      {isConfigured ? (
        <div className="w-full flex flex-col items-center justify-center">
          {/* Container where GIS renders the official Google button */}
          <div ref={buttonRef} className="w-full flex justify-center min-h-[44px]" />
          {isAuthenticating && (
            <div className="text-xs text-blue-400 mt-2 animate-pulse">
              Verifying Google token...
            </div>
          )}
        </div>
      ) : (
        /* Fallback button when Google OAuth Client ID is not yet configured */
        <div>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="w-full py-2.5 px-3 rounded-lg text-sm font-medium text-white border flex items-center justify-center gap-2.5 transition-all hover:border-blue-500 hover:bg-slate-800/40"
            style={{ background: '#0d1426', borderColor: '#1e2d4a' }}
            title="Click to view Google OAuth configuration steps"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continue with Google</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-normal ml-auto">
              Setup Required
            </span>
          </button>
        </div>
      )}

      {/* Helpful Google OAuth Setup Instructions Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-4"
            style={{ background: '#0d1426', borderColor: '#1e2d4a' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#1e2d4a' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/20 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Google OAuth Setup Guide</h3>
                  <p className="text-xs text-slate-400">Configure Client ID in your environment</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                To enable live Google Sign-In, SubNexa AI requires an authorized OAuth 2.0 Web Client ID from your Google Cloud Console.
              </p>

              <div className="p-3 rounded-lg border bg-slate-900/50 space-y-2" style={{ borderColor: '#1e2d4a' }}>
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                  Quick Setup Steps:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                  <li>Visit <span className="text-blue-400 font-mono">console.cloud.google.com</span></li>
                  <li>Enable <span className="text-white font-medium">Google Identity / People API</span></li>
                  <li>Under <strong>Credentials</strong>, create an <strong>OAuth 2.0 Web Client ID</strong></li>
                  <li>
                    Add Authorized JavaScript Origins:
                    <div className="mt-1 font-mono text-[11px] text-emerald-400 bg-black/40 p-1.5 rounded">
                      http://localhost:5173<br />
                      http://127.0.0.1:5173
                    </div>
                  </li>
                  <li>
                    Add Authorized Redirect URIs:
                    <div className="mt-1 font-mono text-[11px] text-emerald-400 bg-black/40 p-1.5 rounded">
                      http://localhost:5173<br />
                      http://localhost:5000/auth/google/callback
                    </div>
                  </li>
                </ol>
              </div>

              <div>
                <span className="font-semibold text-white">Add credentials to your environment:</span>
                <pre className="mt-1.5 p-2.5 rounded bg-black/60 text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
# Root .env (backend)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# frontend/.env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#1e2d4a' }}>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                Full documentation in <code className="text-blue-400">docs/google_oauth_setup.md</code>
              </span>
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
