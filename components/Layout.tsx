
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import { DB } from '../services/db';
import SessionTimeoutWarning from './SessionTimeoutWarning';
import {
  LayoutDashboard, FileText, Settings,
  FileSpreadsheet, Lock, PanelLeftClose, PanelLeftOpen,
  LogOut, User as UserIcon, Building2, AlertOctagon, ClipboardList,
  ChevronDown, ChevronRight, ChevronUp, ArrowDownRight, Globe, Home, BarChart3, Briefcase, FileSignature, Receipt, Shield, Calculator, FileCheck, TrendingUp
} from 'lucide-react';
import { MosaicLogo } from './MosaicLogo';
import EnvironmentBadge from './EnvironmentBadge';
import { PageHeaderProvider, usePageHeader } from '../context/PageHeaderContext';

interface LayoutProps {
  children?: React.ReactNode;
}

// Route groups define which routes should highlight which nav items
const routeGroups: Record<string, string[]> = {
  '/': ['/'], // Dashboard only - analytics view
  '/direct-insurance': ['/direct-insurance', '/policy', '/new', '/edit', '/wording'], // Direct insurance policies
  '/inward-reinsurance': ['/inward-reinsurance'], // Inward reinsurance dashboard and sub-pages
  '/mga': ['/mga'],
  '/analytics': ['/analytics'],
  '/financial-statements': ['/financial-statements'],
  '/risk-accumulation': ['/risk-accumulation'],
  '/ibnr': ['/ibnr', '/ibnr/manual', '/ibnr/bf-method'],
  '/regulatory': ['/regulatory'],
  '/slips': ['/slips', '/slip'],
  '/claims': ['/claims', '/claim'],
  '/agenda': ['/agenda'],
  '/entities': ['/entities'],
  '/clauses': ['/clauses'],
  '/admin': ['/admin'],
};

const getPageTitle = (pathname: string): string => {
  if (pathname === '/') return 'Portfolio';
  if (pathname.startsWith('/direct-insurance') || pathname.startsWith('/policy') || pathname.startsWith('/new') || pathname.startsWith('/edit')) return 'Direct Insurance';
  if (pathname.includes('/inward-reinsurance/foreign')) return 'Inward Reinsurance — Foreign';
  if (pathname.includes('/inward-reinsurance/domestic')) return 'Inward Reinsurance — Domestic';
  if (pathname.startsWith('/inward-reinsurance')) return 'Inward Reinsurance';
  if (pathname.startsWith('/mga')) return 'MGA / Binders';
  if (pathname.startsWith('/analytics')) return 'Analytics';
  if (pathname.startsWith('/financial')) return 'Technical Account';
  if (pathname.startsWith('/risk-accumulation')) return 'Risk Accumulation';
  if (pathname.includes('/ibnr/manual')) return 'IBNR — Manual Entry';
  if (pathname.includes('/ibnr/bf-method')) return 'IBNR — BF Method';
  if (pathname.startsWith('/ibnr')) return 'IBNR Estimation';
  if (pathname.startsWith('/regulatory')) return 'Regulatory Reporting';
  if (pathname.startsWith('/slips') || pathname.startsWith('/slip')) return 'Slips';
  if (pathname.startsWith('/claims') || pathname.startsWith('/claim')) return 'Claims';
  if (pathname.startsWith('/entities')) return 'Legal Entities';
  if (pathname.startsWith('/clauses')) return 'Clause Library';
  if (pathname.startsWith('/admin')) return 'Admin Console';
  if (pathname.startsWith('/agenda')) return 'My Agenda';
  if (pathname.startsWith('/wording')) return 'Policy Wording';
  if (pathname.startsWith('/settings')) return 'Settings';
  return '';
};

const LayoutInner: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { headerActions, headerLeft } = usePageHeader();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInwardReinsuranceOpen, setIsInwardReinsuranceOpen] = useState(
    location.pathname.includes('/inward-reinsurance')
  );
  const [isIbnrOpen, setIsIbnrOpen] = useState(
    location.pathname.includes('/ibnr')
  );
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [sessionTimeoutMs, setSessionTimeoutMs] = useState(30 * 60 * 1000);

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

  // Close user menu on route change
  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [location.pathname]);

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

  const getLinkClass = (navPath: string, exact: boolean = false) => {
    let isActive = false;

    if (exact || navPath === '/') {
      // Dashboard (/) should ONLY match exactly "/"
      isActive = location.pathname === navPath;
    } else {
      // Other paths use startsWith matching
      isActive = location.pathname.startsWith(navPath);
    }

    // Check route groups for additional matching paths
    if (!isActive && routeGroups[navPath]) {
      isActive = routeGroups[navPath].some(p =>
        p === '/' ? location.pathname === p : location.pathname.startsWith(p)
      );
    }

    return `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
      isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
    }`;
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Environment Banner - shown when on staging */}
      <EnvironmentBadge />

      <div className="flex-1 bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`bg-slate-900 text-white flex-shrink-0 flex flex-col z-30 transition-all duration-300 ease-in-out shadow-xl relative
        ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full opacity-0 overflow-hidden'}`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-700/50">
          <Link to="/">
            <MosaicLogo variant="white" size="sm" showText />
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
          <Link
            to="/"
            className={getLinkClass('/', true)}
            title="Portfolio"
          >
            <LayoutDashboard size={20} className="flex-shrink-0" />
            <span>Portfolio</span>
          </Link>

          {/* Direct Insurance */}
          <Link
            to="/direct-insurance"
            className={getLinkClass('/direct-insurance')}
            title="Direct Insurance"
          >
            <Briefcase size={20} className="flex-shrink-0" />
            <span>Direct Insurance</span>
          </Link>

          {/* Inward Reinsurance Collapsible Section */}
          <div className="pt-2">
            <div
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
                location.pathname.includes('/inward-reinsurance')
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Link
                to="/inward-reinsurance"
                onClick={() => setIsInwardReinsuranceOpen(true)}
                className="flex items-center gap-3 flex-1"
                title="Inward Reinsurance Dashboard"
              >
                <ArrowDownRight size={20} className="flex-shrink-0" />
                <span className="text-left">Inward Reinsurance</span>
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsInwardReinsuranceOpen(!isInwardReinsuranceOpen);
                }}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
                title={isInwardReinsuranceOpen ? "Collapse" : "Expand"}
              >
                {isInwardReinsuranceOpen ? (
                  <ChevronDown size={16} className="flex-shrink-0" />
                ) : (
                  <ChevronRight size={16} className="flex-shrink-0" />
                )}
              </button>
            </div>

            {/* Nested Links */}
            {isInwardReinsuranceOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700 pl-2">
                <Link
                  to="/inward-reinsurance/foreign"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${
                    location.pathname.includes('/inward-reinsurance/foreign')
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  title="Foreign/Overseas"
                >
                  <Globe size={16} className="flex-shrink-0" />
                  <span>Foreign</span>
                </Link>
                <Link
                  to="/inward-reinsurance/domestic"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${
                    location.pathname.includes('/inward-reinsurance/domestic')
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  title="Domestic"
                >
                  <Home size={16} className="flex-shrink-0" />
                  <span>Domestic</span>
                </Link>
              </div>
            )}
          </div>

          <Link
            to="/mga"
            className={getLinkClass('/mga')}
            title="MGA / Binders"
          >
            <FileSignature size={20} className="flex-shrink-0" />
            <span>MGA / Binders</span>
          </Link>

          <Link
            to="/analytics"
            className={getLinkClass('/analytics')}
            title="Analytics"
          >
            <BarChart3 size={20} className="flex-shrink-0" />
            <span>Analytics</span>
          </Link>

          <Link
            to="/financial-statements"
            className={getLinkClass('/financial-statements')}
            title="Financial Statements"
          >
            <Receipt size={20} className="flex-shrink-0" />
            <span>Financial Statements</span>
          </Link>

          <Link
            to="/risk-accumulation"
            className={getLinkClass('/risk-accumulation')}
            title="Risk Accumulation"
          >
            <Shield size={20} className="flex-shrink-0" />
            <span>Risk Accumulation</span>
          </Link>

          {/* IBNR Estimation Collapsible Section */}
          <div className="pt-2">
            <div
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
                location.pathname.includes('/ibnr')
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Link
                to="/ibnr/manual"
                onClick={() => setIsIbnrOpen(true)}
                className="flex items-center gap-3 flex-1"
                title="IBNR Estimation"
              >
                <Calculator size={20} className="flex-shrink-0" />
                <span className="text-left">IBNR Estimation</span>
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsIbnrOpen(!isIbnrOpen);
                }}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
                title={isIbnrOpen ? "Collapse" : "Expand"}
              >
                {isIbnrOpen ? (
                  <ChevronDown size={16} className="flex-shrink-0" />
                ) : (
                  <ChevronRight size={16} className="flex-shrink-0" />
                )}
              </button>
            </div>

            {/* Nested Links */}
            {isIbnrOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700 pl-2">
                <Link
                  to="/ibnr/manual"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${
                    location.pathname.includes('/ibnr/manual') || (location.pathname === '/ibnr' && !location.pathname.includes('/bf-method'))
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  title="Manual Entry"
                >
                  <FileText size={16} className="flex-shrink-0" />
                  <span>Manual Entry</span>
                </Link>
                <Link
                  to="/ibnr/bf-method"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${
                    location.pathname.includes('/ibnr/bf-method')
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  title="BF Method"
                >
                  <TrendingUp size={16} className="flex-shrink-0" />
                  <span>BF Method</span>
                </Link>
              </div>
            )}
          </div>

          <Link
            to="/regulatory"
            className={getLinkClass('/regulatory')}
            title="Regulatory Reports"
          >
            <FileCheck size={20} className="flex-shrink-0" />
            <span>Regulatory Reports</span>
          </Link>

          <Link
            to="/agenda"
            className={getLinkClass('/agenda')}
            title="My Agenda"
          >
            <ClipboardList size={20} className="flex-shrink-0" />
            <span>My Agenda</span>
          </Link>

          <Link
              to="/slips"
              className={getLinkClass('/slips')}
              title="Reinsurance Slips"
          >
              <FileSpreadsheet size={20} className="flex-shrink-0" />
              <span>Reinsurance Slips</span>
          </Link>

          <Link
              to="/claims"
              className={getLinkClass('/claims')}
              title="Claims Center"
          >
              <AlertOctagon size={20} className="flex-shrink-0" />
              <span>Claims Center</span>
          </Link>

          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
            Configuration
          </div>

          <Link 
              to="/entities" 
              className={getLinkClass('/entities')}
              title="Legal Entities"
          >
              <Building2 size={20} className="flex-shrink-0" />
              <span>Legal Entities</span>
          </Link>

          <Link 
              to="/clauses" 
              className={getLinkClass('/clauses')}
              title="Clause Library"
          >
              <FileText size={20} className="flex-shrink-0" />
              <span>Clause Library</span>
          </Link>

          {/* Admin Console - Restricted to Super Admin and Admin only */}
          {(user?.role === 'Super Admin' || user?.role === 'Admin') && (
             <Link 
              to="/admin" 
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap mt-2 ${location.pathname.startsWith('/admin') ? 'bg-emerald-800 text-emerald-100' : 'text-emerald-400 hover:bg-emerald-900/50'}`}
              title="Admin Console"
            >
              <Lock size={18} className="flex-shrink-0" />
              <span className="font-semibold">Admin Console</span>
            </Link>
          )}
        </nav>

        {/* User Profile Section with Popup */}
        <div className="p-4 border-t border-slate-700/50 relative">
          {/* Clickable User Card */}
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-left"
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.avatarUrl || user?.name?.substring(0, 1) || 'U'}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role || 'Role'}</p>
            </div>

            {/* Chevron */}
            <ChevronUp
              size={16}
              className={`text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Popup Menu */}
          {isUserMenuOpen && (
            <>
              {/* Backdrop to close menu when clicking outside */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsUserMenuOpen(false)}
              />

              {/* Menu */}
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50">
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-slate-700">
                  <p className="text-sm font-medium text-white">{user?.name}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    to="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <Settings size={18} />
                    <span className="text-sm">Settings</span>
                  </Link>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleSignOut();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    <LogOut size={18} />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-full min-w-0">

          {/* Global Header (Fixed at top of content area) */}
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center shadow-sm z-20 flex-shrink-0 relative">
                <div className="flex items-center">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 text-slate-500 hover:bg-gray-100 hover:text-slate-800 rounded-lg transition-colors focus:outline-none"
                        title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                    </button>
                </div>
                {headerLeft && (
                    <div className="hidden md:flex items-center gap-2 ml-2">
                        {headerLeft}
                    </div>
                )}
                <div className="flex-1 text-center">
                    <h1 className="text-xl font-bold text-gray-800">{getPageTitle(location.pathname)}</h1>
                </div>
                <div className="flex items-center gap-2">
                    {headerActions}
                </div>
                {/* Blur fade strip below header */}
                <div className="absolute left-0 right-0 top-full h-6 pointer-events-none z-10"
                     style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', background: 'linear-gradient(to bottom, rgba(249,250,251,0.85), rgba(249,250,251,0))' }} />
          </header>

          {/* Scrollable Page Content */}
          <main className="flex-1 overflow-y-scroll pt-2 px-4 pb-4 md:pt-2 md:px-8 md:pb-8 relative main-content-area">
             <div className="w-full mx-auto">
                {children}
             </div>
          </main>
      </div>
      </div>

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
