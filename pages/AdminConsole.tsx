import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../services/db';
import { CBUService } from '../services/cbuService';
import { AuthService } from '../services/auth';
import { UserService } from '../services/userService';
import { PermissionService } from '../services/permissionService';
import { useAuth } from '../context/AuthContext';
import { useProfiles, useUpdateProfile } from '../hooks/useUsers';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useTheme } from '../theme/useTheme';
import { Policy, ReinsuranceSlip, Clause, PolicyTemplate, UserRole, ExchangeRate, Currency, Profile, Role, Department, InwardReinsurancePreset } from '../types';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { RoleEditModal } from '../components/RoleEditModal';
import { DepartmentEditModal } from '../components/DepartmentEditModal';
import { DatePickerInput, parseDate, toISODateString } from '../components/DatePickerInput';
import { supabase } from '../services/supabase';
import {
  Trash2, RefreshCw, Users,
  Lock, Table, Code,
  Activity, ShieldCheck, FileText, Plus, Save, X, Edit, Loader2, Phone, AlertTriangle,
  Coins, LogOut, Key, Building2, Briefcase, DollarSign, TrendingDown, TrendingUp,
  PieChart, BarChart3, Clock, CheckCircle, AlertCircle, ScrollText, List, Globe, Minus, Timer,
  UserX, Mail
} from 'lucide-react';

type Section = 'dashboard' | 'database' | 'recycle' | 'roles' | 'users' | 'departments' | 'settings' | 'templates' | 'fx' | 'activity-log' | 'presets';
type RecycleType = 'policies' | 'slips' | 'clauses';
type DbViewType = 'policies' | 'slips' | 'clauses';

const AdminConsole: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useTheme();
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [isSidebarOpen] = useState(true);

  // Confirm dialog states
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<{ show: boolean; id: string }>({ show: false, id: '' });
  const [deleteTemplateConfirm, setDeleteTemplateConfirm] = useState<{ show: boolean; id: string }>({ show: false, id: '' });
  const [deleteDeptConfirm, setDeleteDeptConfirm] = useState<{ show: boolean; id: string; name: string }>({ show: false, id: '', name: '' });
  
  // Roles Management State
  const [roles, setRoles] = useState<Role[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | undefined>(undefined);

  // Departments Management State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | undefined>(undefined);

  // Recycle Bin State
  const [recycleType, setRecycleType] = useState<RecycleType>('policies');
  const [deletedPolicies, setDeletedPolicies] = useState<Policy[]>([]);
  const [deletedSlips, setDeletedSlips] = useState<ReinsuranceSlip[]>([]);
  const [deletedClauses, setDeletedClauses] = useState<Clause[]>([]);

  // Database Browser State
  const [dbViewType, setDbViewType] = useState<DbViewType>('policies');
  const [rawPolicies, setRawPolicies] = useState<Policy[]>([]);
  const [rawSlips, setRawSlips] = useState<ReinsuranceSlip[]>([]);
  const [rawClauses, setRawClauses] = useState<Clause[]>([]);

  // Templates State
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<PolicyTemplate>({
      id: '',
      name: '',
      description: '',
      content: ''
  });


  // CBU Live Rates State
  const [cbuRates, setCbuRates] = useState<Array<{
    currency: Currency;
    code: string;
    name: string;
    rate: number;
    nominal: number;
    rawRate: number;
    diff: number;
    date: string;
  }>>([]);
  const [cbuLoading, setCbuLoading] = useState(false);
  const [cbuLastUpdated, setCbuLastUpdated] = useState<Date | null>(null);
  const [cbuError, setCbuError] = useState<string | null>(null);
  const [cbuSelectedDate, setCbuSelectedDate] = useState<Date | null>(new Date());
  const [showDatePopup, setShowDatePopup] = useState(false);
  const [popupDate, setPopupDate] = useState<Date | null>(new Date());
  const [cbuUsingCachedRates, setCbuUsingCachedRates] = useState(false); // True when showing fallback rates

  // User Management State
  const { data: profiles, isLoading: loadingProfiles, refetch: refetchProfiles } = useProfiles();
  const updateProfileMutation = useUpdateProfile();
  const [showUserModal, setShowUserModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<Profile>>({
      fullName: '',
      email: '',
      role: 'Underwriter',
      roleId: '',
      department: '',
      departmentId: '',
      phone: '',
      isActive: true
  });
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showInactiveUsers, setShowInactiveUsers] = useState(true);
  const [deactivateConfirm, setDeactivateConfirm] = useState<{ show: boolean; user: Profile | null }>({ show: false, user: null });

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Dashboard Analytics State
  const [claims, setClaims] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Activity Log State
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityCategory, setActivityCategory] = useState<string>('');
  const [activityDateFrom, setActivityDateFrom] = useState<string>('');
  const [activityDateTo, setActivityDateTo] = useState<string>('');
  const [activityPage, setActivityPage] = useState(0);
  const [activityTotal, setActivityTotal] = useState(0);
  const ACTIVITY_PAGE_SIZE = 50;

  // Inward Reinsurance Presets State
  const [presets, setPresets] = useState<InwardReinsurancePreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetCategory, setPresetCategory] = useState<'TYPE_OF_COVER' | 'CLASS_OF_COVER' | 'INDUSTRY'>('TYPE_OF_COVER');
  const [newPresetValue, setNewPresetValue] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [editingPreset, setEditingPreset] = useState<InwardReinsurancePreset | null>(null);
  const [deletePresetConfirm, setDeletePresetConfirm] = useState<{ show: boolean; id: string; value: string }>({ show: false, id: '', value: '' });

  // Session Timeout Settings State
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(30);
  const [sessionTimeoutSaving, setSessionTimeoutSaving] = useState(false);

  // Operating Expenses State
  const [annualOperatingExpenses, setAnnualOperatingExpenses] = useState<string>('');
  const [operatingExpensesSaving, setOperatingExpensesSaving] = useState(false);

  // Stats for Dashboard
  const stats = {
    totalPolicies: rawPolicies.length,
    totalSlips: rawSlips.length,
    totalClauses: rawClauses.length,
    deletedItems: deletedPolicies.length + deletedSlips.length + deletedClauses.length,
    totalUsers: profiles?.length || 0,
    activeClaims: claims.filter(c => c.status === 'OPEN' || c.status === 'REOPENED').length,
    pendingTasks: tasks.filter(t => t.status === 'PENDING').length
  };

  // Calculate financial metrics
  const totalPremium = rawPolicies.reduce((sum, p) => sum + (Number(p.grossPremium) || 0), 0);
  const totalClaimsPaid = claims.reduce((sum, c) => sum + (Number(c.total_paid) || 0), 0);
  const lossRatio = totalPremium > 0 ? (totalClaimsPaid / totalPremium) * 100 : 0;

  // Policy status breakdown
  const activePolicies = rawPolicies.filter(p => p.status === 'Active').length;
  const pendingPolicies = rawPolicies.filter(p => p.status === 'Pending Confirmation').length;
  const expiredPolicies = rawPolicies.filter(p => p.status === 'Expired' || p.status === 'Terminated').length;

  const loadAllData = async () => {
    setLoading(true);
    const [p, s, c, t, r, d] = await Promise.all([
        DB.getAllPolicies(),
        DB.getAllSlips(),
        DB.getAllClauses(),
        DB.getTemplates(),
        PermissionService.getRoles(),
        UserService.getDepartments()
    ]);
    setRawPolicies(p);
    setRawSlips(s);
    setRawClauses(c);
    setTemplates(t);
    setRoles(r);
    setDepartments(d);

    const [dp, ds, dc] = await Promise.all([DB.getDeletedPolicies(), DB.getDeletedSlips(), DB.getDeletedClauses()]);
    setDeletedPolicies(dp);
    setDeletedSlips(ds);
    setDeletedClauses(dc);

    // Load claims and tasks for dashboard
    try {
      const { data: claimsData } = await supabase.from('claims').select('*');
      setClaims(claimsData || []);
      
      const { data: tasksData } = await supabase.from('agenda_tasks').select('*').order('due_date', { ascending: true });
      setTasks(tasksData || []);

      // Load recent activity
      const { data: activityData } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentActivity(activityData || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }

    setLoading(false);
  };

  // Fetch Activity Logs
  const fetchActivityLogs = async () => {
    setActivityLogLoading(true);
    try {
      const { data, error } = await supabase.rpc('search_audit_log', {
        p_search: activitySearch || null,
        p_action_category: activityCategory || null,
        p_date_from: activityDateFrom ? new Date(activityDateFrom).toISOString() : null,
        p_date_to: activityDateTo ? new Date(activityDateTo + 'T23:59:59').toISOString() : null,
        p_limit: ACTIVITY_PAGE_SIZE,
        p_offset: activityPage * ACTIVITY_PAGE_SIZE
      });
      
      if (error) throw error;
      
      setActivityLogs(data || []);
      if (data && data.length > 0) {
        setActivityTotal(Number(data[0].total_count) || 0);
      } else {
        setActivityTotal(0);
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      // Fallback to direct query if RPC doesn't exist
      try {
        const { data, count } = await supabase
          .from('audit_log')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(activityPage * ACTIVITY_PAGE_SIZE, (activityPage + 1) * ACTIVITY_PAGE_SIZE - 1);
        setActivityLogs(data || []);
        setActivityTotal(count || 0);
      } catch (fallbackErr) {
        console.error('Fallback query also failed:', fallbackErr);
      }
    } finally {
      setActivityLogLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [activeSection, dbViewType, recycleType]);

  useEffect(() => {
    if (activeSection === 'activity-log') {
      fetchActivityLogs();
    }
  }, [activeSection, activitySearch, activityCategory, activityDateFrom, activityDateTo, activityPage]);

  // Load session timeout and operating expenses settings when settings section is active
  useEffect(() => {
    if (activeSection === 'settings') {
      DB.getSetting('session_timeout_minutes').then(val => {
        if (val) setSessionTimeoutMinutes(Number(val));
      });
      DB.getSetting('annual_operating_expenses').then(val => {
        if (val) setAnnualOperatingExpenses(val);
      });
    }
  }, [activeSection]);

  // Load CBU rates when FX section is active or date changes
  useEffect(() => {
    if (activeSection === 'fx') {
      loadCBURates();
    }
  }, [activeSection, cbuSelectedDate]);

  // Helper to map DB rates to display format
  const mapDbRatesToDisplay = (dbRates: ExchangeRate[]) => dbRates.map(r => ({
    currency: r.currency,
    code: r.currency,
    name: r.ccyNameEn || r.currency, // Use stored name or fallback to code
    rate: r.rate,
    nominal: r.nominal || 1,
    rawRate: r.rawRate || r.rate,
    diff: parseFloat(r.diff || '0'),
    date: r.date,
  }));

  // Load exchange rates - checks DB first, fetches from CBU if not found
  const loadCBURates = async () => {
    setCbuLoading(true);
    setCbuError(null);
    setCbuUsingCachedRates(false);
    try {
      const dateToFetch = toISODateString(cbuSelectedDate) || new Date().toISOString().split('T')[0];

      // First check if rates exist in DB for this date
      const dbRates = await DB.getExchangeRatesByDate(dateToFetch);

      if (dbRates.length > 0) {
        // Rates found in DB - use stored CBU metadata
        setCbuRates(mapDbRatesToDisplay(dbRates));
        setCbuLastUpdated(new Date());
      } else {
        // Rates not in DB - try to fetch from CBU, save to DB, then display from DB
        try {
          await CBUService.syncRates(dateToFetch);
          // Read back from DB to display (now with all fields)
          const savedRates = await DB.getExchangeRatesByDate(dateToFetch);
          setCbuRates(mapDbRatesToDisplay(savedRates));
          setCbuLastUpdated(new Date());
          await loadAllData(); // Refresh local rates in state
        } catch (fetchError: any) {
          console.warn('CBU API fetch failed, trying cached rates:', fetchError.message);
          // API failed - try to show most recent cached rates as fallback
          const { rates: cachedRates, date: cachedDate } = await DB.getMostRecentExchangeRates();
          if (cachedRates.length > 0) {
            setCbuRates(mapDbRatesToDisplay(cachedRates));
            setCbuSelectedDate(cachedDate ? parseDate(cachedDate) : null);
            setCbuUsingCachedRates(true);
            setCbuError(`CBU API unavailable. Showing cached rates from ${cachedDate || 'database'}`);
          } else {
            throw fetchError; // No cached rates - show original error
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to load exchange rates:', error);
      setCbuError(error.message || 'Failed to fetch rates');
    } finally {
      setCbuLoading(false);
    }
  };

  // Refresh rates - checks DB first, only fetches from CBU if date not in DB
  const refreshCBURates = async (date: Date | null) => {
    setCbuLoading(true);
    setCbuError(null);
    setCbuUsingCachedRates(false);
    try {
      const dateToFetch = toISODateString(date) || new Date().toISOString().split('T')[0];

      // Check if rates exist in DB for this date
      const dbRates = await DB.getExchangeRatesByDate(dateToFetch);

      if (dbRates.length > 0) {
        // Rates exist in DB for this date - use stored CBU metadata
        setCbuRates(mapDbRatesToDisplay(dbRates));
        setCbuSelectedDate(date);
        setPopupDate(date);
      } else {
        // Rates don't exist for this date - try to fetch from CBU and save to DB
        try {
          await CBUService.syncRates(dateToFetch);
          // Read back from DB to display (now with all fields)
          const savedRates = await DB.getExchangeRatesByDate(dateToFetch);
          setCbuRates(mapDbRatesToDisplay(savedRates));
          setCbuSelectedDate(date);
          setPopupDate(date);
          await loadAllData(); // Refresh local rates in state
        } catch (fetchError: any) {
          console.warn('CBU API fetch failed for date:', dateToFetch, fetchError.message);
          // API failed - try to show most recent cached rates as fallback
          const { rates: cachedRates, date: cachedDate } = await DB.getMostRecentExchangeRates();
          if (cachedRates.length > 0) {
            setCbuRates(mapDbRatesToDisplay(cachedRates));
            setCbuSelectedDate(cachedDate ? parseDate(cachedDate) : null);
            setPopupDate(cachedDate ? parseDate(cachedDate) : null);
            setCbuUsingCachedRates(true);
            setCbuError(`CBU API unavailable. Showing cached rates from ${cachedDate || 'database'}`);
          } else {
            throw fetchError; // No cached rates - show original error
          }
        }
      }

      setCbuLastUpdated(new Date());
      setShowDatePopup(false);
    } catch (error: any) {
      console.error('Failed to load exchange rates:', error);
      setCbuError(error.message || 'Failed to load rates');
    } finally {
      setCbuLoading(false);
    }
  };

  // Load presets when section is active
  useEffect(() => {
    if (activeSection === 'presets') {
      fetchPresets();
    }
  }, [activeSection, presetCategory]);

  // Fetch Presets
  const fetchPresets = async () => {
    setPresetsLoading(true);
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('inward_reinsurance_presets')
          .select('*')
          .eq('category', presetCategory)
          .order('sort_order', { ascending: true });

        if (error) throw error;

        const mapped: InwardReinsurancePreset[] = (data || []).map((row: any) => ({
          id: row.id,
          category: row.category,
          value: row.value,
          description: row.description,
          isActive: row.is_active,
          sortOrder: row.sort_order,
          createdAt: row.created_at
        }));
        setPresets(mapped);
      }
    } catch (err) {
      console.error('Failed to load presets:', err);
      toast.error('Failed to load presets');
    } finally {
      setPresetsLoading(false);
    }
  };

  // Add preset
  const handleAddPreset = async () => {
    if (!newPresetValue.trim()) {
      toast.error('Value is required');
      return;
    }

    try {
      const maxOrder = presets.reduce((max, p) => Math.max(max, p.sortOrder || 0), 0);

      if (supabase) {
        const { error } = await supabase.from('inward_reinsurance_presets').insert([{
          id: crypto.randomUUID(),
          category: presetCategory,
          value: newPresetValue.trim(),
          description: newPresetDescription.trim() || null,
          is_active: true,
          sort_order: maxOrder + 1,
          created_at: new Date().toISOString()
        }]);

        if (error) throw error;
      }

      toast.success('Preset added successfully');
      setNewPresetValue('');
      setNewPresetDescription('');
      fetchPresets();
    } catch (err: any) {
      console.error('Failed to add preset:', err);
      toast.error('Failed to add preset: ' + (err.message || 'Unknown error'));
    }
  };

  // Update preset
  const handleUpdatePreset = async () => {
    if (!editingPreset) return;

    try {
      if (supabase) {
        const { error } = await supabase
          .from('inward_reinsurance_presets')
          .update({
            value: editingPreset.value,
            description: editingPreset.description,
            is_active: editingPreset.isActive
          })
          .eq('id', editingPreset.id);

        if (error) throw error;
      }

      toast.success('Preset updated successfully');
      setEditingPreset(null);
      fetchPresets();
    } catch (err: any) {
      toast.error('Failed to update preset: ' + (err.message || 'Unknown error'));
    }
  };

  // Delete preset
  const handleDeletePreset = (id: string, value: string) => {
    setDeletePresetConfirm({ show: true, id, value });
  };

  const confirmDeletePreset = async () => {
    const { id } = deletePresetConfirm;
    setDeletePresetConfirm({ show: false, id: '', value: '' });

    try {
      if (supabase) {
        const { error } = await supabase
          .from('inward_reinsurance_presets')
          .delete()
          .eq('id', id);

        if (error) throw error;
      }

      toast.success('Preset deleted successfully');
      fetchPresets();
    } catch (err: any) {
      toast.error('Failed to delete preset: ' + (err.message || 'Unknown error'));
    }
  };

  // Helper functions
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (recycleType === 'policies') await DB.restorePolicy(id);
    if (recycleType === 'slips') await DB.restoreSlip(id);
    if (recycleType === 'clauses') await DB.restoreClause(id);
    loadAllData();
  };

  const handleHardDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHardDeleteConfirm({ show: true, id });
  };

  const confirmHardDelete = async () => {
    const { id } = hardDeleteConfirm;
    setHardDeleteConfirm({ show: false, id: '' });
    if (recycleType === 'policies') await DB.hardDeletePolicy(id);
    if (recycleType === 'slips') await DB.hardDeleteSlip(id);
    if (recycleType === 'clauses') await DB.hardDeleteClause(id);
    loadAllData();
  };

  const handleEditTemplate = (tpl?: PolicyTemplate) => {
      if (tpl) {
          setCurrentTemplate(tpl);
      } else {
          setCurrentTemplate({ id: crypto.randomUUID(), name: '', description: '', content: '' });
      }
      setIsEditingTemplate(true);
  };

  const handleSaveTemplate = async () => {
      if (!currentTemplate.name || !currentTemplate.content) {
          toast.error("Name and Content are required");
          return;
      }
      await DB.saveTemplate(currentTemplate);
      setIsEditingTemplate(false);
      loadAllData();
  };

  const handleDeleteTemplate = (id: string) => {
      setDeleteTemplateConfirm({ show: true, id });
  };

  const confirmDeleteTemplate = async () => {
      const { id } = deleteTemplateConfirm;
      setDeleteTemplateConfirm({ show: false, id: '' });
      await DB.deleteTemplate(id);
      loadAllData();
  };

  const handleEditDepartment = (d?: Department) => {
      setSelectedDept(d);
      setShowDeptModal(true);
  };

  const handleDeleteDepartment = (id: string, name: string) => {
      setDeleteDeptConfirm({ show: true, id, name });
  };

  const confirmDeleteDepartment = async () => {
      const { id } = deleteDeptConfirm;
      setDeleteDeptConfirm({ show: false, id: '', name: '' });
      try {
          await UserService.deleteDepartment(id);
          loadAllData();
      } catch(e: any) {
          toast.error("Error: " + e.message);
      }
  };

  const handleEditUser = (u?: Profile) => {
      setNewUserPassword('');
      if (u) {
          setCurrentUser({ ...u, roleId: u.roleId || '', departmentId: u.departmentId || '' });
      } else {
          setCurrentUser({ fullName: '', email: '', role: 'Underwriter', roleId: '', department: '', departmentId: '', phone: '', isActive: true, avatarUrl: 'NU' });
      }
      setShowUserModal(true);
  };

  const handleSaveUser = async () => {
      if (!currentUser.fullName || !currentUser.email) {
          toast.error("Name and Email are required");
          return;
      }
      setActionLoading(true);
      try {
        const selectedRoleObj = roles.find(r => r.id === currentUser.roleId);
        const selectedDeptObj = departments.find(d => d.id === currentUser.departmentId);
        const roleName = selectedRoleObj?.name || 'Underwriter';

        if (!currentUser.id) {
            // Creating a new user
            if (!newUserPassword) { toast.error("Password required"); setActionLoading(false); return; }

            // Check if a deactivated profile exists for this email
            const deactivatedProfile = await UserService.findDeactivatedProfileByEmail(currentUser.email);

            // Create new auth account (email is free since deactivate deletes auth entry)
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: currentUser.email,
                password: newUserPassword,
                options: { data: { full_name: currentUser.fullName } }
            });
            if (authError) throw authError;
            if (!authData.user) throw new Error("User creation failed");

            if (deactivatedProfile) {
                // Reactivate the old profile — preserves history chain
                await UserService.reactivateProfile(deactivatedProfile.id, authData.user.id, {
                    fullName: currentUser.fullName,
                    email: currentUser.email,
                    role: roleName,
                    roleId: currentUser.roleId || null,
                    department: selectedDeptObj?.name || null,
                    departmentId: currentUser.departmentId || null,
                    phone: currentUser.phone || null,
                    avatarUrl: currentUser.avatarUrl || currentUser.fullName.substring(0, 2).toUpperCase(),
                });
                toast.success("User reactivated with preserved history!");
            } else {
                // Brand new user — create fresh profile
                await supabase.from('profiles').upsert({
                    id: authData.user.id,
                    email: currentUser.email,
                    full_name: currentUser.fullName,
                    role: roleName,
                    role_id: currentUser.roleId || null,
                    department: selectedDeptObj?.name || null,
                    department_id: currentUser.departmentId || null,
                    phone: currentUser.phone || null,
                    is_active: true,
                    avatar_url: currentUser.avatarUrl || currentUser.fullName.substring(0, 2).toUpperCase(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                toast.success("User created!");
            }
        } else {
            await supabase.from('profiles').update({
                full_name: currentUser.fullName,
                role: selectedRoleObj?.name || currentUser.role,
                role_id: currentUser.roleId || null,
                department: selectedDeptObj?.name || null,
                department_id: currentUser.departmentId || null,
                phone: currentUser.phone || null,
                is_active: currentUser.isActive,
                updated_at: new Date().toISOString()
            }).eq('id', currentUser.id);
            toast.success("User updated!");
        }
        setShowUserModal(false);
        refetchProfiles();
      } catch (err: any) {
          toast.error("Error: " + (err.message || JSON.stringify(err)));
      } finally {
          setActionLoading(false);
      }
  };

  const isSuperAdmin = user?.role === 'Super Admin';

  const handleDeactivateUser = async (targetUser: Profile) => {
      setActionLoading(true);
      try {
          await UserService.deactivateUser(targetUser.id);
          toast.success(`User ${targetUser.email} has been deactivated`);
          refetchProfiles();
      } catch (err: any) {
          toast.error("Error: " + (err.message || "Failed to deactivate user"));
      } finally {
          setActionLoading(false);
          setDeactivateConfirm({ show: false, user: null });
      }
  };

  const handleResetPassword = async (targetUser: Profile) => {
      setActionLoading(true);
      try {
          await UserService.resetPassword(targetUser.email);
          toast.success(`Password reset link sent to ${targetUser.email}`);
      } catch (err: any) {
          toast.error("Error: " + (err.message || "Failed to send reset link"));
      } finally {
          setActionLoading(false);
      }
  };

  const handleEditRole = (role?: Role) => { setSelectedRole(role); setShowRoleModal(true); };
  const handleRoleSaved = () => { setShowRoleModal(false); loadAllData(); };

  // ==================== RENDER FUNCTIONS ====================

  const renderDashboardHome = () => (
    <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>System Overview</h2>
            <button onClick={loadAllData} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 13, fontWeight: 500, background: t.bgCard }} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = t.bgCard)}><RefreshCw size={16}/> Refresh</button>
        </div>

        {/* Top Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
            {[
              { label: 'Policies', value: stats.totalPolicies, icon: FileText, bg: `${t.accent}20`, fg: t.accent },
              { label: 'Slips', value: stats.totalSlips, icon: ScrollText, bg: t.warningBg, fg: t.warning },
              { label: 'Open Claims', value: stats.activeClaims, icon: AlertCircle, bg: t.dangerBg, fg: t.danger },
              { label: 'Pending Tasks', value: stats.pendingTasks, icon: Clock, bg: t.warningBg, fg: t.warning },
              { label: 'Users', value: stats.totalUsers, icon: Users, bg: '#f3e8ff', fg: '#a855f7' },
              { label: 'Deleted', value: stats.deletedItems, icon: Trash2, bg: t.bgCard, fg: t.text3, textRed: true },
            ].map((stat, i) => (
              <div key={i} style={{ padding: 20, borderRadius: 12, border: '1px solid ' + t.border, background: t.bgPanel, borderColor: t.border, boxShadow: t.shadow }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: stat.bg }}>
                    <stat.icon size={20} style={{ color: stat.fg }} />
                  </div>
                  <div>
                    <div style={{ color: t.text3, fontSize: 12, fontWeight: 500 }}>{stat.label}</div>
                    <div style={{ color: stat.textRed ? t.danger : t.text1, fontSize: 24, fontWeight: 700 }}>{stat.value}</div>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Financial Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            <div style={{ borderRadius: 12, padding: 24, background: t.success, color: '#fff', boxShadow: t.shadowLg }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ fontSize: 13, opacity: 0.8 }}>Total Premium</p>
                        <p style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>${totalPremium.toLocaleString()}</p>
                        <p style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>{rawPolicies.length} policies</p>
                    </div>
                    <div style={{ width: 56, height: 56, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.2)' }}><DollarSign size={28}/></div>
                </div>
            </div>
            <div style={{ borderRadius: 12, padding: 24, background: t.danger, color: '#fff', boxShadow: t.shadowLg }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ fontSize: 13, opacity: 0.8 }}>Claims Paid</p>
                        <p style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>${totalClaimsPaid.toLocaleString()}</p>
                        <p style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>{claims.length} claims</p>
                    </div>
                    <div style={{ width: 56, height: 56, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.2)' }}><TrendingDown size={28}/></div>
                </div>
            </div>
            <div style={{ borderRadius: 12, padding: 24, background: lossRatio > 70 ? t.warning : t.accent, color: '#fff', boxShadow: t.shadowLg }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ fontSize: 13, opacity: 0.8 }}>Loss Ratio</p>
                        <p style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{lossRatio.toFixed(1)}%</p>
                        <p style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>{lossRatio > 70 ? 'Above target' : 'Within target'}</p>
                    </div>
                    <div style={{ width: 56, height: 56, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.2)' }}><PieChart size={28}/></div>
                </div>
            </div>
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            <div style={{ borderRadius: 12, border: '1px solid ' + t.border, padding: 24, background: t.bgPanel, boxShadow: t.shadow }}>
                <h3 style={{ marginBottom: 16, color: t.text1, fontSize: 15, fontWeight: 600 }}>Policy Status</h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
                    <div style={{ position: 'relative', width: 160, height: 160 }}>
                        <svg viewBox="0 0 36 36" style={{ width: 160, height: 160, transform: 'rotate(-90deg)' }}>
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3"/>
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#22c55e" strokeWidth="3" strokeDasharray={`${(activePolicies/Math.max(stats.totalPolicies,1))*100} 100`}/>
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#eab308" strokeWidth="3" strokeDasharray={`${(pendingPolicies/Math.max(stats.totalPolicies,1))*100} 100`} strokeDashoffset={`-${(activePolicies/Math.max(stats.totalPolicies,1))*100}`}/>
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray={`${(expiredPolicies/Math.max(stats.totalPolicies,1))*100} 100`} strokeDashoffset={`-${((activePolicies+pendingPolicies)/Math.max(stats.totalPolicies,1))*100}`}/>
                        </svg>
                        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 24, fontWeight: 700 }}>{stats.totalPolicies}</span></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 16, height: 16, borderRadius: 9999, background: t.success }}></div><span style={{ fontSize: 13 }}>Active ({activePolicies})</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 16, height: 16, borderRadius: 9999, background: t.warning }}></div><span style={{ fontSize: 13 }}>Pending ({pendingPolicies})</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 16, height: 16, borderRadius: 9999, background: t.danger }}></div><span style={{ fontSize: 13 }}>Expired ({expiredPolicies})</span></div>
                    </div>
                </div>
            </div>
            <div style={{ borderRadius: 12, border: '1px solid ' + t.border, padding: 24, background: t.bgPanel, boxShadow: t.shadow }}>
                <h3 style={{ marginBottom: 16, color: t.text1, fontSize: 15, fontWeight: 600 }}>Slip Status</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {['DRAFT','PENDING','QUOTED','BOUND','CLOSED','DECLINED'].map(status => {
                        const count = rawSlips.filter(s => s.status === status).length;
                        const pct = stats.totalSlips > 0 ? (count/stats.totalSlips)*100 : 0;
                        const colors: Record<string,string> = { DRAFT: t.text5, PENDING: t.accent, QUOTED: '#a855f7', BOUND: t.success, CLOSED: t.text2, DECLINED: t.danger };
                        return (
                            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 80, fontSize: 12, fontWeight: 500, color: t.text2 }}>{status}</div>
                                <div style={{ flex: 1, height: 24, borderRadius: 9999, overflow: 'hidden', background: t.bgCard }}>
                                    <div style={{ height: '100%', width:`${pct}%`, background: colors[status]}}></div>
                                </div>
                                <div style={{ width: 48, textAlign: 'right', fontSize: 13, fontWeight: 500 }}>{count}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Recent Activity & Tasks */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            <div style={{ borderRadius: 12, border: '1px solid ' + t.border, padding: 24, background: t.bgPanel, boxShadow: t.shadow }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>Recent Activity</h3>
                    <button onClick={() => setActiveSection('activity-log')} style={{ fontSize: 13, color: t.accent }}>View All →</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {recentActivity.length === 0 ? (
                        <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: t.text4 }}><Activity size={32} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 8, opacity: 0.5 }}/><p style={{ fontSize: 13 }}>No recent activity</p></div>
                    ) : recentActivity.slice(0,5).map((a,i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 8 }} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                            <div style={{ width: 32, height: 32, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${t.accent}20`, color: t.accent }}>
                                {a.action==='INSERT'?<Plus size={14}/>:a.action==='UPDATE'?<Edit size={14}/>:a.action==='DELETE'?<Trash2 size={14}/>:<RefreshCw size={14}/>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text1 }}>{a.action_description}</p>
                                <p style={{ fontSize: 12, color: t.text3 }}>{a.user_name||'System'} • {formatTimeAgo(a.created_at)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ borderRadius: 12, border: '1px solid ' + t.border, padding: 24, background: t.bgPanel, boxShadow: t.shadow }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>Pending Tasks</h3>
                    <span style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 12, fontWeight: 500, background: t.warningBg, color: t.warning }}>{tasks.filter(t=>t.status==='PENDING').length} pending</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {tasks.filter(t=>t.status==='PENDING').length===0 ? (
                        <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: t.text4 }}><CheckCircle size={32} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 8, opacity: 0.5 }}/><p style={{ fontSize: 13 }}>All tasks done!</p></div>
                    ) : tasks.filter(t=>t.status==='PENDING').slice(0,5).map((t,i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8 }} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 9999, background: t.warningBg }}></div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text1 }}>{t.title}</p>
                                    <p style={{ fontSize: 12, color: t.text3 }}>{t.assigned_to_name||'Unassigned'}</p>
                                </div>
                            </div>
                            <span style={{ fontSize: 12, marginLeft: 8, color: t.text3 }}>{t.due_date?formatDate(t.due_date):'No due date'}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );

  const renderActivityLog = () => (
    <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><h2 style={{ color: t.text1, fontSize: 15, fontWeight: 600 }}>Activity Log</h2><p style={{ color: t.text3, fontSize: 13 }}>Track all system activities</p></div>
            <button onClick={fetchActivityLogs} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 13, fontWeight: 500, background: t.bgCard }} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = t.bgCard)}><RefreshCw size={16}/>Refresh</button>
        </div>
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid ' + t.border, background: t.bgPanel, boxShadow: t.shadow }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'flex-end' }}>
                <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: t.text2 }}>Search</label>
                    <input type="text" placeholder="Search..." value={activitySearch} onChange={e=>{setActivitySearch(e.target.value);setActivityPage(0);}} style={{ width: '100%', padding: 10, border: '1px solid ' + t.borderL, borderRadius: 8, fontSize: 13, outline: 'none' }}/>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: t.text2 }}>Category</label>
                    <select value={activityCategory} onChange={e=>{setActivityCategory(e.target.value);setActivityPage(0);}} style={{ width: '100%', padding: 10, border: '1px solid ' + t.borderL, borderRadius: 8, fontSize: 13, outline: 'none', background: t.bgPanel }}>
                        <option value="">All Categories</option>
                        <option value="POLICY">Policies</option>
                        <option value="SLIP">Slips</option>
                        <option value="CLAIM">Claims</option>
                        <option value="INSURER">Insurers</option>
                        <option value="TASK">Tasks</option>
                        <option value="USER">Users</option>
                    </select>
                </div>
                <DatePickerInput label="From" value={parseDate(activityDateFrom)} onChange={(date) => {setActivityDateFrom(toISODateString(date) || '');setActivityPage(0);}}/>
                <DatePickerInput label="To" value={parseDate(activityDateTo)} onChange={(date) => {setActivityDateTo(toISODateString(date) || '');setActivityPage(0);}}/>
            </div>
            {(activitySearch||activityCategory||activityDateFrom||activityDateTo) && <button onClick={()=>{setActivitySearch('');setActivityCategory('');setActivityDateFrom('');setActivityDateTo('');setActivityPage(0);}} style={{ marginTop: 12, fontSize: 13, color: t.accent }}>Clear filters</button>}
        </div>
        <div style={{ fontSize: 13, color: t.text3 }}>Showing {activityLogs.length} of {activityTotal} logs</div>
        <div style={{ borderRadius: 12, border: '1px solid ' + t.border, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadow }}>
            {activityLogLoading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingBottom: 48 }}><Loader2 className="animate-spin" style={{ color: t.accent }} size={32}/></div> : activityLogs.length===0 ? <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48, color: t.text3 }}><ScrollText size={48} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 16, color: t.text5 }}/><p>No logs found</p></div> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%' }}>
                        <thead style={{ borderBottom: '1px solid ' + t.border, background: t.bgCard }}><tr>
                            <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text2 }}>Time</th>
                            <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text2 }}>User</th>
                            <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text2 }}>Action</th>
                            <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text2 }}>Category</th>
                            <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text2 }}>Description</th>
                            <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text2 }}>Reference</th>
                        </tr></thead>
                        <tbody className="divide-y" style={{ borderColor: t.borderL }}>
                            {activityLogs.map(log => (
                                <tr key={log.id} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontSize: 13, whiteSpace: 'nowrap', color: t.text3 }}>{formatDateTime(log.created_at)}</td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}><div style={{ fontSize: 13, fontWeight: 500, color: t.text1 }}>{log.user_name||'System'}</div><div style={{ fontSize: 12, color: t.text3 }}>{log.user_email}</div></td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}><span style={{ display: 'inline-flex', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 12, fontWeight: 500, background: `${t.accent}20`, color: t.accent }}>{log.action}</span></td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}><span style={{ display: 'inline-flex', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4, fontSize: 12, fontWeight: 500, background: t.warningBg, color: t.warning }}>{log.action_category}</span></td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontSize: 13, maxWidth: 448, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text2 }} title={log.action_description}>{log.action_description}</td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontSize: 13, fontFamily: 'monospace', color: t.text2 }}>{log.entity_reference}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        {activityTotal > ACTIVITY_PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={()=>setActivityPage(p=>Math.max(0,p-1))} disabled={activityPage===0} className="disabled:opacity-50" style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid ' + t.border, borderRadius: 8, fontSize: 13 }}>Previous</button>
                <span style={{ fontSize: 13, color: t.text2 }}>Page {activityPage+1} of {Math.ceil(activityTotal/ACTIVITY_PAGE_SIZE)}</span>
                <button onClick={()=>setActivityPage(p=>p+1)} disabled={(activityPage+1)*ACTIVITY_PAGE_SIZE>=activityTotal} className="disabled:opacity-50" style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid ' + t.border, borderRadius: 8, fontSize: 13 }}>Next</button>
            </div>
        )}
    </div>
  );

  const renderDepartments = () => (
    <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>Departments</h2><p style={{ fontSize: 13, color: t.text3 }}>Manage organization structure.</p></div>
            <button onClick={()=>handleEditDepartment()} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontWeight: 500, background: t.accent, color: '#fff' }}><Plus size={18}/> Add Department</button>
        </div>
        <div style={{ borderRadius: 12, border: '1px solid ' + t.border, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadow }}>
            <table style={{ width: '100%', textAlign: 'left' }}>
                <thead style={{ background: t.bgCard, color: t.text2 }}><tr><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, width: 48 }}>Code</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Name</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Head</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>Staff</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>Status</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody className="divide-y">
                    {departments.map(dept => (
                        <tr key={dept.id} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, fontFamily: 'monospace', fontWeight: 700, color: t.text3 }}>{dept.code}</td>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}><div style={{ fontWeight: 700, color: t.text1 }}>{dept.name}</div><div style={{ fontSize: 12, color: t.text3 }}>{dept.description}</div></td>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, fontSize: 13, color: t.text2 }}>{(dept as any).headName || '-'}</td>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center', fontSize: 13 }}>{dept.currentStaffCount||0} / {dept.maxStaff||'∞'}</td>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>{dept.isActive ? <span style={{ fontSize: 12, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, background: t.successBg, color: t.success }}>Active</span> : <span style={{ fontSize: 12, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, background: t.bgCard, color: t.text3 }}>Inactive</span>}</td>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'right' }}><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button onClick={()=>handleEditDepartment(dept)} style={{ padding: 8, borderRadius: 4, color: t.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = t.accentMuted)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><Edit size={16}/></button><button onClick={()=>handleDeleteDepartment(dept.id,dept.name)} style={{ padding: 8, borderRadius: 4, color: t.danger }} onMouseEnter={(e) => (e.currentTarget.style.background = t.dangerBg)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><Trash2 size={16}/></button></div></td>
                        </tr>
                    ))}
                    {departments.length===0 && <tr><td colSpan={6} style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: t.text4 }}>No departments found.</td></tr>}
                </tbody>
            </table>
        </div>
        {showDeptModal && <DepartmentEditModal department={selectedDept} onClose={()=>setShowDeptModal(false)} onSave={loadAllData} allUsers={profiles||[]}/>}
    </div>
  );

  const renderRoles = () => (
    <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>RBAC Roles</h2><p style={{ fontSize: 13, color: t.text3 }}>Manage roles and permissions.</p></div>
            <button onClick={()=>handleEditRole()} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontWeight: 500, background: t.accent, color: '#fff' }}><Plus size={18}/> Add Role</button>
        </div>
        <div style={{ borderRadius: 12, border: '1px solid ' + t.border, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadow }}>
            <table style={{ width: '100%', textAlign: 'left' }}>
                <thead style={{ background: t.bgCard, color: t.text2 }}><tr><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, width: 48 }}>Lvl</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Role</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Department</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>System</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>Status</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody className="divide-y">
                    {roles.map(role => (
                        <tr key={role.id} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, fontFamily: 'monospace', fontWeight: 700, color: t.text3 }}>{role.level}</td>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}><div style={{ fontWeight: 700, color: t.text1 }}>{role.name}</div><div style={{ fontSize: 12, color: t.text3 }}>{role.description}</div></td>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, fontSize: 13, color: t.text2 }}>{role.department||'-'}</td>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>{role.isSystemRole && <Lock size={14} style={{ display: 'inline', color: t.warning }}/>}</td>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>{role.isActive ? <span style={{ fontSize: 12, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, background: t.successBg, color: t.success }}>Active</span> : <span style={{ fontSize: 12, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, background: t.bgCard, color: t.text3 }}>Inactive</span>}</td>
                            <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'right' }}><button onClick={()=>handleEditRole(role)} style={{ padding: 8, borderRadius: 4, color: t.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = t.accentMuted)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><Edit size={16}/></button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {showRoleModal && <RoleEditModal role={selectedRole} onClose={()=>setShowRoleModal(false)} onSave={handleRoleSaved}/>}
    </div>
  );

  const renderUsers = () => {
    // Sort: active users first, inactive at bottom
    const sortedProfiles = [...(profiles || [])].sort((a, b) => {
        if (a.isActive === b.isActive) return a.fullName.localeCompare(b.fullName);
        return a.isActive ? -1 : 1;
    });
    const filteredProfiles = showInactiveUsers ? sortedProfiles : sortedProfiles.filter(u => u.isActive);
    const activeCount = (profiles || []).filter(u => u.isActive).length;
    const inactiveCount = (profiles || []).filter(u => !u.isActive).length;

    return (
    <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>User Management</h2>
            <button onClick={()=>handleEditUser()} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontWeight: 500, background: t.accent, color: '#fff' }}><Plus size={18}/> Add User</button>
        </div>
        <div style={{ borderRadius: 12, border: '1px solid ' + t.border, overflow: 'hidden', minHeight: 300, background: t.bgPanel, boxShadow: t.shadow }}>
            <div style={{ padding: 16, borderBottom: '1px solid ' + t.border, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${t.accent}18`, color: t.accent }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={16}/><span>System Users ({activeCount} active{inactiveCount > 0 ? `, ${inactiveCount} inactive` : ''})</span></div>
                {inactiveCount > 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                        <input type="checkbox" checked={showInactiveUsers} onChange={e => setShowInactiveUsers(e.target.checked)} style={{ width: 14, height: 14, borderRadius: 4, borderColor: t.borderL, color: t.accent }}/>
                        Show inactive users
                    </label>
                )}
            </div>
            {loadingProfiles ? <div style={{ padding: 48, textAlign: 'center', color: t.text3 }}><Loader2 className="animate-spin" style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 8 }} size={24}/><p>Loading...</p></div> : (!profiles||profiles.length===0) ? <div style={{ padding: 48, textAlign: 'center', background: t.bgCard, color: t.text3 }}><Users style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 16, opacity: 0.2 }} size={48}/><h3 style={{ fontWeight: 700, color: t.text2 }}>No Users</h3><button onClick={()=>refetchProfiles()} className="hover:underline" style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, color: t.accent }}><RefreshCw size={14}/> Retry</button></div> : (
                <table style={{ width: '100%', textAlign: 'left' }}>
                    <thead style={{ background: t.bgCard, color: t.text2 }}><tr><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>User</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Role & Dept</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>Status</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'right' }}>Actions</th></tr></thead>
                    <tbody className="divide-y">
                        {filteredProfiles.map(u => (
                            <tr key={u.id} style={{ background: t.bgCard, opacity: u.isActive ? 1 : 0.6 }}>
                                <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, background: t.bgHover, color: t.text4 }}>{u.avatarUrl||u.fullName.substring(0,2).toUpperCase()}</div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontWeight: 700, color: t.text3 }}>{u.fullName}</span>
                                                {!u.isActive && <span style={{ fontSize: 10, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4, fontWeight: 600, background: t.dangerBg, color: t.danger }}>Inactive</span>}
                                            </div>
                                            <div style={{ fontSize: 13, color: t.text3 }}>{u.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 500, color: t.text3 }}>{u.role}</div><div style={{ fontSize: 12, color: t.text3 }}>{u.department||'No Dept'}</div></td>
                                <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>{u.isActive ? <span style={{ fontSize: 12, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, background: t.successBg, color: t.success }}>Active</span> : <span style={{ fontSize: 12, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, background: t.dangerBg, color: t.danger }}>Deactivated</span>}</td>
                                <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'right' }}>
                                    <button onClick={()=>handleEditUser(u)} style={{ padding: 8, borderRadius: 4, color: t.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = t.accentMuted)} onMouseLeave={(e) => (e.currentTarget.style.background = '')} title="Edit user"><Edit size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
        {/* Deactivate Confirmation Dialog */}
        <ConfirmDialog
            isOpen={deactivateConfirm.show}
            title="Deactivate User"
            message={`Deactivate user ${deactivateConfirm.user?.email}? They will lose access but all their data and history will be preserved.`}
            onConfirm={() => deactivateConfirm.user && handleDeactivateUser(deactivateConfirm.user)}
            onCancel={() => setDeactivateConfirm({ show: false, user: null })}
            confirmText="Deactivate"
            variant="danger"
            isLoading={actionLoading}
        />
        {showUserModal && (
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ borderRadius: 12, width: '100%', maxWidth: 512, background: t.bgPanel, boxShadow: t.shadowLg }}>
                    <div style={{ padding: 24, borderBottom: '1px solid ' + t.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{currentUser.id?'Edit User':'Create User'}</h3><button onClick={()=>setShowUserModal(false)} style={{ color: t.text4 }}><X size={24}/></button></div>
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: t.text2 }}>Full Name *</label><input style={{ width: '100%', padding: 10, border: '1px solid ' + t.border, borderRadius: 8 }} value={currentUser.fullName||''} onChange={e=>setCurrentUser({...currentUser,fullName:e.target.value})}/></div>
                        <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: t.text2 }}>Email *</label><input type="email" style={{ width: '100%', padding: 10, border: '1px solid ' + t.border, borderRadius: 8 }} value={currentUser.email||''} onChange={e=>setCurrentUser({...currentUser,email:e.target.value})} disabled={!!currentUser.id}/></div>
                        {!currentUser.id && <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: t.text2 }}>Password *</label><input type="password" style={{ width: '100%', padding: 10, border: '1px solid ' + t.border, borderRadius: 8 }} value={newUserPassword} onChange={e=>setNewUserPassword(e.target.value)}/></div>}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                            <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: t.text2 }}>Role</label><select style={{ width: '100%', padding: 10, border: '1px solid ' + t.border, borderRadius: 8, background: t.bgPanel }} value={currentUser.roleId||''} onChange={e=>setCurrentUser({...currentUser,roleId:e.target.value})}><option value="">Select</option>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                            <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: t.text2 }}>Department</label><select style={{ width: '100%', padding: 10, border: '1px solid ' + t.border, borderRadius: 8, background: t.bgPanel }} value={currentUser.departmentId||''} onChange={e=>setCurrentUser({...currentUser,departmentId:e.target.value})}><option value="">Select</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                        </div>
                        <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: t.text2 }}>Phone</label><input type="tel" style={{ width: '100%', padding: 10, border: '1px solid ' + t.border, borderRadius: 8 }} value={currentUser.phone||''} onChange={e=>setCurrentUser({...currentUser,phone:e.target.value})}/></div>
                    </div>
                    <div style={{ padding: 24, borderTop: '1px solid ' + t.border, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, background: t.bgCard }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button onClick={()=>setShowUserModal(false)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontWeight: 500, borderRadius: 8, color: t.text2 }} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>Cancel</button>
                            <button onClick={handleSaveUser} disabled={actionLoading} className="disabled:opacity-70" style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, background: t.accent, color: '#fff' }}>{actionLoading?<Loader2 className="animate-spin" size={16}/>:<Save size={16}/>}Save</button>
                        </div>
                        {currentUser.id && (
                            <div style={{ borderTop: '1px solid ' + t.border, paddingTop: 16, marginTop: 16 }}>
                                <p style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 600, marginBottom: 12, color: t.text4 }}>Account Actions</p>
                                {currentUser.isActive !== false ? (
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <button
                                            onClick={() => handleResetPassword(currentUser as Profile)}
                                            disabled={actionLoading}
                                            className="disabled:opacity-50" style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, border: '1px solid ' + t.borderL, borderRadius: 8, color: t.text2 }}
                                        >
                                            <Mail size={14}/> Reset Password
                                        </button>
                                        {isSuperAdmin && currentUser.id !== user?.id && (
                                            <button
                                                onClick={() => { setShowUserModal(false); setDeactivateConfirm({ show: true, user: currentUser as Profile }); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, border: '1px solid ' + t.danger, borderRadius: 8, color: t.danger }}
                                            >
                                                <UserX size={14}/> Deactivate User
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: 13, fontStyle: 'italic', color: t.text3 }}>
                                        This account is deactivated. To reactivate, use <strong>+ Add User</strong> with the same email &mdash; the previous history will be preserved.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
    );
  };

  const renderDatabaseBrowser = () => (
    <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>Database Browser</h2>
            <div style={{ display: 'flex', borderRadius: 8, padding: 4, border: '1px solid ' + t.border, background: t.bgPanel, boxShadow: t.shadow }}>{(['policies','slips','clauses'] as const).map(type=><button key={type} onClick={()=>setDbViewType(type)} className="transition-colors" style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 13, fontWeight: 700, textTransform: 'capitalize', borderRadius: 6, color: t.accent, background: dbViewType===type ? `${t.accent}20` : 'transparent' }}>{type}</button>)}</div>
        </div>
        <div style={{ borderRadius: 12, border: '1px solid ' + t.border, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadow }}>
            <div style={{ maxHeight: 600, overflow: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', fontSize: 13 }}>
                    <thead style={{ fontWeight: 600, position: 'sticky', top: 0, background: t.bgCard, color: t.text2 }}><tr><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, borderBottom: '1px solid ' + t.border }}>ID</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, borderBottom: '1px solid ' + t.border }}>Reference</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, borderBottom: '1px solid ' + t.border }}>Status</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, borderBottom: '1px solid ' + t.border, textAlign: 'right' }}>Raw</th></tr></thead>
                    <tbody className="divide-y">
                        {dbViewType==='policies' && rawPolicies.map(p=><tr key={p.id} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontFamily: 'monospace', fontSize: 12, color: t.text3 }}>{p.id.substring(0,8)}...</td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontWeight: 500 }}>{p.policyNumber}</td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}>{p.status} | {p.insuredName}</td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}><button onClick={()=>console.log(p)} className="hover:underline" style={{ fontSize: 12, color: t.accent }}>Log</button></td></tr>)}
                        {dbViewType==='slips' && rawSlips.map(s=><tr key={s.id} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontFamily: 'monospace', fontSize: 12, color: t.text3 }}>{s.id.substring(0,8)}...</td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontWeight: 500 }}>{s.slipNumber}</td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}>{s.status||'Active'} | {s.insuredName}</td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}><button onClick={()=>console.log(s)} className="hover:underline" style={{ fontSize: 12, color: t.accent }}>Log</button></td></tr>)}
                        {dbViewType==='clauses' && rawClauses.map(c=><tr key={c.id} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontFamily: 'monospace', fontSize: 12, color: t.text3 }}>{c.id.substring(0,8)}...</td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontWeight: 500 }}>{c.title}</td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}>{c.category}</td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}><button onClick={()=>console.log(c)} className="hover:underline" style={{ fontSize: 12, color: t.accent }}>Log</button></td></tr>)}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );

  const renderRecycleBin = () => (
    <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>Recycle Bin</h2><p style={{ fontSize: 13, color: t.text3 }}>Recover or purge deleted items.</p></div>
            <div style={{ display: 'flex', borderRadius: 8, padding: 4, border: '1px solid ' + t.border, background: t.bgPanel, boxShadow: t.shadow }}>{(['policies','slips','clauses'] as const).map(type=><button key={type} onClick={()=>setRecycleType(type)} className="transition-colors" style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 13, fontWeight: 700, textTransform: 'capitalize', borderRadius: 6, color: t.danger, background: recycleType===type ? t.dangerBg : 'transparent' }}>{type}</button>)}</div>
        </div>
        <div style={{ borderRadius: 12, border: '1px solid ' + t.border, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadow }}>
            <table style={{ width: '100%', textAlign: 'left' }}>
                <thead style={{ background: t.bgCard, color: t.text2 }}><tr><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Item</th><th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>Actions</th></tr></thead>
                <tbody className="divide-y">
                    {recycleType==='policies' && deletedPolicies.map(p=><tr key={p.id} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}><div style={{ fontWeight: 700, color: t.text1 }}>{p.policyNumber}</div><div style={{ fontSize: 13, color: t.text3 }}>{p.insuredName}</div></td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 12 }}><button onClick={e=>handleRestore(e,p.id)} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: t.success }} onMouseEnter={(e) => (e.currentTarget.style.background = t.successBg)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><RefreshCw size={14}/>Restore</button><button onClick={e=>handleHardDelete(e,p.id)} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: t.danger }} onMouseEnter={(e) => (e.currentTarget.style.background = t.dangerBg)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><Trash2 size={14}/>Purge</button></td></tr>)}
                    {recycleType==='slips' && deletedSlips.map(s=><tr key={s.id} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}><div style={{ fontWeight: 700, color: t.text1 }}>{s.slipNumber}</div><div style={{ fontSize: 13, color: t.text3 }}>{s.insuredName}</div></td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 12 }}><button onClick={e=>handleRestore(e,s.id)} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: t.success }} onMouseEnter={(e) => (e.currentTarget.style.background = t.successBg)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><RefreshCw size={14}/>Restore</button><button onClick={e=>handleHardDelete(e,s.id)} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: t.danger }} onMouseEnter={(e) => (e.currentTarget.style.background = t.dangerBg)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><Trash2 size={14}/>Purge</button></td></tr>)}
                    {recycleType==='clauses' && deletedClauses.map(c=><tr key={c.id} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}><div style={{ fontWeight: 700, color: t.text1 }}>{c.title}</div><div style={{ fontSize: 13, color: t.text3 }}>{c.category}</div></td><td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 12 }}><button onClick={e=>handleRestore(e,c.id)} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: t.success }} onMouseEnter={(e) => (e.currentTarget.style.background = t.successBg)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><RefreshCw size={14}/>Restore</button><button onClick={e=>handleHardDelete(e,c.id)} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: t.danger }} onMouseEnter={(e) => (e.currentTarget.style.background = t.dangerBg)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><Trash2 size={14}/>Purge</button></td></tr>)}
                    {((recycleType==='policies'&&deletedPolicies.length===0)||(recycleType==='slips'&&deletedSlips.length===0)||(recycleType==='clauses'&&deletedClauses.length===0)) && <tr><td colSpan={2} style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 32, paddingBottom: 32, textAlign: 'center', fontStyle: 'italic', color: t.text4 }}>No deleted items.</td></tr>}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderTemplates = () => (
    <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>Policy Templates</h2>
            <button onClick={()=>handleEditTemplate()} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, background: t.accent, color: '#fff' }}><Plus size={18}/>New</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {templates.map(tpl=><div key={tpl.id} style={{ padding: 20, borderRadius: 12, border: '1px solid ' + t.border, background: t.bgPanel, boxShadow: t.shadow }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}><h3 style={{ fontWeight: 700, color: t.text1 }}>{tpl.name}</h3><div style={{ display: 'flex', gap: 8 }}><button onClick={()=>handleEditTemplate(tpl)} style={{ padding: 6, borderRadius: 4, color: t.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = t.accentMuted)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><Edit size={16}/></button><button onClick={()=>handleDeleteTemplate(tpl.id)} style={{ padding: 6, borderRadius: 4, color: t.danger }} onMouseEnter={(e) => (e.currentTarget.style.background = t.dangerBg)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}><Trash2 size={16}/></button></div></div><p style={{ fontSize: 13, marginBottom: 8, color: t.text2 }}>{tpl.description||'No description.'}</p><div style={{ padding: 8, borderRadius: 4, fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: t.bgCard, color: t.text3 }}>{tpl.id}</div></div>)}
        </div>
        {isEditingTemplate && (
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ borderRadius: 12, width: '100%', maxWidth: 672, height: '80vh', display: 'flex', flexDirection: 'column', background: t.bgPanel, boxShadow: t.shadowLg }}>
                    <div style={{ padding: 16, borderBottom: '1px solid ' + t.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ fontWeight: 700, color: t.text1 }}>Edit Template</h3><button onClick={()=>setIsEditingTemplate(false)}><X size={20}/></button></div>
                    <div style={{ padding: 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: t.text2 }}>Name</label><input style={{ width: '100%', padding: 8, border: '1px solid ' + t.border, borderRadius: 4 }} value={currentTemplate.name} onChange={e=>setCurrentTemplate({...currentTemplate,name:e.target.value})}/></div>
                        <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: t.text2 }}>Description</label><input style={{ width: '100%', padding: 8, border: '1px solid ' + t.border, borderRadius: 4 }} value={currentTemplate.description} onChange={e=>setCurrentTemplate({...currentTemplate,description:e.target.value})}/></div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: t.text2 }}>HTML Content</label><textarea style={{ width: '100%', flex: 1, padding: 8, border: '1px solid ' + t.border, borderRadius: 4, fontFamily: 'monospace', fontSize: 12, minHeight: 300 }} value={currentTemplate.content} onChange={e=>setCurrentTemplate({...currentTemplate,content:e.target.value})}/></div>
                    </div>
                    <div style={{ padding: 16, borderTop: '1px solid ' + t.border, display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button onClick={()=>setIsEditingTemplate(false)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontWeight: 500, color: t.text2 }}>Cancel</button><button onClick={handleSaveTemplate} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontWeight: 700, borderRadius: 4, background: t.accent, color: '#fff' }}>Save</button></div>
                </div>
            </div>
        )}
    </div>
  );

  const renderFxRates = () => {
    // Currency flag helper
    const getCurrencyFlag = (code: string): string => {
      const flags: Record<string, string> = {
        USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', RUB: '🇷🇺', CNY: '🇨🇳',
        KZT: '🇰🇿', TRY: '🇹🇷', AED: '🇦🇪', CHF: '🇨🇭', JPY: '🇯🇵',
        CAD: '🇨🇦', AUD: '🇦🇺', KRW: '🇰🇷', INR: '🇮🇳',
      };
      return flags[code] || '🏳️';
    };

    return (
      <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.text1, fontSize: 24, fontWeight: 700 }}>
            <Globe style={{ color: t.accent }} size={28} />
            Exchange Rates
          </h2>
          <p style={{ fontSize: 13, marginTop: 4, color: t.text3 }}>
            Official rates from the Central Bank of Uzbekistan (CBU)
          </p>
        </div>

        {/* Exchange Rates Card */}
        <div style={{ borderRadius: 12, border: '1px solid ' + t.border, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadow }}>
          {/* Header */}
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.accent }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
              <Globe size={24} />
              <div>
                <h3 style={{ fontWeight: 700 }}>CBU Exchange Rates</h3>
                <p style={{ fontSize: 13, opacity: 0.8 }}>
                  {cbuLastUpdated
                    ? `Last synced: ${cbuLastUpdated.toLocaleTimeString()}`
                    : 'Click on date to load rates'}
                </p>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setPopupDate(cbuSelectedDate);
                  setShowDatePopup(true);
                }}
                className="transition-colors"
                style={{ fontSize: 13, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 9999, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#fff', background: 'rgba(255,255,255,0.2)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
              >
                <span>Rate Date: {cbuRates.length > 0 && cbuRates[0]?.date ? formatDate(cbuRates[0].date) : formatDate(toISODateString(cbuSelectedDate) || '')}</span>
                <Edit size={14} />
              </button>

              {/* Date Selection Popup */}
              {showDatePopup && (
                <>
                  {/* Backdrop */}
                  <div
                    style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }}
                    onClick={() => setShowDatePopup(false)}
                  />
                  {/* Popup */}
                  <div
                    style={{ position: 'fixed', borderRadius: 12, border: '1px solid ' + t.border, padding: 16, zIndex: 50, minWidth: 280, top: '140px', right: '40px', background: t.bgPanel, boxShadow: t.shadowLg }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <h4 style={{ fontWeight: 600, color: t.text1 }}>Select Date</h4>
                      <button
                        onClick={() => setShowDatePopup(false)}
                        style={{ color: t.text4 }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <DatePickerInput
                        value={popupDate}
                        onChange={setPopupDate}
                        maxDate={new Date()}
                        className="!py-2"
                      />
                      <button
                        onClick={() => refreshCBURates(popupDate)}
                        disabled={cbuLoading}
                        className="disabled:opacity-50 transition-colors"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, fontWeight: 500, background: t.accent, color: '#fff' }}
                      >
                        <RefreshCw size={18} className={cbuLoading ? 'animate-spin' : ''} />
                        {cbuLoading ? 'Syncing...' : 'Refresh Rates'}
                      </button>
                      <p style={{ fontSize: 12, textAlign: 'center', color: t.text3 }}>
                        Fetches latest rates from CBU and syncs to database
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Warning State (cached rates) */}
          {cbuError && cbuUsingCachedRates && cbuRates.length > 0 && (
            <div style={{ padding: 16, borderBottom: '1px solid ' + t.warning, display: 'flex', alignItems: 'center', gap: 8, background: t.warningBg, color: t.warning }}>
              <AlertTriangle size={18} />
              <span>{cbuError}</span>
            </div>
          )}

          {/* Error State (no rates available) */}
          {cbuError && !cbuUsingCachedRates && (
            <div style={{ padding: 16, borderBottom: '1px solid ' + t.danger, display: 'flex', alignItems: 'center', gap: 8, background: t.dangerBg, color: t.danger }}>
              <AlertTriangle size={18} />
              <span>{cbuError}</span>
              <button
                onClick={loadCBURates}
                className="transition-colors"
                style={{ marginLeft: 'auto', fontSize: 13, paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4, background: t.dangerBg }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {cbuLoading && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <RefreshCw className="animate-spin" style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 12, color: t.accent }} size={32} />
              <p style={{ color: t.text3 }}>Loading exchange rates from CBU...</p>
            </div>
          )}

          {/* Rates Table */}
          {!cbuLoading && cbuRates.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead style={{ fontSize: 13, background: t.bgCard, color: t.text2 }}>
                  <tr>
                    <th style={{ textAlign: 'left', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 600 }}>Currency</th>
                    <th style={{ textAlign: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 600 }}>Code</th>
                    <th style={{ textAlign: 'right', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 600 }}>Nominal</th>
                    <th style={{ textAlign: 'right', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 600 }}>Rate (UZS)</th>
                    <th style={{ textAlign: 'right', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 600 }}>Change</th>
                    <th style={{ textAlign: 'right', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 600 }}>Per 1 Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cbuRates.map((rate, idx) => (
                    <tr
                      key={rate.code}
                      className="transition-colors"
                      style={{ background: idx % 2 === 0 ? 'transparent' : `${t.accent}18` }}
                    >
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 24 }}>{getCurrencyFlag(rate.code)}</span>
                          <span style={{ fontWeight: 500, color: t.text1 }}>{rate.name}</span>
                        </div>
                      </td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: 6, fontFamily: 'monospace', fontWeight: 700, fontSize: 13, background: t.bgCard, color: t.text1 }}>
                          {rate.code}
                        </span>
                      </td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right', color: t.text2 }}>
                        {rate.nominal}
                      </td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>
                        <span style={{ color: t.text1, fontSize: 15, fontWeight: 600 }}>
                          {rate.rawRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 13, fontWeight: 500, background: t.successBg, color: t.success }}>
                          {rate.diff > 0 ? (
                            <TrendingUp size={14} />
                          ) : rate.diff < 0 ? (
                            <TrendingDown size={14} />
                          ) : (
                            <Minus size={14} />
                          )}
                          {rate.diff > 0 ? '+' : ''}{rate.diff.toFixed(2)}
                        </span>
                      </td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>
                        <span style={{ fontFamily: 'monospace', color: t.text2 }}>
                          {rate.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!cbuLoading && cbuRates.length === 0 && !cbuError && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Globe style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 12, color: t.text5 }} size={48} />
              <p style={{ color: t.text3 }}>No exchange rates available for this date</p>
              <button
                onClick={loadCBURates}
                style={{ marginTop: 16, fontWeight: 500, color: t.accent }}
              >
                Try loading rates
              </button>
            </div>
          )}

          {/* Footer with source info */}
          <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderTop: '1px solid ' + t.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, background: t.bgCard, color: t.text3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={16} />
              <span>Source: Central Bank of Uzbekistan (cbu.uz)</span>
            </div>
            <span>{cbuRates.length} currencies available</span>
          </div>
        </div>

      </div>
    );
  };

  const renderPresets = () => (
    <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>Inward Reinsurance Presets</h2>
          <p style={{ fontSize: 13, marginTop: 4, color: t.text3 }}>Manage dropdown options for Type of Cover, Class of Cover, and Industry</p>
        </div>
        <button onClick={fetchPresets} style={{ padding: 8, borderRadius: 8, color: t.text3 }} title="Refresh">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid ' + t.border }}>
        <button
          onClick={() => setPresetCategory('TYPE_OF_COVER')}
          className="transition-colors"
          style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontWeight: 500, color: t.accent, borderBottom: presetCategory === 'TYPE_OF_COVER' ? '2px solid ' + t.accent : '2px solid transparent' }}
        >
          Type of Cover
        </button>
        <button
          onClick={() => setPresetCategory('CLASS_OF_COVER')}
          className="transition-colors"
          style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontWeight: 500, color: t.accent, borderBottom: presetCategory === 'CLASS_OF_COVER' ? '2px solid ' + t.accent : '2px solid transparent' }}
        >
          Class of Cover
        </button>
        <button
          onClick={() => setPresetCategory('INDUSTRY')}
          className="transition-colors"
          style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontWeight: 500, color: t.accent, borderBottom: presetCategory === 'INDUSTRY' ? '2px solid ' + t.accent : '2px solid transparent' }}
        >
          Industry
        </button>
      </div>

      {/* Add New Preset */}
      <div style={{ borderRadius: 12, border: '1px solid ' + t.border, padding: 24, background: t.bgPanel, boxShadow: t.shadow }}>
        <h3 style={{ fontWeight: 700, marginBottom: 16, color: t.text2 }}>Add New {presetCategory.replace(/_/g, ' ').toLowerCase()}</h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, color: t.text3 }}>Value *</label>
            <input
              type="text"
              placeholder="e.g., Property, Casualty, Marine..."
              style={{ width: '100%', padding: 10, border: '1px solid ' + t.border, borderRadius: 8, outline: 'none' }}
              value={newPresetValue}
              onChange={(e) => setNewPresetValue(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, color: t.text3 }}>Description</label>
            <input
              type="text"
              placeholder="Optional description..."
              style={{ width: '100%', padding: 10, border: '1px solid ' + t.border, borderRadius: 8, outline: 'none' }}
              value={newPresetDescription}
              onChange={(e) => setNewPresetDescription(e.target.value)}
            />
          </div>
          <button
            onClick={handleAddPreset}
            style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 10, paddingBottom: 10, borderRadius: 8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, background: t.success, color: '#fff' }}
          >
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>

      {/* Presets List */}
      <div style={{ borderRadius: 12, border: '1px solid ' + t.border, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadow }}>
        {presetsLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: t.text3 }}>
            <Loader2 className="animate-spin" style={{ display: 'inline', marginRight: 8 }} size={20} />
            Loading presets...
          </div>
        ) : presets.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: t.text4 }}>
            <List size={40} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 8, opacity: 0.5 }} />
            <p>No presets found for this category</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Add your first preset above</p>
          </div>
        ) : (
          <table style={{ width: '100%', textAlign: 'left' }}>
            <thead style={{ background: t.bgCard, color: t.text2 }}>
              <tr>
                <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Value</th>
                <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Description</th>
                <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {presets.map((preset) => (
                <tr key={preset.id} onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}>
                    {editingPreset?.id === preset.id ? (
                      <input
                        type="text"
                        style={{ width: '100%', padding: 6, border: '1px solid ' + t.border, borderRadius: 4 }}
                        value={editingPreset.value}
                        onChange={(e) => setEditingPreset({ ...editingPreset, value: e.target.value })}
                      />
                    ) : (
                      <span style={{ fontWeight: 500, color: t.text1 }}>{preset.value}</span>
                    )}
                  </td>
                  <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}>
                    {editingPreset?.id === preset.id ? (
                      <input
                        type="text"
                        style={{ width: '100%', padding: 6, border: '1px solid ' + t.border, borderRadius: 4 }}
                        value={editingPreset.description || ''}
                        onChange={(e) => setEditingPreset({ ...editingPreset, description: e.target.value })}
                      />
                    ) : (
                      <span style={{ color: t.text3 }}>{preset.description || '-'}</span>
                    )}
                  </td>
                  <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, textAlign: 'center' }}>
                    {editingPreset?.id === preset.id ? (
                      <select
                        style={{ padding: 6, border: '1px solid ' + t.border, borderRadius: 4 }}
                        value={editingPreset.isActive ? 'true' : 'false'}
                        onChange={(e) => setEditingPreset({ ...editingPreset, isActive: e.target.value === 'true' })}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    ) : (
                      <span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 12, fontWeight: 500, background: t.successBg, color: t.success }}>
                        {preset.isActive ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>
                    {editingPreset?.id === preset.id ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          onClick={handleUpdatePreset}
                          style={{ padding: 6, borderRadius: 4, color: t.success }} onMouseEnter={(e) => (e.currentTarget.style.background = t.successBg)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => setEditingPreset(null)}
                          style={{ padding: 6, borderRadius: 4, color: t.text3 }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          onClick={() => setEditingPreset(preset)}
                          style={{ padding: 6, borderRadius: 4, color: t.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = t.accentMuted)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id, preset.value)}
                          style={{ padding: 6, borderRadius: 4, color: t.danger }} onMouseEnter={(e) => (e.currentTarget.style.background = t.dangerBg)} onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const TIMEOUT_OPTIONS = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 240, label: '4 hours' },
  ];

  const handleSaveSessionTimeout = async () => {
    setSessionTimeoutSaving(true);
    try {
      await DB.setSetting('session_timeout_minutes', String(sessionTimeoutMinutes));
      toast.success('Session timeout updated');
    } catch {
      toast.error('Failed to save session timeout');
    } finally {
      setSessionTimeoutSaving(false);
    }
  };

  const handleSaveOperatingExpenses = async () => {
    setOperatingExpensesSaving(true);
    try {
      await DB.setSetting('annual_operating_expenses', annualOperatingExpenses || '0');
      toast.success('Operating expenses updated');
    } catch {
      toast.error('Failed to save operating expenses');
    } finally {
      setOperatingExpensesSaving(false);
    }
  };

  const renderSettings = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>Settings</h2>
      </div>

      {/* Session Timeout Section */}
      <div style={{ borderRadius: 12, border: '1px solid ' + t.border, padding: 24, background: t.bgPanel, boxShadow: t.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Timer size={22} style={{ color: t.accent }} />
          <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 600 }}>Session Timeout</h3>
        </div>
        <p style={{ fontSize: 13, marginBottom: 16, color: t.text3 }}>
          Auto-logout after inactivity. This setting applies globally to all users. Users will see a warning 2 minutes before being logged out.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: t.text2 }}>Timeout duration:</label>
          <div style={{ display: 'flex', borderRadius: 8, border: '1px solid ' + t.borderL, overflow: 'hidden' }}>
            {TIMEOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSessionTimeoutMinutes(opt.value)}
                className="transition-colors last:border-r-0" style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 13, fontWeight: 500, borderRight: '1px solid ' + t.borderL, background: sessionTimeoutMinutes === opt.value ? t.accent : 'transparent', color: sessionTimeoutMinutes === opt.value ? '#fff' : t.text2 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSaveSessionTimeout}
            disabled={sessionTimeoutSaving}
            className="disabled:opacity-50 transition-colors"
            style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 13, fontWeight: 500, background: t.accent, color: '#fff' }}
          >
            {sessionTimeoutSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
          <span style={{ fontSize: 12, color: t.text4 }}>
            Current: {TIMEOUT_OPTIONS.find(o => o.value === sessionTimeoutMinutes)?.label || `${sessionTimeoutMinutes} min`}
          </span>
        </div>
      </div>

      {/* Operating Expenses Section */}
      <div style={{ borderRadius: 12, border: '1px solid ' + t.border, padding: 24, background: t.bgPanel, boxShadow: t.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <DollarSign size={22} style={{ color: t.accent }} />
          <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 600 }}>Operating Expenses (Annual)</h3>
        </div>
        <p style={{ fontSize: 13, marginBottom: 16, color: t.text3 }}>
          Enter total annual operating expenses (salaries, rent, IT, etc.)
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: t.text2 }}>Amount (USD):</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: t.text4 }}>$</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={annualOperatingExpenses}
              onChange={(e) => setAnnualOperatingExpenses(e.target.value)}
              placeholder="0"
              style={{ paddingLeft: 28, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid ' + t.borderL, borderRadius: 8, fontSize: 13, width: 224, outline: 'none' }}
            />
          </div>
        </div>
        <p style={{ fontSize: 12, marginTop: 12, color: t.text4 }}>
          This is used to calculate the Expense Ratio in Analytics. Expense Ratio = Operating Expenses / Net Premium Earned
        </p>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSaveOperatingExpenses}
            disabled={operatingExpensesSaving}
            className="disabled:opacity-50 transition-colors"
            style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 13, fontWeight: 500, background: '#a855f7', color: '#fff' }}
          >
            {operatingExpensesSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
          {annualOperatingExpenses && Number(annualOperatingExpenses) > 0 && (
            <span style={{ fontSize: 12, color: t.text4 }}>
              Current: ${Number(annualOperatingExpenses).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: t.bgCard }}>
      <aside className="transition-all duration-300" style={{ width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column', marginLeft: isSidebarOpen ? 0 : -256, background: t.bgSidebar, color: '#fff' }}>
        <div style={{ padding: 24, borderBottom: '1px solid ' + t.border }}><h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700 }}><Lock style={{ color: t.danger }}/>Admin Console</h1></div>
        <nav style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <button onClick={()=>setActiveSection('dashboard')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='dashboard' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='dashboard') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='dashboard') e.currentTarget.style.background = ''; }}><Activity size={20}/>Dashboard</button>
          <div style={{ paddingTop: 16, paddingBottom: 8, paddingLeft: 16, paddingRight: 16, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: t.text3 }}>Access Control</div>
          <button onClick={()=>setActiveSection('users')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='users' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='users') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='users') e.currentTarget.style.background = ''; }}><Users size={20}/>Users</button>
          <button onClick={()=>setActiveSection('roles')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='roles' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='roles') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='roles') e.currentTarget.style.background = ''; }}><ShieldCheck size={20}/>Roles & Permissions</button>
          <button onClick={()=>setActiveSection('departments')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='departments' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='departments') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='departments') e.currentTarget.style.background = ''; }}><Building2 size={20}/>Departments</button>
          <div style={{ paddingTop: 16, paddingBottom: 8, paddingLeft: 16, paddingRight: 16, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: t.text3 }}>System</div>
          <button onClick={()=>setActiveSection('database')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='database' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='database') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='database') e.currentTarget.style.background = ''; }}><Table size={20}/>Database Browser</button>
          <button onClick={()=>setActiveSection('recycle')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='recycle' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='recycle') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='recycle') e.currentTarget.style.background = ''; }}><Trash2 size={20}/>Recycle Bin</button>
          <button onClick={()=>setActiveSection('activity-log')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='activity-log' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='activity-log') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='activity-log') e.currentTarget.style.background = ''; }}><ScrollText size={20}/>Activity Log</button>
          <div style={{ paddingTop: 16, paddingBottom: 8, paddingLeft: 16, paddingRight: 16, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: t.text3 }}>Configuration</div>
          <button onClick={()=>setActiveSection('templates')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='templates' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='templates') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='templates') e.currentTarget.style.background = ''; }}><FileText size={20}/>Policy Templates</button>
          <button onClick={()=>setActiveSection('fx')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='fx' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='fx') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='fx') e.currentTarget.style.background = ''; }}><Coins size={20}/>Exchange Rates</button>
          <button onClick={()=>setActiveSection('presets')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='presets' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='presets') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='presets') e.currentTarget.style.background = ''; }}><List size={20}/>Reinsurance Presets</button>
          <button onClick={()=>setActiveSection('settings')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, ...(activeSection==='settings' ? { background: t.accent, color: '#fff' } : { color: t.text4 }) }} onMouseEnter={(e) => { if (activeSection!=='settings') e.currentTarget.style.background = t.bgHover; }} onMouseLeave={(e) => { if (activeSection!=='settings') e.currentTarget.style.background = ''; }}><Timer size={20}/>Settings</button>
          <div style={{ paddingTop: 32, marginTop: 'auto' }}><button onClick={()=>navigate('/')} className="transition-colors" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 8, color: t.text4 }} onMouseEnter={(e) => { e.currentTarget.style.background = t.bgHover; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = t.text4; }}><LogOut size={20}/>Exit Console</button></div>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 32, overflowY: 'auto', height: '100vh' }}>
        {loading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: t.text3 }}><Loader2 className="animate-spin" style={{ marginRight: 8 }} size={24}/>Loading...</div> : <>
          {activeSection==='dashboard' && renderDashboardHome()}
          {activeSection==='users' && renderUsers()}
          {activeSection==='roles' && renderRoles()}
          {activeSection==='departments' && renderDepartments()}
          {activeSection==='database' && renderDatabaseBrowser()}
          {activeSection==='recycle' && renderRecycleBin()}
          {activeSection==='activity-log' && renderActivityLog()}
          {activeSection==='templates' && renderTemplates()}
          {activeSection==='fx' && renderFxRates()}
          {activeSection==='presets' && renderPresets()}
          {activeSection==='settings' && renderSettings()}
        </>}
      </main>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={hardDeleteConfirm.show}
        title="Permanently Delete"
        message="Are you sure? This action is irreversible and the item will be permanently removed."
        onConfirm={confirmHardDelete}
        onCancel={() => setHardDeleteConfirm({ show: false, id: '' })}
        confirmText="Delete Forever"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={deleteTemplateConfirm.show}
        title="Delete Template"
        message="Are you sure you want to delete this template?"
        onConfirm={confirmDeleteTemplate}
        onCancel={() => setDeleteTemplateConfirm({ show: false, id: '' })}
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={deleteDeptConfirm.show}
        title="Delete Department"
        message={`Are you sure you want to delete department "${deleteDeptConfirm.name}"?`}
        onConfirm={confirmDeleteDepartment}
        onCancel={() => setDeleteDeptConfirm({ show: false, id: '', name: '' })}
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={deletePresetConfirm.show}
        title="Delete Preset"
        message={`Are you sure you want to delete preset "${deletePresetConfirm.value}"?`}
        onConfirm={confirmDeletePreset}
        onCancel={() => setDeletePresetConfirm({ show: false, id: '', value: '' })}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default AdminConsole;
