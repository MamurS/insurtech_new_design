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
    <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">System Overview</h2>
            <button onClick={loadAllData} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"><RefreshCw size={16}/> Refresh</button>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Policies', value: stats.totalPolicies, icon: FileText, color: 'blue' },
              { label: 'Slips', value: stats.totalSlips, icon: ScrollText, color: 'orange' },
              { label: 'Open Claims', value: stats.activeClaims, icon: AlertCircle, color: 'red' },
              { label: 'Pending Tasks', value: stats.pendingTasks, icon: Clock, color: 'yellow' },
              { label: 'Users', value: stats.totalUsers, icon: Users, color: 'purple' },
              { label: 'Deleted', value: stats.deletedItems, icon: Trash2, color: 'gray', textRed: true },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-${stat.color}-100 rounded-lg flex items-center justify-center`}>
                    <stat.icon size={20} className={`text-${stat.color}-600`} />
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs font-medium">{stat.label}</div>
                    <div className={`text-2xl font-bold ${stat.textRed ? 'text-red-600' : 'text-gray-900'}`}>{stat.value}</div>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Financial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-green-100 text-sm">Total Premium</p>
                        <p className="text-3xl font-bold mt-1">${totalPremium.toLocaleString()}</p>
                        <p className="text-green-200 text-xs mt-2">{rawPolicies.length} policies</p>
                    </div>
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center"><DollarSign size={28}/></div>
                </div>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-red-100 text-sm">Claims Paid</p>
                        <p className="text-3xl font-bold mt-1">${totalClaimsPaid.toLocaleString()}</p>
                        <p className="text-red-200 text-xs mt-2">{claims.length} claims</p>
                    </div>
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center"><TrendingDown size={28}/></div>
                </div>
            </div>
            <div className={`bg-gradient-to-br ${lossRatio > 70 ? 'from-amber-500 to-amber-600' : 'from-blue-500 to-blue-600'} rounded-xl p-6 text-white shadow-lg`}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm opacity-80">Loss Ratio</p>
                        <p className="text-3xl font-bold mt-1">{lossRatio.toFixed(1)}%</p>
                        <p className="text-xs opacity-70 mt-2">{lossRatio > 70 ? 'Above target' : 'Within target'}</p>
                    </div>
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center"><PieChart size={28}/></div>
                </div>
            </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Policy Status</h3>
                <div className="flex items-center justify-center gap-8">
                    <div className="relative w-40 h-40">
                        <svg viewBox="0 0 36 36" className="w-40 h-40 transform -rotate-90">
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3"/>
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#22c55e" strokeWidth="3" strokeDasharray={`${(activePolicies/Math.max(stats.totalPolicies,1))*100} 100`}/>
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#eab308" strokeWidth="3" strokeDasharray={`${(pendingPolicies/Math.max(stats.totalPolicies,1))*100} 100`} strokeDashoffset={`-${(activePolicies/Math.max(stats.totalPolicies,1))*100}`}/>
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray={`${(expiredPolicies/Math.max(stats.totalPolicies,1))*100} 100`} strokeDashoffset={`-${((activePolicies+pendingPolicies)/Math.max(stats.totalPolicies,1))*100}`}/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-bold">{stats.totalPolicies}</span></div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-green-500"></div><span className="text-sm">Active ({activePolicies})</span></div>
                        <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-yellow-500"></div><span className="text-sm">Pending ({pendingPolicies})</span></div>
                        <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-red-500"></div><span className="text-sm">Expired ({expiredPolicies})</span></div>
                    </div>
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Slip Status</h3>
                <div className="space-y-3">
                    {['DRAFT','PENDING','QUOTED','BOUND','CLOSED','DECLINED'].map(status => {
                        const count = rawSlips.filter(s => s.status === status).length;
                        const pct = stats.totalSlips > 0 ? (count/stats.totalSlips)*100 : 0;
                        const colors: Record<string,string> = { DRAFT:'bg-gray-400', PENDING:'bg-blue-500', QUOTED:'bg-purple-500', BOUND:'bg-green-500', CLOSED:'bg-gray-600', DECLINED:'bg-red-500' };
                        return (
                            <div key={status} className="flex items-center gap-3">
                                <div className="w-20 text-xs font-medium text-gray-600">{status}</div>
                                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${colors[status]}`} style={{width:`${pct}%`}}></div>
                                </div>
                                <div className="w-12 text-right text-sm font-medium">{count}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Recent Activity & Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Recent Activity</h3>
                    <button onClick={() => setActiveSection('activity-log')} className="text-sm text-blue-600 hover:text-blue-800">View All →</button>
                </div>
                <div className="space-y-3">
                    {recentActivity.length === 0 ? (
                        <div className="text-center py-8 text-gray-400"><Activity size={32} className="mx-auto mb-2 opacity-50"/><p className="text-sm">No recent activity</p></div>
                    ) : recentActivity.slice(0,5).map((a,i) => (
                        <div key={i} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${a.action==='INSERT'?'bg-green-100 text-green-600':a.action==='UPDATE'?'bg-blue-100 text-blue-600':a.action==='DELETE'?'bg-red-100 text-red-600':'bg-purple-100 text-purple-600'}`}>
                                {a.action==='INSERT'?<Plus size={14}/>:a.action==='UPDATE'?<Edit size={14}/>:a.action==='DELETE'?<Trash2 size={14}/>:<RefreshCw size={14}/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800 truncate">{a.action_description}</p>
                                <p className="text-xs text-gray-500">{a.user_name||'System'} • {formatTimeAgo(a.created_at)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Pending Tasks</h3>
                    <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">{tasks.filter(t=>t.status==='PENDING').length} pending</span>
                </div>
                <div className="space-y-3">
                    {tasks.filter(t=>t.status==='PENDING').length===0 ? (
                        <div className="text-center py-8 text-gray-400"><CheckCircle size={32} className="mx-auto mb-2 opacity-50"/><p className="text-sm">All tasks done!</p></div>
                    ) : tasks.filter(t=>t.status==='PENDING').slice(0,5).map((t,i) => (
                        <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-2 h-2 rounded-full ${t.priority==='HIGH'?'bg-red-500':t.priority==='MEDIUM'?'bg-yellow-500':'bg-green-500'}`}></div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                                    <p className="text-xs text-gray-500">{t.assigned_to_name||'Unassigned'}</p>
                                </div>
                            </div>
                            <span className="text-xs text-gray-500 ml-2">{t.due_date?formatDate(t.due_date):'No due date'}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );

  const renderActivityLog = () => (
    <div className="space-y-4 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
            <div><h2 className="text-xl font-bold text-gray-800">Activity Log</h2><p className="text-sm text-gray-500">Track all system activities</p></div>
            <button onClick={fetchActivityLogs} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"><RefreshCw size={16}/>Refresh</button>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Search</label>
                    <input type="text" placeholder="Search..." value={activitySearch} onChange={e=>{setActivitySearch(e.target.value);setActivityPage(0);}} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Category</label>
                    <select value={activityCategory} onChange={e=>{setActivityCategory(e.target.value);setActivityPage(0);}} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
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
            {(activitySearch||activityCategory||activityDateFrom||activityDateTo) && <button onClick={()=>{setActivitySearch('');setActivityCategory('');setActivityDateFrom('');setActivityDateTo('');setActivityPage(0);}} className="mt-3 text-sm text-blue-600 hover:text-blue-800">Clear filters</button>}
        </div>
        <div className="text-sm text-gray-500">Showing {activityLogs.length} of {activityTotal} logs</div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {activityLogLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={32}/></div> : activityLogs.length===0 ? <div className="text-center py-12 text-gray-500"><ScrollText size={48} className="mx-auto mb-4 text-gray-300"/><p>No logs found</p></div> : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b"><tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reference</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-100">
                            {activityLogs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                                    <td className="px-4 py-3"><div className="text-sm font-medium text-gray-900">{log.user_name||'System'}</div><div className="text-xs text-gray-500">{log.user_email}</div></td>
                                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${log.action==='INSERT'?'bg-green-100 text-green-800':log.action==='UPDATE'?'bg-blue-100 text-blue-800':log.action==='DELETE'?'bg-red-100 text-red-800':log.action==='STATUS_CHANGE'?'bg-purple-100 text-purple-800':'bg-gray-100 text-gray-800'}`}>{log.action}</span></td>
                                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${log.action_category==='POLICY'?'bg-indigo-50 text-indigo-700':log.action_category==='SLIP'?'bg-orange-50 text-orange-700':log.action_category==='CLAIM'?'bg-red-50 text-red-700':log.action_category==='TASK'?'bg-yellow-50 text-yellow-700':'bg-gray-50 text-gray-700'}`}>{log.action_category}</span></td>
                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-md truncate" title={log.action_description}>{log.action_description}</td>
                                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{log.entity_reference}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        {activityTotal > ACTIVITY_PAGE_SIZE && (
            <div className="flex items-center justify-between">
                <button onClick={()=>setActivityPage(p=>Math.max(0,p-1))} disabled={activityPage===0} className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50">Previous</button>
                <span className="text-sm text-gray-600">Page {activityPage+1} of {Math.ceil(activityTotal/ACTIVITY_PAGE_SIZE)}</span>
                <button onClick={()=>setActivityPage(p=>p+1)} disabled={(activityPage+1)*ACTIVITY_PAGE_SIZE>=activityTotal} className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50">Next</button>
            </div>
        )}
    </div>
  );

  const renderDepartments = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center">
            <div><h2 className="text-2xl font-bold text-gray-800">Departments</h2><p className="text-sm text-gray-500">Manage organization structure.</p></div>
            <button onClick={()=>handleEditDepartment()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"><Plus size={18}/> Add Department</button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-700"><tr><th className="px-6 py-4 w-12">Code</th><th className="px-6 py-4">Name</th><th className="px-6 py-4">Head</th><th className="px-6 py-4 text-center">Staff</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
                <tbody className="divide-y">
                    {departments.map(dept => (
                        <tr key={dept.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-mono text-gray-500 font-bold">{dept.code}</td>
                            <td className="px-6 py-4"><div className="font-bold text-gray-900">{dept.name}</div><div className="text-xs text-gray-500">{dept.description}</div></td>
                            <td className="px-6 py-4 text-sm text-gray-600">{(dept as any).headName || '-'}</td>
                            <td className="px-6 py-4 text-center text-sm">{dept.currentStaffCount||0} / {dept.maxStaff||'∞'}</td>
                            <td className="px-6 py-4 text-center">{dept.isActive ? <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Active</span> : <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">Inactive</span>}</td>
                            <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={()=>handleEditDepartment(dept)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit size={16}/></button><button onClick={()=>handleDeleteDepartment(dept.id,dept.name)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button></div></td>
                        </tr>
                    ))}
                    {departments.length===0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No departments found.</td></tr>}
                </tbody>
            </table>
        </div>
        {showDeptModal && <DepartmentEditModal department={selectedDept} onClose={()=>setShowDeptModal(false)} onSave={loadAllData} allUsers={profiles||[]}/>}
    </div>
  );

  const renderRoles = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center">
            <div><h2 className="text-2xl font-bold text-gray-800">RBAC Roles</h2><p className="text-sm text-gray-500">Manage roles and permissions.</p></div>
            <button onClick={()=>handleEditRole()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"><Plus size={18}/> Add Role</button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-700"><tr><th className="px-6 py-4 w-12">Lvl</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Department</th><th className="px-6 py-4 text-center">System</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
                <tbody className="divide-y">
                    {roles.map(role => (
                        <tr key={role.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-mono text-gray-500 font-bold">{role.level}</td>
                            <td className="px-6 py-4"><div className="font-bold text-gray-900">{role.name}</div><div className="text-xs text-gray-500">{role.description}</div></td>
                            <td className="px-6 py-4 text-sm text-gray-600">{role.department||'-'}</td>
                            <td className="px-6 py-4 text-center">{role.isSystemRole && <Lock size={14} className="inline text-amber-500"/>}</td>
                            <td className="px-6 py-4 text-center">{role.isActive ? <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Active</span> : <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">Inactive</span>}</td>
                            <td className="px-6 py-4 text-right"><button onClick={()=>handleEditRole(role)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit size={16}/></button></td>
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
    <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
            <button onClick={()=>handleEditUser()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"><Plus size={18}/> Add User</button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[300px]">
            <div className="p-4 border-b bg-blue-50 text-blue-800 text-sm flex items-center justify-between">
                <div className="flex items-center gap-2"><ShieldCheck size={16}/><span>System Users ({activeCount} active{inactiveCount > 0 ? `, ${inactiveCount} inactive` : ''})</span></div>
                {inactiveCount > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                        <input type="checkbox" checked={showInactiveUsers} onChange={e => setShowInactiveUsers(e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"/>
                        Show inactive users
                    </label>
                )}
            </div>
            {loadingProfiles ? <div className="p-12 text-center text-gray-500"><Loader2 className="animate-spin mx-auto mb-2" size={24}/><p>Loading...</p></div> : (!profiles||profiles.length===0) ? <div className="p-12 text-center bg-gray-50 text-gray-500"><Users className="mx-auto mb-4 opacity-20" size={48}/><h3 className="font-bold text-gray-700">No Users</h3><button onClick={()=>refetchProfiles()} className="text-blue-600 hover:underline text-sm font-bold flex items-center justify-center gap-2 mt-2"><RefreshCw size={14}/> Retry</button></div> : (
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-700"><tr><th className="px-6 py-4">User</th><th className="px-6 py-4">Role & Dept</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
                    <tbody className="divide-y">
                        {filteredProfiles.map(u => (
                            <tr key={u.id} className={`${u.isActive ? 'hover:bg-gray-50' : 'bg-gray-50/50 opacity-60'}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${u.isActive ? 'bg-slate-200 text-slate-600' : 'bg-gray-200 text-gray-400'}`}>{u.avatarUrl||u.fullName.substring(0,2).toUpperCase()}</div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${u.isActive ? 'text-gray-900' : 'text-gray-500'}`}>{u.fullName}</span>
                                                {!u.isActive && <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-semibold">Inactive</span>}
                                            </div>
                                            <div className="text-sm text-gray-500">{u.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4"><div className={`text-sm font-medium ${u.isActive ? 'text-gray-900' : 'text-gray-500'}`}>{u.role}</div><div className="text-xs text-gray-500">{u.department||'No Dept'}</div></td>
                                <td className="px-6 py-4 text-center">{u.isActive ? <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Active</span> : <span className="bg-red-100 text-red-500 text-xs px-2 py-1 rounded-full">Deactivated</span>}</td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={()=>handleEditUser(u)} className="text-blue-600 hover:bg-blue-50 p-2 rounded" title="Edit user"><Edit size={16}/></button>
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
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                    <div className="p-6 border-b flex justify-between items-center"><h3 className="font-bold text-xl text-gray-800">{currentUser.id?'Edit User':'Create User'}</h3><button onClick={()=>setShowUserModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button></div>
                    <div className="p-6 space-y-4">
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">Full Name *</label><input className="w-full p-2.5 border rounded-lg" value={currentUser.fullName||''} onChange={e=>setCurrentUser({...currentUser,fullName:e.target.value})}/></div>
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">Email *</label><input type="email" className="w-full p-2.5 border rounded-lg" value={currentUser.email||''} onChange={e=>setCurrentUser({...currentUser,email:e.target.value})} disabled={!!currentUser.id}/></div>
                        {!currentUser.id && <div><label className="block text-sm font-bold text-gray-700 mb-1">Password *</label><input type="password" className="w-full p-2.5 border rounded-lg" value={newUserPassword} onChange={e=>setNewUserPassword(e.target.value)}/></div>}
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Role</label><select className="w-full p-2.5 border rounded-lg bg-white" value={currentUser.roleId||''} onChange={e=>setCurrentUser({...currentUser,roleId:e.target.value})}><option value="">Select</option>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Department</label><select className="w-full p-2.5 border rounded-lg bg-white" value={currentUser.departmentId||''} onChange={e=>setCurrentUser({...currentUser,departmentId:e.target.value})}><option value="">Select</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                        </div>
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">Phone</label><input type="tel" className="w-full p-2.5 border rounded-lg" value={currentUser.phone||''} onChange={e=>setCurrentUser({...currentUser,phone:e.target.value})}/></div>
                    </div>
                    <div className="p-6 border-t bg-gray-50 rounded-b-xl">
                        <div className="flex justify-end gap-3">
                            <button onClick={()=>setShowUserModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Cancel</button>
                            <button onClick={handleSaveUser} disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-70">{actionLoading?<Loader2 className="animate-spin" size={16}/>:<Save size={16}/>}Save</button>
                        </div>
                        {currentUser.id && (
                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-3">Account Actions</p>
                                {currentUser.isActive !== false ? (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleResetPassword(currentUser as Profile)}
                                            disabled={actionLoading}
                                            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                                        >
                                            <Mail size={14}/> Reset Password
                                        </button>
                                        {isSuperAdmin && currentUser.id !== user?.id && (
                                            <button
                                                onClick={() => { setShowUserModal(false); setDeactivateConfirm({ show: true, user: currentUser as Profile }); }}
                                                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-300 rounded-lg hover:bg-red-50 text-red-600"
                                            >
                                                <UserX size={14}/> Deactivate User
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">
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
    <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Database Browser</h2>
            <div className="flex bg-white rounded-lg p-1 border shadow-sm">{(['policies','slips','clauses'] as const).map(type=><button key={type} onClick={()=>setDbViewType(type)} className={`px-4 py-2 text-sm font-bold capitalize rounded-md transition-colors ${dbViewType===type?'bg-blue-100 text-blue-700':'text-gray-500 hover:text-gray-700'}`}>{type}</button>)}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="max-h-[600px] overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-700 font-semibold sticky top-0"><tr><th className="px-6 py-3 border-b">ID</th><th className="px-6 py-3 border-b">Reference</th><th className="px-6 py-3 border-b">Status</th><th className="px-6 py-3 border-b text-right">Raw</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                        {dbViewType==='policies' && rawPolicies.map(p=><tr key={p.id} className="hover:bg-gray-50"><td className="px-6 py-3 font-mono text-xs text-gray-500">{p.id.substring(0,8)}...</td><td className="px-6 py-3 font-medium">{p.policyNumber}</td><td className="px-6 py-3">{p.status} | {p.insuredName}</td><td className="px-6 py-3 text-right"><button onClick={()=>console.log(p)} className="text-blue-600 hover:underline text-xs">Log</button></td></tr>)}
                        {dbViewType==='slips' && rawSlips.map(s=><tr key={s.id} className="hover:bg-gray-50"><td className="px-6 py-3 font-mono text-xs text-gray-500">{s.id.substring(0,8)}...</td><td className="px-6 py-3 font-medium">{s.slipNumber}</td><td className="px-6 py-3">{s.status||'Active'} | {s.insuredName}</td><td className="px-6 py-3 text-right"><button onClick={()=>console.log(s)} className="text-blue-600 hover:underline text-xs">Log</button></td></tr>)}
                        {dbViewType==='clauses' && rawClauses.map(c=><tr key={c.id} className="hover:bg-gray-50"><td className="px-6 py-3 font-mono text-xs text-gray-500">{c.id.substring(0,8)}...</td><td className="px-6 py-3 font-medium">{c.title}</td><td className="px-6 py-3">{c.category}</td><td className="px-6 py-3 text-right"><button onClick={()=>console.log(c)} className="text-blue-600 hover:underline text-xs">Log</button></td></tr>)}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );

  const renderRecycleBin = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center">
            <div><h2 className="text-2xl font-bold text-gray-800">Recycle Bin</h2><p className="text-gray-500 text-sm">Recover or purge deleted items.</p></div>
            <div className="flex bg-white rounded-lg p-1 border shadow-sm">{(['policies','slips','clauses'] as const).map(type=><button key={type} onClick={()=>setRecycleType(type)} className={`px-4 py-2 text-sm font-bold capitalize rounded-md transition-colors ${recycleType===type?'bg-red-100 text-red-700':'text-gray-500 hover:text-gray-700'}`}>{type}</button>)}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-700"><tr><th className="px-6 py-4">Item</th><th className="px-6 py-4 text-center">Actions</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                    {recycleType==='policies' && deletedPolicies.map(p=><tr key={p.id} className="hover:bg-gray-50"><td className="px-6 py-4"><div className="font-bold text-gray-900">{p.policyNumber}</div><div className="text-sm text-gray-500">{p.insuredName}</div></td><td className="px-6 py-4 text-center flex justify-center gap-3"><button onClick={e=>handleRestore(e,p.id)} className="text-green-600 hover:bg-green-50 px-3 py-1 rounded font-bold text-sm flex items-center gap-1"><RefreshCw size={14}/>Restore</button><button onClick={e=>handleHardDelete(e,p.id)} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded font-bold text-sm flex items-center gap-1"><Trash2 size={14}/>Purge</button></td></tr>)}
                    {recycleType==='slips' && deletedSlips.map(s=><tr key={s.id} className="hover:bg-gray-50"><td className="px-6 py-4"><div className="font-bold text-gray-900">{s.slipNumber}</div><div className="text-sm text-gray-500">{s.insuredName}</div></td><td className="px-6 py-4 text-center flex justify-center gap-3"><button onClick={e=>handleRestore(e,s.id)} className="text-green-600 hover:bg-green-50 px-3 py-1 rounded font-bold text-sm flex items-center gap-1"><RefreshCw size={14}/>Restore</button><button onClick={e=>handleHardDelete(e,s.id)} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded font-bold text-sm flex items-center gap-1"><Trash2 size={14}/>Purge</button></td></tr>)}
                    {recycleType==='clauses' && deletedClauses.map(c=><tr key={c.id} className="hover:bg-gray-50"><td className="px-6 py-4"><div className="font-bold text-gray-900">{c.title}</div><div className="text-sm text-gray-500">{c.category}</div></td><td className="px-6 py-4 text-center flex justify-center gap-3"><button onClick={e=>handleRestore(e,c.id)} className="text-green-600 hover:bg-green-50 px-3 py-1 rounded font-bold text-sm flex items-center gap-1"><RefreshCw size={14}/>Restore</button><button onClick={e=>handleHardDelete(e,c.id)} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded font-bold text-sm flex items-center gap-1"><Trash2 size={14}/>Purge</button></td></tr>)}
                    {((recycleType==='policies'&&deletedPolicies.length===0)||(recycleType==='slips'&&deletedSlips.length===0)||(recycleType==='clauses'&&deletedClauses.length===0)) && <tr><td colSpan={2} className="px-6 py-8 text-center text-gray-400 italic">No deleted items.</td></tr>}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderTemplates = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Policy Templates</h2>
            <button onClick={()=>handleEditTemplate()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2"><Plus size={18}/>New</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.map(t=><div key={t.id} className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md"><div className="flex justify-between items-start mb-3"><h3 className="font-bold text-gray-800">{t.name}</h3><div className="flex gap-2"><button onClick={()=>handleEditTemplate(t)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Edit size={16}/></button><button onClick={()=>handleDeleteTemplate(t.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button></div></div><p className="text-sm text-gray-600 mb-2">{t.description||'No description.'}</p><div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-500 truncate">{t.id}</div></div>)}
        </div>
        {isEditingTemplate && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold text-gray-800">Edit Template</h3><button onClick={()=>setIsEditingTemplate(false)}><X size={20}/></button></div>
                    <div className="p-6 flex-1 overflow-y-auto space-y-4">
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">Name</label><input className="w-full p-2 border rounded" value={currentTemplate.name} onChange={e=>setCurrentTemplate({...currentTemplate,name:e.target.value})}/></div>
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">Description</label><input className="w-full p-2 border rounded" value={currentTemplate.description} onChange={e=>setCurrentTemplate({...currentTemplate,description:e.target.value})}/></div>
                        <div className="flex-1 flex flex-col"><label className="block text-sm font-bold text-gray-700 mb-1">HTML Content</label><textarea className="w-full flex-1 p-2 border rounded font-mono text-xs min-h-[300px]" value={currentTemplate.content} onChange={e=>setCurrentTemplate({...currentTemplate,content:e.target.value})}/></div>
                    </div>
                    <div className="p-4 border-t flex justify-end gap-2"><button onClick={()=>setIsEditingTemplate(false)} className="px-4 py-2 text-gray-600 font-medium">Cancel</button><button onClick={handleSaveTemplate} className="px-4 py-2 bg-blue-600 text-white font-bold rounded">Save</button></div>
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
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Globe className="text-blue-600" size={28} />
            Exchange Rates
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Official rates from the Central Bank of Uzbekistan (CBU)
          </p>
        </div>

        {/* Exchange Rates Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Globe size={24} />
              <div>
                <h3 className="font-bold">CBU Exchange Rates</h3>
                <p className="text-blue-100 text-sm">
                  {cbuLastUpdated
                    ? `Last synced: ${cbuLastUpdated.toLocaleTimeString()}`
                    : 'Click on date to load rates'}
                </p>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => {
                  setPopupDate(cbuSelectedDate);
                  setShowDatePopup(true);
                }}
                className="text-white text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-2"
              >
                <span>Rate Date: {cbuRates.length > 0 && cbuRates[0]?.date ? formatDate(cbuRates[0].date) : formatDate(toISODateString(cbuSelectedDate) || '')}</span>
                <Edit size={14} />
              </button>

              {/* Date Selection Popup */}
              {showDatePopup && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDatePopup(false)}
                  />
                  {/* Popup */}
                  <div
                    className="fixed bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 min-w-[280px]"
                    style={{ top: '140px', right: '40px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800">Select Date</h4>
                      <button
                        onClick={() => setShowDatePopup(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <DatePickerInput
                        value={popupDate}
                        onChange={setPopupDate}
                        maxDate={new Date()}
                        className="!py-2"
                      />
                      <button
                        onClick={() => refreshCBURates(popupDate)}
                        disabled={cbuLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={18} className={cbuLoading ? 'animate-spin' : ''} />
                        {cbuLoading ? 'Syncing...' : 'Refresh Rates'}
                      </button>
                      <p className="text-xs text-gray-500 text-center">
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
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-amber-700">
              <AlertTriangle size={18} />
              <span>{cbuError}</span>
            </div>
          )}

          {/* Error State (no rates available) */}
          {cbuError && !cbuUsingCachedRates && (
            <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-2 text-red-700">
              <AlertTriangle size={18} />
              <span>{cbuError}</span>
              <button
                onClick={loadCBURates}
                className="ml-auto text-sm px-3 py-1 bg-red-100 hover:bg-red-200 rounded transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {cbuLoading && (
            <div className="p-12 text-center">
              <RefreshCw className="animate-spin text-blue-600 mx-auto mb-3" size={32} />
              <p className="text-gray-500">Loading exchange rates from CBU...</p>
            </div>
          )}

          {/* Rates Table */}
          {!cbuLoading && cbuRates.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-gray-600 text-sm">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Currency</th>
                    <th className="text-center px-4 py-3 font-semibold">Code</th>
                    <th className="text-right px-4 py-3 font-semibold">Nominal</th>
                    <th className="text-right px-4 py-3 font-semibold">Rate (UZS)</th>
                    <th className="text-right px-4 py-3 font-semibold">Change</th>
                    <th className="text-right px-4 py-3 font-semibold">Per 1 Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cbuRates.map((rate, idx) => (
                    <tr
                      key={rate.code}
                      className={`hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getCurrencyFlag(rate.code)}</span>
                          <span className="font-medium text-gray-900">{rate.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 font-mono font-bold text-sm">
                          {rate.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {rate.nominal}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900 text-lg">
                          {rate.rawRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                          rate.diff > 0
                            ? 'bg-green-100 text-green-700'
                            : rate.diff < 0
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
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
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-gray-700">
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
            <div className="p-12 text-center">
              <Globe className="text-gray-300 mx-auto mb-3" size={48} />
              <p className="text-gray-500">No exchange rates available for this date</p>
              <button
                onClick={loadCBURates}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Try loading rates
              </button>
            </div>
          )}

          {/* Footer with source info */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-2">
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Inward Reinsurance Presets</h2>
          <p className="text-sm text-gray-500 mt-1">Manage dropdown options for Type of Cover, Class of Cover, and Industry</p>
        </div>
        <button onClick={fetchPresets} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Refresh">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setPresetCategory('TYPE_OF_COVER')}
          className={`px-4 py-2 font-medium transition-colors ${
            presetCategory === 'TYPE_OF_COVER'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Type of Cover
        </button>
        <button
          onClick={() => setPresetCategory('CLASS_OF_COVER')}
          className={`px-4 py-2 font-medium transition-colors ${
            presetCategory === 'CLASS_OF_COVER'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Class of Cover
        </button>
        <button
          onClick={() => setPresetCategory('INDUSTRY')}
          className={`px-4 py-2 font-medium transition-colors ${
            presetCategory === 'INDUSTRY'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Industry
        </button>
      </div>

      {/* Add New Preset */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-bold text-gray-700 mb-4">Add New {presetCategory.replace(/_/g, ' ').toLowerCase()}</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Value *</label>
            <input
              type="text"
              placeholder="e.g., Property, Casualty, Marine..."
              className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={newPresetValue}
              onChange={(e) => setNewPresetValue(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
            <input
              type="text"
              placeholder="Optional description..."
              className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={newPresetDescription}
              onChange={(e) => setNewPresetDescription(e.target.value)}
            />
          </div>
          <button
            onClick={handleAddPreset}
            className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2"
          >
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>

      {/* Presets List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {presetsLoading ? (
          <div className="p-8 text-center text-gray-500">
            <Loader2 className="animate-spin inline mr-2" size={20} />
            Loading presets...
          </div>
        ) : presets.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <List size={40} className="mx-auto mb-2 opacity-50" />
            <p>No presets found for this category</p>
            <p className="text-sm mt-1">Add your first preset above</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-6 py-3 text-xs font-bold uppercase">Value</th>
                <th className="px-6 py-3 text-xs font-bold uppercase">Description</th>
                <th className="px-6 py-3 text-xs font-bold uppercase text-center">Status</th>
                <th className="px-6 py-3 text-xs font-bold uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {presets.map((preset) => (
                <tr key={preset.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    {editingPreset?.id === preset.id ? (
                      <input
                        type="text"
                        className="w-full p-1.5 border rounded"
                        value={editingPreset.value}
                        onChange={(e) => setEditingPreset({ ...editingPreset, value: e.target.value })}
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{preset.value}</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {editingPreset?.id === preset.id ? (
                      <input
                        type="text"
                        className="w-full p-1.5 border rounded"
                        value={editingPreset.description || ''}
                        onChange={(e) => setEditingPreset({ ...editingPreset, description: e.target.value })}
                      />
                    ) : (
                      <span className="text-gray-500">{preset.description || '-'}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {editingPreset?.id === preset.id ? (
                      <select
                        className="p-1.5 border rounded"
                        value={editingPreset.isActive ? 'true' : 'false'}
                        onChange={(e) => setEditingPreset({ ...editingPreset, isActive: e.target.value === 'true' })}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        preset.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {preset.isActive ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {editingPreset?.id === preset.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleUpdatePreset}
                          className="text-green-600 hover:bg-green-50 p-1.5 rounded"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => setEditingPreset(null)}
                          className="text-gray-500 hover:bg-gray-100 p-1.5 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingPreset(preset)}
                          className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id, preset.value)}
                          className="text-red-600 hover:bg-red-50 p-1.5 rounded"
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
      </div>

      {/* Session Timeout Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Timer size={22} className="text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">Session Timeout</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Auto-logout after inactivity. This setting applies globally to all users. Users will see a warning 2 minutes before being logged out.
        </p>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Timeout duration:</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {TIMEOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSessionTimeoutMinutes(opt.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-r last:border-r-0 border-gray-300 ${
                  sessionTimeoutMinutes === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSaveSessionTimeout}
            disabled={sessionTimeoutSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {sessionTimeoutSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
          <span className="text-xs text-gray-400">
            Current: {TIMEOUT_OPTIONS.find(o => o.value === sessionTimeoutMinutes)?.label || `${sessionTimeoutMinutes} min`}
          </span>
        </div>
      </div>

      {/* Operating Expenses Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign size={22} className="text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">Operating Expenses (Annual)</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Enter total annual operating expenses (salaries, rent, IT, etc.)
        </p>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Amount (USD):</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={annualOperatingExpenses}
              onChange={(e) => setAnnualOperatingExpenses(e.target.value)}
              placeholder="0"
              className="pl-7 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-56 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          This is used to calculate the Expense Ratio in Analytics. Expense Ratio = Operating Expenses / Net Premium Earned
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSaveOperatingExpenses}
            disabled={operatingExpensesSaving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {operatingExpensesSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
          {annualOperatingExpenses && Number(annualOperatingExpenses) > 0 && (
            <span className="text-xs text-gray-400">
              Current: ${Number(annualOperatingExpenses).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className={`bg-slate-900 text-white w-64 flex-shrink-0 flex flex-col transition-all duration-300 ${isSidebarOpen?'':'-ml-64'}`}>
        <div className="p-6 border-b border-slate-800"><h1 className="font-bold text-xl flex items-center gap-2"><Lock className="text-red-500"/>Admin Console</h1></div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={()=>setActiveSection('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='dashboard'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><Activity size={20}/>Dashboard</button>
          <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-500 uppercase">Access Control</div>
          <button onClick={()=>setActiveSection('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='users'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><Users size={20}/>Users</button>
          <button onClick={()=>setActiveSection('roles')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='roles'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><ShieldCheck size={20}/>Roles & Permissions</button>
          <button onClick={()=>setActiveSection('departments')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='departments'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><Building2 size={20}/>Departments</button>
          <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-500 uppercase">System</div>
          <button onClick={()=>setActiveSection('database')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='database'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><Table size={20}/>Database Browser</button>
          <button onClick={()=>setActiveSection('recycle')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='recycle'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><Trash2 size={20}/>Recycle Bin</button>
          <button onClick={()=>setActiveSection('activity-log')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='activity-log'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><ScrollText size={20}/>Activity Log</button>
          <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-500 uppercase">Configuration</div>
          <button onClick={()=>setActiveSection('templates')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='templates'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><FileText size={20}/>Policy Templates</button>
          <button onClick={()=>setActiveSection('fx')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='fx'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><Coins size={20}/>Exchange Rates</button>
          <button onClick={()=>setActiveSection('presets')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='presets'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><List size={20}/>Reinsurance Presets</button>
          <button onClick={()=>setActiveSection('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection==='settings'?'bg-blue-600 text-white':'text-slate-400 hover:bg-slate-800'}`}><Timer size={20}/>Settings</button>
          <div className="pt-8 mt-auto"><button onClick={()=>navigate('/')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"><LogOut size={20}/>Exit Console</button></div>
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto h-screen">
        {loading ? <div className="flex items-center justify-center h-full text-gray-500"><Loader2 className="animate-spin mr-2" size={24}/>Loading...</div> : <>
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
