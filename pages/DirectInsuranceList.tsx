import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../services/db';
import { Policy, PolicyStatus } from '../types';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormModal } from '../components/FormModal';
import { DirectInsuranceFormContent } from '../components/DirectInsuranceFormContent';
import { NewRequestForm } from '../components/NewRequestForm';
import { formatDate } from '../utils/dateUtils';
import { toISODateString } from '../components/DatePickerInput';
import { CompactDateFilter } from '../components/CompactDateFilter';
import {
  Plus, Search, FileText, Trash2, Edit, Eye,
  Building2, RefreshCw, Globe, MapPin, Download, MoreVertical
} from 'lucide-react';
import { exportToExcel } from '../services/excelExport';
import { usePageHeader } from '../context/PageHeaderContext';
import { useTheme } from '../theme/useTheme';

const DirectInsuranceList: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const { t } = useTheme();

  // Infinite scroll state
  const PAGE_SIZE = 20;
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Search with debounce
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sticky offset measurement
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(66);
  useEffect(() => {
    const el = filterRef.current;
    if (!el) return;
    const update = () => setFilterHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');

  // Date filter state
  const [dateFilterField, setDateFilterField] = useState<string>('inceptionDate');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // Stats (lightweight count queries)
  const [stats, setStats] = useState({ total: 0, uzbekistan: 0, foreign: 0, active: 0, draft: 0 });

  // Kebab menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; number: string }>({
    show: false, id: '', number: ''
  });

  // Load stats (filter-aware count queries)
  const loadStats = useCallback(async () => {
    try {
      const s = await DB.getDirectPoliciesStats({
        countryFilter,
        statusFilter,
        searchTerm,
        dateField: (dateFrom || dateTo) ? dateFilterField : undefined,
        dateFrom: dateFrom ? toISODateString(dateFrom) || undefined : undefined,
        dateTo: dateTo ? toISODateString(dateTo) || undefined : undefined,
      });
      setStats(s);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [countryFilter, statusFilter, searchTerm, dateFilterField, dateFrom, dateTo]);

  // Fetch paginated data from view
  const fetchData = useCallback(async () => {
    const isFirstPage = currentPage === 1;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);
    try {
      const result = await DB.getDirectPoliciesPage({
        page: currentPage - 1,
        pageSize: PAGE_SIZE,
        countryFilter,
        statusFilter,
        searchTerm,
        dateField: (dateFrom || dateTo) ? dateFilterField : undefined,
        dateFrom: toISODateString(dateFrom) || undefined,
        dateTo: toISODateString(dateTo) || undefined,
      });
      setHasMore(result.rows.length >= PAGE_SIZE);
      if (isFirstPage) {
        setPolicies(result.rows);
        setTotalCount(result.totalCount);
      } else {
        setPolicies(prev => [...prev, ...result.rows]);
      }
    } catch (error) {
      console.error('Failed to load policies:', error);
      toast.error('Failed to load policies');
    } finally {
      if (isFirstPage) setLoading(false);
      else setLoadingMore(false);
    }
  }, [currentPage, countryFilter, statusFilter, searchTerm, dateFilterField, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load stats on mount and after mutations
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setCurrentPage(prev => prev + 1);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchTerm(value);
      setPolicies([]);
      setCurrentPage(1);
    }, 300);
  };

  // Filter changes reset to page 1
  const handleCountryFilterChange = (value: string) => {
    setCountryFilter(value);
    setPolicies([]);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPolicies([]);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (field: string, from: Date | null, to: Date | null) => {
    setDateFilterField(field);
    setDateFrom(from);
    setDateTo(to);
    setPolicies([]);
    setCurrentPage(1);
  };

  // Handlers
  const handleNewPolicy = () => {
    setEditingPolicyId(undefined);
    setShowFormModal(true);
  };

  const handleEditPolicy = (id: string) => {
    setEditingPolicyId(id);
    setShowFormModal(true);
  };

  const handleViewPolicy = (id: string) => {
    setEditingPolicyId(id);
    setShowFormModal(true);
  };

  const handleDeletePolicy = async () => {
    if (!deleteConfirm.id) return;
    try {
      await DB.deletePolicy(deleteConfirm.id);
      toast.success(`Policy ${deleteConfirm.number} deleted`);
      fetchData();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete policy');
    } finally {
      setDeleteConfirm({ show: false, id: '', number: '' });
    }
  };

  const handleFormSave = () => {
    setShowFormModal(false);
    setEditingPolicyId(undefined);
    fetchData();
    loadStats();
    toast.success(editingPolicyId ? 'Policy updated' : 'Policy created');
  };

  const handleFormCancel = () => {
    setShowFormModal(false);
    setEditingPolicyId(undefined);
  };

  const getStatusBadge = (status: PolicyStatus | string) => {
    const colorMap: Record<string, { color: string; bg: string }> = {
      'Draft': { color: t.text4, bg: t.bgInput },
      'Active': { color: t.success, bg: t.successBg },
      'Expired': { color: t.warning, bg: t.warningBg },
      'Cancelled': { color: t.danger, bg: t.dangerBg },
      'Pending Confirmation': { color: t.accent, bg: t.accentMuted },
    };
    const c = colorMap[status] || { color: t.text4, bg: t.bgInput };
    return (
      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, color: c.color, background: c.bg }}>
        {status}
      </span>
    );
  };

  const handleExport = () => {
    if (policies.length === 0) return;
    const exportData = policies.map((p: any) => ({
      'Policy #': p.policy_number,
      'Insured': p.insured_name,
      'Country': p.territory || '',
      'Class': p.class_of_business || '',
      'Inception': p.inception_date || '',
      'Expiry': p.expiry_date || '',
      'GWP': p.gross_premium || 0,
      'Status': p.status,
    }));
    exportToExcel(exportData, `Direct_Insurance_${new Date().toISOString().split('T')[0]}`, 'Direct Insurance');
  };

  // Stats badges in header left, Export button in header right
  useEffect(() => {
    const badgeStyle = (color: string, bg: string): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 6, background: bg, border: `1px solid ${color}33`, borderRadius: 8, padding: '4px 12px' });
    setHeaderLeft(
      <>
        <div style={badgeStyle(t.text4, t.bgInput)}>
          <span style={{ fontSize: 11, color: t.text4, fontWeight: 500 }}>Total</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text1 }}>{stats.total}</span>
        </div>
        <div style={badgeStyle(t.accent, t.accentMuted)}>
          <span style={{ fontSize: 11, color: t.accent, fontWeight: 500 }}>UZB</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{stats.uzbekistan}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 8, padding: '4px 12px' }}>
          <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 500 }}>Foreign</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>{stats.foreign}</span>
        </div>
        <div style={badgeStyle(t.success, t.successBg)}>
          <span style={{ fontSize: 11, color: t.success, fontWeight: 500 }}>Active</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.success }}>{stats.active}</span>
        </div>
        <div style={badgeStyle(t.text5, t.bgInput)}>
          <span style={{ fontSize: 11, color: t.text5, fontWeight: 500 }}>Draft</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text4 }}>{stats.draft}</span>
        </div>
      </>
    );
    setHeaderActions(
      <button
        onClick={() => handleExport()}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: t.success, color: '#fff', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
      >
        <Download size={16} /> Export
      </button>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [policies, stats, setHeaderActions, setHeaderLeft]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div>
      {/* Sticky filter bar */}
      <div ref={filterRef} className="sticky top-0 z-30" style={{ background: t.bgApp }}>
      <div style={{ background: t.bgPanel, borderRadius: 10, boxShadow: t.shadow, border: `1px solid ${t.border}`, padding: 12 }}>
        <div className="flex flex-wrap items-center gap-3 min-h-[48px] overflow-visible">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: `1px solid ${t.border}`, borderRadius: 8, background: t.bgInput, color: t.text1, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = t.accent}
              onBlur={e => e.target.style.borderColor = t.border}
            />
          </div>

          {/* Country Filter */}
          <select
            value={countryFilter}
            onChange={(e) => handleCountryFilterChange(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${t.border}`, borderRadius: 8, background: t.bgInput, color: t.text1, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
          >
            <option value="all">All Countries</option>
            <option value="uzbekistan">Uzbekistan</option>
            <option value="foreign">Foreign</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${t.border}`, borderRadius: 8, background: t.bgInput, color: t.text1, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
          >
            <option value="all">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: '380px' }}>
          <select
            value={dateFilterField}
            onChange={(e) => handleDateFilterChange(e.target.value, dateFrom, dateTo)}
            style={{ padding: '8px 12px', border: `1px solid ${t.border}`, borderRadius: 8, background: t.bgInput, color: t.text1, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
          >
            <option value="inceptionDate">Inception</option>
            <option value="expiryDate">Expiry</option>
            <option value="dateOfSlip">Date of Slip</option>
            <option value="accountingDate">Accounting</option>
            <option value="premiumPaymentDate">Prem. Payment</option>
            <option value="actualPaymentDate">Actual Payment</option>
          </select>
          <CompactDateFilter
            value={dateFrom}
            onChange={(d) => handleDateFilterChange(dateFilterField, d, dateTo)}
            placeholder="From"
          />
          <CompactDateFilter
            value={dateTo}
            onChange={(d) => handleDateFilterChange(dateFilterField, dateFrom, d)}
            placeholder="To"
          />
          </div>

          {/* Refresh */}
          <button
            onClick={() => { fetchData(); loadStats(); }}
            style={{ padding: 8, borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: t.text4 }}
            title="Refresh"
            onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={{ color: loading ? t.accent : t.text4 }} />
          </button>

          <div style={{ width: 1, height: 20, background: t.border }} />

          {/* New Policy Button */}
          <button
            onClick={handleNewPolicy}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: t.accent, color: '#fff', borderRadius: 8, fontWeight: 500, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Plus size={16} />
            New Request
          </button>
        </div>
      </div>
      </div>{/* end sticky filter bar */}

      {/* Policies Table */}
      <div style={{ background: t.bgPanel, borderRadius: 10, border: `1px solid ${t.border}`, boxShadow: t.shadow, marginTop: 4 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
            <RefreshCw className="animate-spin" size={32} style={{ color: t.accent }} />
          </div>
        ) : policies.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 256, color: t.text4 }}>
            <FileText size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
            <p style={{ fontSize: 16, fontWeight: 500 }}>No policies found</p>
            <p style={{ fontSize: 13 }}>Create your first direct insurance policy</p>
            <button
              onClick={handleNewPolicy}
              style={{ marginTop: 16, padding: '8px 16px', background: t.accent, color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
            >
              <Plus size={16} style={{ display: 'inline', marginRight: 8 }} />
              New Request
            </button>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="sticky z-20" style={{ top: `${filterHeight}px` }}>
                <tr>
                  {['Policy #', 'Insured', 'Country', 'Class', 'Period'].map(label => (
                    <th key={label} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: t.text4, background: t.bgPanel, borderBottom: `1px solid ${t.border}` }}>{label}</th>
                  ))}
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: t.text4, background: t.bgPanel, borderBottom: `1px solid ${t.border}` }}>GWP</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: t.text4, background: t.bgPanel, borderBottom: `1px solid ${t.border}` }}>Status</th>
                  <th className="px-1 py-3 w-10" style={{ background: t.bgPanel, borderBottom: `1px solid ${t.border}` }}></th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy: any) => (
                  <tr
                    key={policy.id}
                    onClick={() => handleViewPolicy(policy.id)}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: `1px solid ${t.borderS}` }}
                    onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="px-4 py-3">
                      <span style={{ fontWeight: 500, color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{policy.policy_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} style={{ color: t.text4 }} />
                        <span style={{ color: t.text1 }}>{policy.insured_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: policy.territory === 'Uzbekistan' ? t.accent : '#a78bfa' }}>
                        {policy.territory === 'Uzbekistan' ? <MapPin size={14} /> : <Globe size={14} />}
                        {policy.territory || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: t.text3, fontSize: 13 }}>{policy.class_of_business}</td>
                    <td className="px-4 py-3" style={{ color: t.text3, fontSize: 13 }}>
                      {formatDate(policy.inception_date)} - {formatDate(policy.expiry_date)}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ fontWeight: 500, color: t.text1, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(policy.gross_premium || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(policy.status)}
                    </td>
                    <td className="px-1 py-2 text-center w-10 relative" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === policy.id ? null : policy.id); }}
                        style={{ padding: 6, borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <MoreVertical size={16} style={{ color: t.text4 }} />
                      </button>
                      {openMenuId === policy.id && (
                        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: t.bgPanel, borderRadius: 10, boxShadow: t.shadowLg, border: `1px solid ${t.borderL}`, padding: 4, zIndex: 50, minWidth: 120 }}>
                          <button onClick={() => { setOpenMenuId(null); handleViewPolicy(policy.id); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm" style={{ color: t.text2, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Eye size={14} /> View
                          </button>
                          <button onClick={() => { setOpenMenuId(null); handleEditPolicy(policy.id); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm" style={{ color: t.text2, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Edit size={14} /> Edit
                          </button>
                          <button onClick={() => { setOpenMenuId(null); setDeleteConfirm({ show: true, id: policy.id, number: policy.policy_number }); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm" style={{ color: t.danger, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                <RefreshCw size={20} className="animate-spin" style={{ color: t.accent }} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Form Modal */}
      <FormModal
        isOpen={showFormModal}
        onClose={handleFormCancel}
        title={editingPolicyId ? 'Edit Policy' : 'New Request'}
        subtitle={editingPolicyId ? undefined : 'Direct Insurance'}
      >
        {editingPolicyId ? (
          <DirectInsuranceFormContent
            id={editingPolicyId}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        ) : (
          <NewRequestForm
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        )}
      </FormModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Delete Policy"
        message={`Are you sure you want to delete policy "${deleteConfirm.number}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeletePolicy}
        onCancel={() => setDeleteConfirm({ show: false, id: '', number: '' })}
        variant="danger"
      />
    </div>
  );
};

export default DirectInsuranceList;
