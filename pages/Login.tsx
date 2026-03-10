import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { useTheme } from '../theme/useTheme';
import { Loader2, CheckCircle, Mail, Key, Eye, EyeOff } from 'lucide-react';
import EnvironmentSwitcher from '../components/EnvironmentSwitcher';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const toast = useToast();
  const { t } = useTheme();

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px 12px 42px',
    borderRadius: 10,
    background: t.bgInput,
    border: `1px solid ${t.border}`,
    color: t.text1,
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 20px',
    borderRadius: 10,
    background: t.accent,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 0.15s',
  };

  // Password Reset UI
  if (isResetMode) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: t.bgApp,
        fontFamily: "'DM Sans', sans-serif",
        padding: 16,
      }}>
        <div style={{
          background: t.bgPanel,
          padding: 32,
          borderRadius: 16,
          boxShadow: t.shadowLg,
          width: '100%',
          maxWidth: 420,
          border: `1px solid ${t.border}`,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 18, color: '#fff',
              margin: '0 auto 16px',
            }}>M</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: t.text1 }}>Reset Password</h2>
          </div>
          <form onSubmit={handlePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <Key size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.text4 }} />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={inputStyle}
                placeholder="New password"
                required
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} tabIndex={-1}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.text4 }}>
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Key size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.text4 }} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                placeholder="Confirm password"
                required
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.text4 }}>
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button type="submit" disabled={resetLoading} style={{ ...btnStyle, opacity: resetLoading ? 0.7 : 1 }}>
              {resetLoading ? <Loader2 size={18} className="animate-spin" /> : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main Login UI
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: t.bgApp,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Left Panel — branding */}
      <div style={{
        width: '50%',
        background: 'linear-gradient(135deg, #080c12 0%, #0c1118 50%, #0a0e16 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }} className="hidden lg:flex">
        {/* Decorative elements */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04 }}>
          <div style={{ position: 'absolute', top: 60, left: 60, width: 120, height: 120, borderRadius: 24, border: '2px solid #2563eb', transform: 'rotate(15deg)' }} />
          <div style={{ position: 'absolute', bottom: 100, right: 80, width: 180, height: 180, borderRadius: 24, border: '2px solid #06b6d4', transform: 'rotate(-10deg)' }} />
          <div style={{ position: 'absolute', top: '40%', left: '25%', width: 80, height: 80, borderRadius: 16, border: '2px solid #8b5cf6', transform: 'rotate(25deg)' }} />
        </div>

        {/* Logo - Top Left */}
        <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, color: '#fff',
          }}>M</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Mosaic ERP</span>
        </div>

        {/* Center Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 48px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 28, color: '#fff',
            marginBottom: 28, boxShadow: '0 8px 32px rgba(37,99,235,0.3)',
          }}>M</div>

          <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', marginBottom: 16, textAlign: 'center', letterSpacing: '-0.5px' }}>
            Mosaic ERP
          </h1>

          {/* Colorful divider */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
            <div style={{ width: 32, height: 5, background: '#2563eb', borderRadius: 10 }} />
            <div style={{ width: 32, height: 5, background: '#10b981', borderRadius: 10 }} />
            <div style={{ width: 32, height: 5, background: '#f59e0b', borderRadius: 10 }} />
            <div style={{ width: 32, height: 5, background: '#8b5cf6', borderRadius: 10 }} />
          </div>

          <p style={{ color: '#5a7a9c', textAlign: 'center', fontSize: 15, maxWidth: 340, lineHeight: 1.6 }}>
            Enterprise insurance management platform for Mosaic Insurance Group
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: '#3a5878', fontSize: 12 }}>
            &copy; {new Date().getFullYear()} Mosaic Insurance Group
          </p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        position: 'relative',
      }}>
        {/* Environment Switcher - Top Right */}
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <EnvironmentSwitcher compact />
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile Logo */}
          <div className="lg:hidden" style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 18, color: '#fff',
            }}>M</div>
          </div>

          {/* Form Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: t.text1, letterSpacing: '-0.3px' }}>
              Insurance Management System
            </h2>
            <p style={{ color: t.text3, marginTop: 8, fontSize: 13 }}>Sign in to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: t.dangerBg,
              border: `1px solid ${t.danger}33`,
              color: t.danger,
              padding: '12px 16px',
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: t.text3, marginBottom: 6, letterSpacing: '0.3px' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.text4 }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="you@company.com"
                  onFocus={e => e.target.style.borderColor = t.accent}
                  onBlur={e => e.target.style.borderColor = t.border}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: t.text3, marginBottom: 6, letterSpacing: '0.3px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Key size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.text4 }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 42 }}
                  placeholder="Enter password"
                  onFocus={e => e.target.style.borderColor = t.accent}
                  onBlur={e => e.target.style.borderColor = t.border}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: t.text4,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ ...btnStyle, opacity: loading ? 0.7 : 1, marginTop: 4 }}
              onMouseEnter={e => (e.currentTarget.style.background = t.accentHover)}
              onMouseLeave={e => (e.currentTarget.style.background = t.accent)}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
            </button>
          </form>

          {/* Footer badges */}
          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.text4 }}>
              <CheckCircle size={13} style={{ color: t.success }} />
              Secure
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.text4 }}>
              <CheckCircle size={13} style={{ color: t.success }} />
              Encrypted
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
