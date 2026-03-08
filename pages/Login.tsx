import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { Loader2, CheckCircle, Mail, Key, Eye, EyeOff } from 'lucide-react';
import { MosaicLogo, MosaicIcon } from '../components/MosaicLogo';
import EnvironmentSwitcher from '../components/EnvironmentSwitcher';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Password Reset State
  const [isResetMode, setIsResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Password visibility toggles (independent per field)
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    if (type === 'recovery') setIsResetMode(true);
  }, []);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!supabase) {
      toast.error('Database connection not active.');
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated! Please login.');
      setIsResetMode(false);
      window.location.hash = '';
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.message.includes("deactivated")) {
        setError("Your account has been deactivated. Contact your administrator.");
      } else if (err.message.includes("Invalid login")) {
        setError("Invalid email or password.");
      } else if (err.message.includes("Email not confirmed")) {
        setError("Email not confirmed. Check your inbox.");
      } else {
        setError(err.message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Password Reset UI
  if (isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-8">
            <MosaicLogo size="lg" showText textPosition="bottom" className="justify-center mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mt-4">Reset Password</h2>
          </div>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="New password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Confirm password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={resetLoading}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {resetLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main Login UI
  return (
    <div className="min-h-screen bg-slate-100 flex">

      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden flex-col">

        {/* Decorative background tiles */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10">
            <MosaicIcon size={120} variant="white" />
          </div>
          <div className="absolute bottom-20 right-10">
            <MosaicIcon size={180} variant="white" />
          </div>
          <div className="absolute top-1/2 left-1/4">
            <MosaicIcon size={80} variant="white" />
          </div>
        </div>

        {/* Logo - Top Left */}
        <div className="p-8">
          <MosaicLogo variant="white" size="md" showText />
        </div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-12 relative z-10">
          <MosaicLogo variant="white" size="xl" />

          <h1 className="text-4xl font-bold text-white mt-8 mb-4 text-center">
            Mosaic ERP
          </h1>

          {/* Colorful divider */}
          <div className="flex gap-1 mb-6">
            <div className="w-8 h-1.5 bg-blue-500 rounded-full"></div>
            <div className="w-8 h-1.5 bg-emerald-500 rounded-full"></div>
            <div className="w-8 h-1.5 bg-amber-500 rounded-full"></div>
            <div className="w-8 h-1.5 bg-purple-500 rounded-full"></div>
          </div>

          <p className="text-slate-400 text-center text-lg max-w-sm">
            Enterprise insurance management platform for Mosaic Insurance Group
          </p>
        </div>

        {/* Footer */}
        <div className="p-8 text-center">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Mosaic Insurance Group
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        {/* Environment Switcher - Top Right */}
        <div className="absolute top-4 right-4">
          <EnvironmentSwitcher compact />
        </div>

        <div className="w-full max-w-md">

          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <MosaicLogo size="lg" showText textPosition="bottom" />
          </div>

          {/* Form Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800">
              Insurance Management System
            </h2>
            <p className="text-slate-500 mt-2">Sign in to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <div className="relative">
                <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-slate-900/20"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
            </button>
          </form>

          {/* Footer badges */}
          <div className="mt-8 flex items-center justify-center gap-6 text-slate-400">
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle size={14} className="text-emerald-500" />
              <span>Secure</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle size={14} className="text-emerald-500" />
              <span>Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
