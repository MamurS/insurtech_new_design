
import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/useTheme';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ContextBar } from '../components/ContextBar';
import EnvironmentSwitcher from '../components/EnvironmentSwitcher';
import { getDbEnvironment } from '../services/supabase';
import {
  Save, Download, Upload, Database,
  Building, Globe, Moon, Bell, Shield,
  HardDrive, Check, RefreshCw, Server, Timer
} from 'lucide-react';

const SETTINGS_KEY = 'insurtech_app_settings';

interface AppSettings {
  companyName: string;
  currency: string;
  dateFormat: string;
  defaultCommission: number;
  defaultTax: number;
  enableNotifications: boolean;
  theme: 'light' | 'dark';
}

const DEFAULT_SETTINGS: AppSettings = {
  companyName: '',
  currency: 'USD',
  dateFormat: 'dd.mm.yyyy',
  defaultCommission: 15.0,
  defaultTax: 0,
  enableNotifications: true,
  theme: 'light'
};

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [storageStats, setStorageStats] = useState<{ used: string; items: number }>({ used: '0 KB', items: 0 });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [restoreConfirm, setRestoreConfirm] = useState<{ isOpen: boolean; file: File | null }>({ isOpen: false, file: null });
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useTheme();
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
  const currentEnv = getDbEnvironment();

  const USER_TIMEOUT_KEY = 'user_session_timeout_minutes';
  const [userTimeout, setUserTimeout] = useState<string>('default');

  useEffect(() => {
    // Load Settings
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      setSettings(JSON.parse(stored));
    }
    // Load user session timeout preference
    const savedTimeout = localStorage.getItem(USER_TIMEOUT_KEY);
    if (savedTimeout) {
      setUserTimeout(savedTimeout);
    }
    calculateStorage();
  }, []);

  const calculateStorage = () => {
    let total = 0;
    let count = 0;
    for (let x in localStorage) {
      if (localStorage.hasOwnProperty(x)) {
        total += ((localStorage[x].length * 2));
        count++;
      }
    }
    const kb = (total / 1024).toFixed(2);
    setStorageStats({ used: `${kb} KB`, items: count });
  };

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaveStatus('saved');

    // We do NOT reload the page to prevent crashes in some hosting environments.
    // Since components read settings from localStorage on render,
    // simply navigating away from this page will reflect changes.
    setTimeout(() => {
        setSaveStatus('idle');
    }, 2000);
  };

  const handleChange = (field: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleBackup = async () => {
    const policies = await DB.getAllPolicies();
    const slips = await DB.getAllSlips();
    const clauses = await DB.getAllClauses();

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      settings,
      data: { policies, slips, clauses }
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insurtech_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRestoreConfirm({ isOpen: true, file });
    event.target.value = ''; // Reset input
  };

  const performRestore = () => {
    if (!restoreConfirm.file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const json = JSON.parse(raw);

        // Basic validation
        if (!json.data || !json.data.policies) throw new Error("Invalid backup format");

        // Restore
        localStorage.setItem('insurtech_policies', JSON.stringify(json.data.policies));
        localStorage.setItem('insurtech_slips', JSON.stringify(json.data.slips));
        localStorage.setItem('insurtech_clauses', JSON.stringify(json.data.clauses));

        if (json.settings) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(json.settings));
        }

        toast.success('System restored successfully. The page will now reload.');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        console.error(err);
        toast.error('Failed to restore data. The file might be corrupted or incompatible.');
      }
    };
    reader.readAsText(restoreConfirm.file);
    setRestoreConfirm({ isOpen: false, file: null });
  };

  const inputStyle: React.CSSProperties = {
    background: t.bgInput,
    border: `1px solid ${t.border}`,
    color: t.text1,
  };

  const selectStyle: React.CSSProperties = {
    background: t.bgInput,
    border: `1px solid ${t.border}`,
    color: t.text1,
  };

  const cardStyle: React.CSSProperties = {
    background: t.bgPanel,
    borderColor: t.border,
    boxShadow: t.shadow,
  };

  const cardHeaderStyle: React.CSSProperties = {
    background: t.bgCard,
    color: t.text2,
    borderColor: t.border,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      {/* Context Bar */}
      <ContextBar
        status="ACTIVE"
        breadcrumbs={[
          { label: 'Configuration' },
          { label: 'Settings' }
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-3xl font-bold" style={{ color: t.text1 }}>Settings & Tools</h2>
            <p style={{ color: t.text3 }}>Configure application preferences and manage data.</p>
        </div>
        <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all text-white"
            style={{
              background: saveStatus === 'saved' ? t.success : t.accent,
              boxShadow: t.shadow,
            }}
        >
            {saveStatus === 'saved' ? <Check size={20} /> : <Save size={20} />}
            {saveStatus === 'saved' ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* General Configuration */}
        <div className="rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="p-4 border-b font-bold flex items-center gap-2" style={cardHeaderStyle}>
                <Globe size={18} /> General Configuration
            </div>
            <div className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: t.text2 }}>Company Name</label>
                    <div className="relative">
                        <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
                        <input
                            type="text"
                            value={settings.companyName}
                            onChange={(e) => handleChange('companyName', e.target.value)}
                            className="w-full pl-10 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            style={inputStyle}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: t.text2 }}>Default Currency</label>
                        <select
                            value={settings.currency}
                            onChange={(e) => handleChange('currency', e.target.value)}
                            className="w-full p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            style={selectStyle}
                        >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="UZS">UZS (so'm)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: t.text2 }}>Date Format</label>
                        <select
                            value={settings.dateFormat}
                            onChange={(e) => handleChange('dateFormat', e.target.value)}
                            className="w-full p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            style={selectStyle}
                        >
                            <option value="dd.mm.yyyy">dd.mm.yyyy</option>
                            <option value="dd/mm/yyyy">dd/mm/yyyy</option>
                            <option value="mm/dd/yyyy">mm/dd/yyyy</option>
                            <option value="mm.dd.yyyy">mm.dd.yyyy</option>
                            <option value="dd-mm-yyyy">dd-mm-yyyy</option>
                            <option value="mm-dd-yyyy">mm-dd-yyyy</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                     <span className="text-sm font-medium flex items-center gap-2" style={{ color: t.text2 }}>
                        <Moon size={16} /> Dark Mode <span className="text-xs font-normal" style={{ color: t.text4 }}>(Coming Soon)</span>
                     </span>
                     <div className="w-10 h-6 rounded-full relative cursor-not-allowed" style={{ background: t.border }}>
                        <div className="absolute left-1 top-1 w-4 h-4 rounded-full" style={{ background: t.bgPanel, boxShadow: t.shadow }}></div>
                     </div>
                </div>
            </div>
        </div>

        {/* Policy Defaults */}
         <div className="rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="p-4 border-b font-bold flex items-center gap-2" style={cardHeaderStyle}>
                <Shield size={18} /> Policy Defaults
            </div>
            <div className="p-6 space-y-4">
                <p className="text-sm mb-4" style={{ color: t.text3 }}>Set default values for new policy records to speed up data entry.</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: t.text2 }}>Default Commission %</label>
                        <input
                            type="number"
                            step="0.1"
                            value={settings.defaultCommission}
                            onChange={(e) => handleChange('defaultCommission', parseFloat(e.target.value))}
                            className="w-full p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: t.text2 }}>Default Tax %</label>
                        <input
                            type="number"
                            step="0.1"
                            value={settings.defaultTax}
                            onChange={(e) => handleChange('defaultTax', parseFloat(e.target.value))}
                            className="w-full p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            style={inputStyle}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                     <input
                        type="checkbox"
                        id="notif"
                        checked={settings.enableNotifications}
                        onChange={(e) => handleChange('enableNotifications', e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                     />
                     <label htmlFor="notif" className="text-sm flex items-center gap-2" style={{ color: t.text2 }}>
                        Enable Expiry Notifications <Bell size={14} style={{ color: t.text4 }}/>
                     </label>
                </div>
            </div>
        </div>

        {/* Session Timeout */}
        <div className="md:col-span-2 rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="p-4 border-b font-bold flex items-center gap-2" style={cardHeaderStyle}>
                <Timer size={18} /> Session Timeout
            </div>
            <div className="p-6 space-y-4">
                <p className="text-sm" style={{ color: t.text3 }}>Auto-logout after inactivity. Choose a personal override or use the default set by your administrator.</p>
                <div className="flex items-center gap-4">
                    <label className="block text-sm font-medium" style={{ color: t.text2 }}>Timeout duration:</label>
                    <select
                        value={userTimeout}
                        onChange={(e) => setUserTimeout(e.target.value)}
                        className="p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        style={selectStyle}
                    >
                        <option value="default">Use default (from Admin)</option>
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="120">2 hours</option>
                        <option value="240">4 hours</option>
                    </select>
                    <button
                        onClick={() => {
                            localStorage.setItem(USER_TIMEOUT_KEY, userTimeout);
                            toast.success('Session timeout preference saved');
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium"
                        style={{ background: t.accent }}
                    >
                        <Save size={16} />
                        Save
                    </button>
                </div>
                <p className="text-xs" style={{ color: t.text4 }}>
                    {userTimeout === 'default'
                        ? 'Using the global timeout configured by your administrator.'
                        : `Your session will expire after ${userTimeout === '60' ? '1 hour' : userTimeout === '120' ? '2 hours' : userTimeout === '240' ? '4 hours' : `${userTimeout} minutes`} of inactivity.`}
                </p>
            </div>
        </div>

        {/* Data Tools */}
        <div className="md:col-span-2 rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="p-4 border-b font-bold flex items-center gap-2" style={cardHeaderStyle}>
                <Database size={18} /> Data Management
            </div>
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Backup */}
                    <div className="border rounded-lg p-4 transition-colors" style={{ borderColor: t.border }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: `${t.accent}18`, color: t.accent }}>
                            <Download size={20} />
                        </div>
                        <h4 className="font-bold" style={{ color: t.text1 }}>Backup Data</h4>
                        <p className="text-xs mb-4 mt-1" style={{ color: t.text3 }}>Export all policies, slips, and settings to a JSON file.</p>
                        <button onClick={handleBackup} className="w-full py-2 text-sm font-medium rounded transition-colors" style={{ color: t.accent, background: `${t.accent}18` }}>
                            Download Backup
                        </button>
                    </div>

                    {/* Restore */}
                    <div className="border rounded-lg p-4 transition-colors relative" style={{ borderColor: t.border }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: t.bgCard, color: t.accent }}>
                            <Upload size={20} />
                        </div>
                        <h4 className="font-bold" style={{ color: t.text1 }}>Restore Data</h4>
                        <p className="text-xs mb-4 mt-1" style={{ color: t.text3 }}>Import data from a backup file. Overwrites current data.</p>
                        <label className="w-full block text-center py-2 text-sm font-medium rounded transition-colors cursor-pointer" style={{ color: t.accent, background: t.bgCard }}>
                            Select File
                            <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
                        </label>
                    </div>

                    {/* Storage Info */}
                    <div className="border rounded-lg p-4 transition-colors" style={{ borderColor: t.border }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: t.bgCard, color: t.text2 }}>
                            <HardDrive size={20} />
                        </div>
                        <h4 className="font-bold" style={{ color: t.text1 }}>Local Storage</h4>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-sm">
                                <span style={{ color: t.text3 }}>Used Space:</span>
                                <span className="font-mono font-medium" style={{ color: t.text1 }}>{storageStats.used}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span style={{ color: t.text3 }}>Total Items:</span>
                                <span className="font-mono font-medium" style={{ color: t.text1 }}>{storageStats.items}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Database Environment - Admin Only */}
        {isAdmin && (
          <div className="md:col-span-2 rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="p-4 border-b font-bold flex items-center gap-2" style={cardHeaderStyle}>
              <Server size={18} /> Database Environment
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: t.text2 }}>Current Environment</p>
                  <p className="text-xs mt-1" style={{ color: t.text3 }}>
                    Switch between production and staging databases. The page will reload when switching.
                  </p>
                  {currentEnv === 'staging' && (
                    <p className="text-xs mt-2 font-medium" style={{ color: t.warning }}>
                      You are connected to the staging environment. Changes will not affect production.
                    </p>
                  )}
                </div>
                <EnvironmentSwitcher />
              </div>
            </div>
          </div>
        )}

      </div>

      <ConfirmDialog
        isOpen={restoreConfirm.isOpen}
        title="Restore Data?"
        message="Restoring data will overwrite your current database. This action cannot be undone. Continue?"
        onConfirm={performRestore}
        onCancel={() => setRestoreConfirm({ isOpen: false, file: null })}
        variant="warning"
        confirmText="Restore"
      />
    </div>
  );
};

export default Settings;
