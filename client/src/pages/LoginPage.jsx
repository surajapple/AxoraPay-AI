import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Bot, Eye, EyeOff, Loader2, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import clsx from 'clsx';

const DEMO_USERS = [
  { email: 'demo@axorapay.com', password: 'demo123', role: 'CUSTOMER', label: 'Demo Customer', color: 'text-status-info bg-status-infoBg' },
  { email: 'admin@axorapay.com', password: 'admin123', role: 'ADMIN', label: 'Admin User', color: 'text-purple-700 bg-purple-100' },
  { email: 'agent@axorapay.com', password: 'agent123', role: 'AGENT', label: 'Support Agent', color: 'text-accent-700 bg-accent-50' },
  { email: 'rahul@email.com', password: 'test123', role: 'CUSTOMER', label: 'Rahul Sharma (has TXN10001)', color: 'text-status-warning bg-status-warningBg' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreds, setShowCreds] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (email, password) => {
    setForm({ email, password });
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded bg-accent-600 flex items-center justify-center mb-4 shadow-sm border border-accent-700">
            <Bot size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-medium text-surface-900 tracking-tight">AxoraPay</h1>
          <p className="text-sm text-surface-500 mt-1">Sign in to your account</p>
        </div>

        {/* Login card */}
        <div className="card p-8 bg-white border-surface-200 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label block mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-status-error bg-status-errorBg border border-status-error/20 rounded-md px-3 py-2 flex items-center gap-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign In'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="border-t border-surface-200 mt-6 pt-6">
            <button
              onClick={() => setShowCreds(!showCreds)}
              className="flex items-center justify-between w-full text-xs font-semibold text-surface-500 hover:text-surface-900 transition-colors uppercase tracking-wide focus:outline-none"
            >
              <span>Demo Credentials</span>
              {showCreds ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showCreds && (
              <div className="mt-4 space-y-2">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.email}
                    onClick={() => quickLogin(u.email, u.password)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded border border-surface-200 bg-surface-50 hover:bg-surface-100 hover:border-surface-300 transition-all text-left focus:outline-none"
                  >
                    <div>
                      <div className="text-sm font-medium text-surface-900">{u.label}</div>
                      <div className="text-xs text-surface-500">{u.email}</div>
                    </div>
                    <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded", u.color)}>{u.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-surface-500">
          <Zap size={12} className="text-surface-400" />
          <span>All data is simulated. No real financial APIs used.</span>
        </div>
      </div>
    </div>
  );
}
