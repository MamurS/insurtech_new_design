
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import { DB } from '../services/db';
import { useTheme } from '../theme/useTheme';
import { THEMES } from '../theme/tokens';
import SessionTimeoutWarning from './SessionTimeoutWarning';
import CommandPalette from './layout/CommandPalette';
import NotificationPanel from './notifications/NotificationPanel';
import EnvironmentBadge from './EnvironmentBadge';
import { PageHeaderProvider, usePageHeader } from '../context/PageHeaderContext';
import {
  LayoutDashboard, FileText, Settings, Search, Bell, Sun, Moon,
  FileSpreadsheet, Lock, LogOut, Building2, AlertOctagon, ClipboardList,
  ArrowDownRight, Globe, Home, BarChart3, Briefcase, FileSignature,
  Receipt, Shield, Calculator, FileCheck, TrendingUp, Zap, Wallet,
  Plus, Menu
} from 'lucide-react';

interface LayoutProps {
  children?: React.ReactNode;
}

// Tab definitions matching v15 mockup
interface TabDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={13} />, path: '/' },
  { id: 'policy-admin', label: 'Policy Admin', icon: <Briefcase size={13} />, path: '/direct-insurance' },
  { id: 'inward', label: 'Inward RI', icon: <ArrowDownRight size={13} />, path: '/inward-reinsurance' },
  { id: 'claims', label: 'Claims', icon: <AlertOctagon size={13} />, path: '/claims' },
  { id: 'financial-lines', label: 'Financial Lines', icon: <Shield size={13} /> },
  { id: 'billing', label: 'Billing', icon: <Wallet size={13} /> },
  { id: 'finance', label: 'Finance', icon: <Building2 size={13} />, path: '/financial-statements' },
];

// Sidebar items per active tab — context-sensitive navigation
interface SideItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  accent?: boolean;
}

const SIDE_ITEMS: Record<string, SideItem[]> = {
  dashboard: [
    { label: 'Overview', icon: <BarChart3 size={14} />, path: '/' },
    { label: 'Analytics', icon: <BarChart3 size={14} />, path: '/analytics' },
    { label: 'My Agenda', icon: <ClipboardList size={14} />, path: '/agenda' },
  ],
  'policy-admin': [
    { label: 'Portfolio', icon: <FileText size={14} />, path: '/direct-insurance' },
    { label: 'New Policy', icon: <Plus size={14} />, path: '/new', accent: true },
    { label: 'Analytics', icon: <BarChart3 size={14} />, path: '/analytics' },
    { label: 'Slips', icon: <FileSpreadsheet size={14} />, path: '/slips' },
    { label: 'Entities', icon: <Building2 size={14} />, path: '/entities' },
    { label: 'Clause Library', icon: <FileText size={14} />, path: '/clauses' },
  ],
  inward: [
    { label: 'Dashboard', icon: <BarChart3 size={14} />, path: '/inward-reinsurance' },
    { label: 'Foreign', icon: <Globe size={14} />, path: '/inward-reinsurance/foreign' },
    { label: 'Domestic', icon: <Home size={14} />, path: '/inward-reinsurance/domestic' },
    { label: 'New Foreign', icon: <Globe size={14} />, path: '/inward-reinsurance/foreign/new', accent: true },
    { label: 'New Domestic', icon: <Home size={14} />, path: '/inward-reinsurance/domestic/new', accent: true },
  ],
  claims: [
    { label: 'All Claims', icon: <AlertOctagon size={14} />, path: '/claims' },
    { label: 'Slips', icon: <FileSpreadsheet size={14} />, path: '/slips' },
  ],
  'financial-lines': [
    { label: 'MGA / Binders', icon: <FileSignature size={14} />, path: '/mga' },
  ],
  billing: [],
  finance: [
    { label: 'Financial Statements', icon: <Receipt size={14} />, path: '/financial-statements' },
    { label: 'Risk Accumulation', icon: <Shield size={14} />, path: '/risk-accumulation' },
    { label: 'IBNR — Manual', icon: <Calculator size={14} />, path: '/ibnr/manual' },
    { label: 'IBNR — BF Method', icon: <TrendingUp size={14} />, path: '/ibnr/bf-method' },
    { label: 'Regulatory', icon: <FileCheck size={14} />, path: '/regulatory' },
  ],
  admin: [
    { label: 'Settings', icon: <Settings size={14} />, path: '/settings' },
    { label: 'Entities', icon: <Building2 size={14} />, path: '/entities' },
    { label: 'Clause Library', icon: <FileText size={14} />, path: '/clauses' },
  ],
};

// Determine active tab from current route
function getActiveTab(pathname: string): string {
  if (pathname === '/') return 'dashboard';
  if (pathname.startsWith('/direct-insurance') || pathname.startsWith('/policy') || pathname.startsWith('/new') || pathname.startsWith('/edit') || pathname.startsWith('/wording')) return 'policy-admin';
  if (pathname.startsWith('/inward-reinsurance')) return 'inward';
  if (pathname.startsWith('/claims') || pathname.startsWith('/claim')) return 'claims';
  if (pathname.startsWith('/mga')) return 'financial-lines';
  if (pathname.startsWith('/financial') || pathname.startsWith('/risk-accumulation') || pathname.startsWith('/ibnr') || pathname.startsWith('/regulatory')) return 'finance';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/slips') || pathname.startsWith('/slip')) return 'policy-admin';
  if (pathname.startsWith('/entities') || pathname.startsWith('/clauses')) return 'policy-admin';
  if (pathname.startsWith('/analytics')) return 'dashboard';
  if (pathname.startsWith('/agenda')) return 'dashboard';
  if (pathname.startsWith('/settings')) return 'admin';
  return 'dashboard';
}

function getSideGroupLabel(tabId: string): string {
  switch (tabId) {
    case 'dashboard': return 'Navigation';
    case 'policy-admin': return 'Direct Insurance';
    case 'inward': return 'Reinsurance';
    case 'claims': return 'Claims';
    case 'financial-lines': return 'Financial Lines';
    case 'billing': return 'Billing';
    case 'finance': return 'Finance';
    case 'admin': return 'Administration';
    default: return 'Navigation';
  }
}

const LayoutInner: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { headerActions, headerLeft } = usePageHeader();
  const { theme, toggleTheme, t } = useTheme();

  const [sideOpen, setSideOpen] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [sessionTimeoutMs, setSessionTimeoutMs] = useState(30 * 60 * 1000);

  const activeTab = getActiveTab(location.pathname);
  const sideItems = SIDE_ITEMS[activeTab] || [];

  // Load session timeout: user localStorage override > global admin DB setting > 30 min default
  useEffect(() => {
    const userPref = localStorage.getItem('user_session_timeout_minutes');
    if (userPref && userPref !== 'default') {
      const minutes = Number(userPref);
      if (minutes > 0) {
        setSessionTimeoutMs(minutes * 60 * 1000);
        return;
      }
    }
    // Fall back to global admin setting from DB
    DB.getSetting('session_timeout_minutes').then(val => {
      if (val) {
        const minutes = Number(val);
        if (minutes > 0) setSessionTimeoutMs(minutes * 60 * 1000);
      }
    });
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsUserMenuOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    sessionStorage.clear();
    navigate('/login');
  };

  const handleSessionTimeout = useCallback(async () => {
    await signOut();
    sessionStorage.clear();
    navigate('/login');
  }, [signOut, navigate]);

  const { showWarning, remainingSeconds, continueSession, logoutNow } = useSessionTimeout({
    timeoutMs: sessionTimeoutMs,
    onTimeout: handleSessionTimeout,
    enabled: !!user,
  });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: t.bgApp, color: t.text1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Environment Banner */}
      <EnvironmentBadge />

      {/* ── Top Bar (44px) ── */}
      <div style={{
        background: t.topbar,
        borderBottom: `1px solid ${t.border}`,
        padding: '0 16px 0 8px',
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Hamburger toggle */}
          <button
            onClick={() => setSideOpen(v => !v)}
            title="Toggle sidebar"
            style={{
              width: 32, height: 32, borderRadius: 7,
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, flexShrink: 0, opacity: 0.7,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Menu size={16} style={{ color: t.text2 }} />
          </button>
          {/* Logo */}
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 10, color: '#fff',
          }}>
            M
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: t.text1 }}>Mosaic ERP</span>
          <span style={{
            padding: '2px 8px', borderRadius: 4,
            background: t.border, color: t.text3, fontSize: 10, fontWeight: 600,
          }}>
            v2
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Page-level header actions from pages */}
          {headerLeft && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
              {headerLeft}
            </div>
          )}
          {headerActions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
              {headerActions}
            </div>
          )}

          {/* Search trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', borderRadius: 7,
              background: t.bgInput, border: `1px solid ${t.border}`,
              cursor: 'pointer', color: t.text4, fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            <Search size={13} style={{ color: t.text4 }} />
            <span>Search...</span>
            <span style={{
              fontSize: 10, color: t.text5, background: t.bgApp,
              padding: '1px 5px', borderRadius: 3, border: `1px solid ${t.border}`,
              marginLeft: 8,
            }}>
              ⌘K
            </span>
          </button>

          {/* Notifications */}
          <button
            onClick={() => setNotifOpen(v => !v)}
            style={{
              width: 32, height: 32, borderRadius: 7,
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Bell size={16} style={{ color: t.text3 }} />
            <div style={{
              position: 'absolute', top: 6, right: 6,
              width: 7, height: 7, borderRadius: '50%',
              background: t.danger, border: `2px solid ${t.topbar}`,
            }} />
          </button>
          <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={{
              width: 32, height: 32, borderRadius: 7,
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {theme === 'dark'
              ? <Sun size={15} style={{ color: t.text3 }} />
              : <Moon size={15} style={{ color: t.text3 }} />}
          </button>

          {/* User avatar + menu */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setIsUserMenuOpen(v => !v)}
              style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {user?.name?.substring(0, 1) || 'U'}
            </div>

            {/* User dropdown */}
            {isUserMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setIsUserMenuOpen(false)} />
                <div style={{
                  position: 'absolute', top: 36, right: 0, width: 220,
                  background: t.bgPanel, border: `1px solid ${t.borderL}`,
                  borderRadius: 10, boxShadow: t.shadowLg, zIndex: 999, overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 14px', borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text1 }}>{user?.name || 'User'}</div>
                    <div style={{ fontSize: 11, color: t.text4, marginTop: 2 }}>{user?.email}</div>
                    <div style={{ fontSize: 10, color: t.text3, marginTop: 2 }}>{user?.role}</div>
                  </div>
                  <div style={{ padding: 4 }}>
                    <Link
                      to="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                        color: t.text2, fontSize: 12, textDecoration: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Settings size={14} />
                      Settings
                    </Link>
                    {(user?.role === 'Super Admin' || user?.role === 'Admin') && (
                      <Link
                        to="/admin"
                        onClick={() => setIsUserMenuOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                          color: t.text2, fontSize: 12, textDecoration: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Lock size={14} />
                        Admin Console
                      </Link>
                    )}
                    <button
                      onClick={() => { setIsUserMenuOpen(false); handleSignOut(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                        color: t.danger, fontSize: 12, width: '100%',
                        background: 'transparent', border: 'none', fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Bar (38px) ── */}
      <div style={{
        background: t.bgSidebar,
        borderBottom: `1px solid ${t.border}`,
        display: 'flex',
        alignItems: 'flex-end',
        padding: '0 12px',
        flexShrink: 0,
        height: 38,
        gap: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, flex: 1 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => { if (tab.path) navigate(tab.path); }}
                style={{
                  padding: '0 16px',
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  cursor: tab.path ? 'pointer' : 'default',
                  borderRadius: '6px 6px 0 0',
                  background: active ? t.bgApp : 'transparent',
                  borderTop: active ? `2px solid ${t.accent}` : '2px solid transparent',
                  borderLeft: active ? `1px solid ${t.border}` : '1px solid transparent',
                  borderRight: active ? `1px solid ${t.border}` : '1px solid transparent',
                  borderBottom: active ? `1px solid ${t.bgApp}` : 'none',
                  marginBottom: active ? -1 : 0,
                  transition: 'all 0.12s',
                  position: 'relative',
                  zIndex: active ? 2 : 1,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.bgHover; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? t.bgApp : 'transparent'; }}
              >
                <span style={{ color: active ? t.accent : t.text4, display: 'flex', alignItems: 'center' }}>{tab.icon}</span>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? t.text1 : t.text3, whiteSpace: 'nowrap' }}>{tab.label}</span>
              </div>
            );
          })}
        </div>
        {/* Admin tab on the right */}
        {(user?.role === 'Super Admin' || user?.role === 'Admin') && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
            <div
              onClick={() => navigate('/admin')}
              style={{
                padding: '0 14px',
                height: 34,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                background: activeTab === 'admin' ? t.bgApp : 'transparent',
                borderTop: activeTab === 'admin' ? `2px solid ${t.text3}` : '2px solid transparent',
                borderLeft: activeTab === 'admin' ? `1px solid ${t.border}` : '1px solid transparent',
                borderRight: activeTab === 'admin' ? `1px solid ${t.border}` : '1px solid transparent',
                borderBottom: activeTab === 'admin' ? `1px solid ${t.bgApp}` : 'none',
                marginBottom: activeTab === 'admin' ? -1 : 0,
                position: 'relative',
                zIndex: activeTab === 'admin' ? 2 : 1,
              }}
              onMouseEnter={e => { if (activeTab !== 'admin') e.currentTarget.style.background = t.bgHover; }}
              onMouseLeave={e => { if (activeTab !== 'admin') e.currentTarget.style.background = 'transparent'; }}
            >
              <Settings size={13} style={{ color: activeTab === 'admin' ? t.text1 : t.text4 }} />
              <span style={{ fontSize: 13, fontWeight: activeTab === 'admin' ? 600 : 400, color: activeTab === 'admin' ? t.text1 : t.text3 }}>Admin</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Body (sidebar + content) ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Context Sidebar (190px) */}
        <div style={{
          width: sideOpen ? 190 : 0,
          minWidth: sideOpen ? 190 : 0,
          background: t.bgSidebar,
          borderRight: `1px solid ${t.border}`,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.2s ease, min-width 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ width: 190, padding: '14px 0', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: t.sideGroup,
              textTransform: 'uppercase', letterSpacing: 1.2,
              padding: '6px 16px 8px', whiteSpace: 'nowrap',
            }}>
              {getSideGroupLabel(activeTab)}
            </div>
            {sideItems.map((item, i) => (
              <Link
                key={i}
                to={item.path || '#'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '9px 16px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  borderLeft: item.accent ? `2px solid ${t.accent}` : '2px solid transparent',
                  background: item.path === location.pathname ? t.bgActive : 'transparent',
                  transition: 'background 0.12s',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
                onMouseEnter={e => { if (item.path !== location.pathname) e.currentTarget.style.background = t.bgHover; }}
                onMouseLeave={e => { if (item.path !== location.pathname) e.currentTarget.style.background = item.path === location.pathname ? t.bgActive : 'transparent'; }}
              >
                <span style={{ color: item.accent ? t.accent : t.text4, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                <span style={{ fontSize: 13, color: item.accent ? t.accent : (item.path === location.pathname ? t.accent : t.text2), fontWeight: (item.path === location.pathname || item.accent) ? 500 : 400 }}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Main content area */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          background: t.bgApp,
        }} className="main-content-area">
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Session Timeout Warning Modal */}
      {showWarning && (
        <SessionTimeoutWarning
          remainingSeconds={remainingSeconds}
          onContinue={continueSession}
          onLogout={logoutNow}
        />
      )}
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => (
  <PageHeaderProvider>
    <LayoutInner>{children}</LayoutInner>
  </PageHeaderProvider>
);

export default Layout;
