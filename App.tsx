
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionProvider } from './context/PermissionContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './theme/ThemeContext';
import Dashboard from './pages/Dashboard';
import PolicyForm from './pages/PolicyForm';
import PolicyWording from './pages/PolicyWording';
import ClauseManager from './pages/ClauseManager';
import SlipsDashboard from './pages/SlipsDashboard';
import SlipForm from './pages/SlipForm';
import Settings from './pages/Settings';
import AdminConsole from './pages/AdminConsole';
import Login from './pages/Login';
import EntityManager from './pages/EntityManager';
import EntityForm from './pages/EntityForm';
import ClaimsList from './pages/ClaimsList';
import ClaimDetail from './pages/ClaimDetail';
import Agenda from './pages/Agenda';
import InwardReinsuranceList from './pages/InwardReinsuranceList';
import InwardReinsuranceForm from './pages/InwardReinsuranceForm';
import InwardReinsuranceDashboard from './pages/InwardReinsuranceDashboard';
import Analytics from './pages/Analytics';
import DirectInsuranceList from './pages/DirectInsuranceList';
import MGADashboard from './pages/MGADashboard';
import FinancialStatements from './pages/FinancialStatements';
import RiskAccumulation from './pages/RiskAccumulation';
import IBNREstimation from './pages/IBNREstimation';
import RegulatoryReporting from './pages/RegulatoryReporting';

// Protected Route Component
const ProtectedRoute = ({ children }: React.PropsWithChildren) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading Session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Admin Route Component (Now enhanced by Permission logic inside AdminConsole, but kept for high level protection)
const AdminRoute = ({ children }: React.PropsWithChildren) => {
  const { user, loading } = useAuth();
  
  if (loading) return null;

  // Basic role check fallback, Permissions handled deeper
  if (user?.role !== 'Super Admin' && user?.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Main Application - Wrapped in Layout */}
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />

              {/* Admin Console — inside Layout for v15 tab bar */}
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminConsole />
                </AdminRoute>
              } />

              {/* Direct Insurance Routes */}
              <Route path="/direct-insurance" element={<DirectInsuranceList />} />
              <Route path="/policy/:id" element={<PolicyForm />} />

              <Route path="/mga" element={<MGADashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/financial-statements" element={<FinancialStatements />} />
              <Route path="/risk-accumulation" element={<RiskAccumulation />} />
              <Route path="/ibnr" element={<Navigate to="/ibnr/manual" replace />} />
              <Route path="/ibnr/manual" element={<IBNREstimation />} />
              <Route path="/ibnr/bf-method" element={<IBNREstimation />} />
              <Route path="/regulatory" element={<RegulatoryReporting />} />
              <Route path="/new" element={<PolicyForm />} />
              <Route path="/edit/:id" element={<PolicyForm />} />
              <Route path="/wording/:id" element={<PolicyWording />} />
              <Route path="/clauses" element={<ClauseManager />} />
              
              {/* Slips Routes */}
              <Route path="/slips" element={<SlipsDashboard />} />
              <Route path="/slips/new" element={<SlipForm />} />
              <Route path="/slips/edit/:id" element={<SlipForm />} />

              {/* Claims Routes */}
              <Route path="/claims" element={<ClaimsList />} />
              <Route path="/claims/:id" element={<ClaimDetail />} />

              {/* Legal Entities Routes */}
              <Route path="/entities" element={<EntityManager />} />
              <Route path="/entities/new" element={<EntityForm />} />
              <Route path="/entities/edit/:id" element={<EntityForm />} />
              
              {/* Agenda / Tasks */}
              <Route path="/agenda" element={<Agenda />} />

              {/* Inward Reinsurance Routes */}
              <Route path="/inward-reinsurance" element={<InwardReinsuranceDashboard />} />
              <Route path="/inward-reinsurance/foreign" element={<InwardReinsuranceList />} />
              <Route path="/inward-reinsurance/foreign/new" element={<InwardReinsuranceForm />} />
              <Route path="/inward-reinsurance/foreign/edit/:id" element={<InwardReinsuranceForm />} />
              <Route path="/inward-reinsurance/foreign/view/:id" element={<InwardReinsuranceForm />} />
              <Route path="/inward-reinsurance/domestic" element={<InwardReinsuranceList />} />
              <Route path="/inward-reinsurance/domestic/new" element={<InwardReinsuranceForm />} />
              <Route path="/inward-reinsurance/domestic/edit/:id" element={<InwardReinsuranceForm />} />
              <Route path="/inward-reinsurance/domestic/view/:id" element={<InwardReinsuranceForm />} />

              <Route path="/settings" element={<Settings />} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <PermissionProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </PermissionProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
