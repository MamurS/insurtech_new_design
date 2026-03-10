import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../services/db';
import { InwardReinsurance, Currency } from '../types';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/dateUtils';
import { toISODateString } from '../components/DatePickerInput';
import { CompactDateFilter } from '../components/CompactDateFilter';
import {
  Search, RefreshCw, Download,
  Globe, Home, TrendingUp, DollarSign,
  FileText, Building2, Calendar, Eye, Edit, MoreVertical,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { exportToExcel } from '../services/excelExport';
import { usePageHeader } from '../context/PageHeaderContext';
import { useTheme } from '../theme/useTheme';

const InwardReinsuranceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const { t } = useTheme();

  // Server-side pagination state
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(25);
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  // Search with debounce
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  // Date filter state
  const [dateFilterField, setDateFilterField] = useState<string>('inceptionDate');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // Stats (lightweight count queries)
  const [stats, setStats] = useState({ total: 0, foreign: 0, domestic: 0, active: 0 });

  // Unique classes for filter dropdown
  const [uniqueClasses, setUniqueClasses] = useState<string[]>([]);

  // Sticky offset measurement
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(62);
  useEffect(() => {
    const el = filterRef.current;
    if (!el) return;
    const update = () => setFilterHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Kebab menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);


  // Load stats (separate lightweight queries)
  const loadStats = useCallback(async () => {
    try {
      const s = await DB.getInwardReinsuranceStats({
        typeFilter,
        statusFilter,
        classFilter,
        searchTerm,
        dateField: (dateFrom || dateTo) ? dateFilterField : undefined,
        dateFrom: dateFrom ? toISODateString(dateFrom) || undefined : undefined,
        dateTo: dateTo ? toISODateString(dateTo) || undefined : undefined,
      });
      setStats(s);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [typeFilter, statusFilter, classFilter, searchTerm, dateFilterField, dateFrom, dateTo]);

  // Load unique classes for filter
  const loadClasses = useCallback(async () => {
    try {
      const classes = await DB.getInwardReinsuranceClasses();
      setUniqueClasses(classes);
    } catch (error) {
      console.error('Failed to load classes:', error);
    }
  }, []);

  // Fetch paginated data from view
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await DB.getInwardReinsurancePage({
        page: currentPage - 1, // API is 0-indexed
        pageSize: rowsPerPage,
        typeFilter,
        statusFilter,
        classFilter,
        searchTerm,
        dateField: (dateFrom || dateTo) ? dateFilterField : undefined,
        dateFrom: toISODateString(dateFrom) || undefined,
        dateTo: toISODateString(dateTo) || undefined,
      });
      setContracts(result.rows);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error('Failed to load contracts:', error);
      toast.error('Failed to load inward reinsurance contracts');
    } finally {
      setLoading(false);
    }
  }, [currentPage, rowsPerPage, typeFilter, statusFilter, classFilter, searchTerm, dateFilterField, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load stats and classes on mount
  useEffect(() => {
    loadStats();
    loadClasses();
  }, [loadStats, loadClasses]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchTerm(value);
      setCurrentPage(1);
    }, 300);
  };

  // Filter changes reset to page 1
  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleClassFilterChange = (value: string) => {
    setClassFilter(value);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (field: string, from: Date | null, to: Date | null) => {
    setDateFilterField(field);
    setDateFrom(from);
    setDateTo(to);
    setCurrentPage(1);
  };

  // Export to Excel
  const handleExport = () => {
    if (contracts.length === 0) {
      toast.error('No contracts to export');
      return;
    }

    setExporting(true);
    try {
      const exportData = contracts.map((c: any) => ({
        'Contract No.': c.contract_number,
        'Origin': c.source === 'inward-foreign' ? 'FOREIGN' : 'DOMESTIC',
        'Type': c.type,
        'Structure': c.structure,
        'Cedant': c.cedant_name,
        'Broker': c.broker_name || 'Direct',
        'Class': c.class_of_cover,
        'Inception': c.inception_date,
        'Expiry': c.expiry_date,
        'Currency': c.currency,
        'Limit': c.limit_of_liability || 0,
        'Gross Premium': c.gross_premium || 0,
        'Net Premium': c.net_premium || 0,
        'Our Share %': c.our_share || 0,
        'Status': c.status,
      }));
      exportToExcel(exportData, `Inward_Reinsurance_${new Date().toISOString().split('T')[0]}`, 'Inward Reinsurance');
      toast.success('Exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  // Stats badges in header left, Export button in header right
  useEffect(() => {
    setHeaderLeft(
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '4px 12px' }}>
          <span style={{ fontSize: 12, color: t.text4, fontWeight: 500 }}>Contracts</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text1 }}>{stats.total}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, padding: '4px 12px' }}>
          <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 500 }}>🌍 Foreign</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>{stats.foreign}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${t.accent}15`, border: `1px solid ${t.accent}33`, borderRadius: 8, padding: '4px 12px' }}>
          <span style={{ fontSize: 12, color: t.accent, fontWeight: 500 }}>🏠 Domestic</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{stats.domestic}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: t.successBg, border: `1px solid ${t.success}33`, borderRadius: 8, padding: '4px 12px' }}>
          <span style={{ fontSize: 12, color: t.success, fontWeight: 500 }}>Active</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.success }}>{stats.active}</span>
        </div>
      </>
    );
    setHeaderActions(
      <button
        onClick={() => handleExport()}
        disabled={exporting || contracts.length === 0}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: t.success, color: '#fff', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: exporting || contracts.length === 0 ? 'not-allowed' : 'pointer', opacity: exporting || contracts.length === 0 ? 0.5 : 1, boxShadow: t.shadow, whiteSpace: 'nowrap' }}
      >
        <Download size={16} /> Export
      </button>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [contracts, exporting, stats, setHeaderActions, setHeaderLeft, t]);

  const formatCurrency = (amount: number, short: boolean = false) => {
    if (short) {
      if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
      if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, { color: string; bg: string }> = {
      'DRAFT': { color: t.text3, bg: t.bgInput },
      'PENDING': { color: t.warning, bg: t.warningBg },
      'ACTIVE': { color: t.success, bg: t.successBg },
      'EXPIRED': { color: t.text4, bg: t.bgInput },
      'CANCELLED': { color: t.danger, bg: t.dangerBg },
    };
    const c = colorMap[status] || { color: t.text3, bg: t.bgInput };
    return (
      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, color: c.color, background: c.bg }}>
        {status}
      </span>
    );
  };

  const getTypeBadge = (source: string) => {
    if (source === 'inward-foreign') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
          <Globe size={12} /> Foreign
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: `${t.accent}15`, color: t.accent }}>
        <Home size={12} /> Domestic
      </span>
    );
  };

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: `1px solid ${t.borderL}`,
    borderRadius: 8,
    outline: 'none',
    fontSize: 13,
    background: t.bgPanel,
    color: t.text1,
  };

  return (
    <div>
      {/* Sticky filter bar */}
      <div ref={filterRef} className="sticky top-0 z-30 sticky-filter-blur" style={{ background: t.bgApp }}>
      <div className="rounded-xl p-3" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow, borderRadius: 12 }}>
      <div className="flex flex-wrap items-center gap-3 min-h-[48px] overflow-visible">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.text5 }} />
          <input
            type="text"
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg outline-none"
            style={{ border: `1px solid ${t.borderL}`, background: t.bgInput, color: t.text1, fontSize: 13 }}
          />
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => handleTypeFilterChange(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Types</option>
          <option value="foreign">Foreign</option>
          <option value="domestic">Domestic</option>
        </select>

        {/* Class Filter */}
        <select
          value={classFilter}
          onChange={(e) => handleClassFilterChange(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Classes</option>
          {uniqueClasses.map(cls => (
            <option key={cls} value={cls}>{cls.length > 30 ? cls.substring(0, 30) + '...' : cls}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: '380px' }}>
        <select
          value={dateFilterField}
          onChange={(e) => handleDateFilterChange(e.target.value, dateFrom, dateTo)}
          style={selectStyle}
        >
          <option value="inceptionDate">Inception</option>
          <option value="expiryDate">Expiry</option>
          <option value="dateOfSlip">Date of Slip</option>
          <option value="accountingDate">Accounting</option>
          <option value="reinsuranceInceptionDate">RI Inception</option>
          <option value="reinsuranceExpiryDate">RI Expiry</option>
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
          className="p-2 rounded-lg"
          style={{ color: t.text4 }}
          title="Refresh"
        >
          <RefreshCw size={16} style={loading ? { color: t.accent } : {}} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      </div>
      </div>{/* end sticky filter bar */}

      {/* Contracts Table */}
      <div className="rounded-xl" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow, borderRadius: 12 }}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="animate-spin" size={32} style={{ color: t.accent }} />
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64" style={{ color: t.text5 }}>
            <FileText size={48} className="mb-4" style={{ opacity: 0.5 }} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>No contracts found</p>
            <p className="text-sm">Try adjusting your filters or create new contracts</p>
          </div>
        ) : (
          <>
            <table className="w-full table-fixed">
              <thead className="sticky z-20" style={{ top: `${filterHeight}px`, background: t.bgApp, boxShadow: t.shadow }}>
                <tr>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: t.text4 }}>Contract #</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide w-24" style={{ color: t.text4 }}>Origin</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: t.text4 }}>Type</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide max-w-[200px]" style={{ color: t.text4 }}>Cedant</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide max-w-[120px]" style={{ color: t.text4 }}>Class</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: t.text4 }}>Period</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide w-20" style={{ color: t.text4 }}>Our Share</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: t.text4 }}>GWP</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wide w-20" style={{ color: t.text4 }}>Status</th>
                  <th className="px-1 py-3 w-10" style={{ background: t.bgApp }}></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract: any) => {
                  const origin = contract.source === 'inward-foreign' ? 'FOREIGN' : 'DOMESTIC';
                  return (
                    <tr
                      key={contract.id}
                      onClick={() => {
                        navigate(`/inward-reinsurance/${origin === 'FOREIGN' ? 'foreign' : 'domestic'}/view/${contract.id}`);
                      }}
                      className="transition-colors cursor-pointer"
                      style={{ borderBottom: `1px solid ${t.border}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td className="px-3 py-3">
                        <span style={{ fontWeight: 500, color: t.text1, fontFamily: 'JetBrains Mono, monospace' }}>{contract.contract_number}</span>
                      </td>
                      <td className="px-3 py-3 w-24">
                        {getTypeBadge(contract.source)}
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: t.text3 }}>
                        {contract.type} / {contract.structure}
                      </td>
                      <td className="px-3 py-3 max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="flex-shrink-0" style={{ color: t.text5 }} />
                          <div className="min-w-0">
                            <p className="font-medium truncate" style={{ color: t.text2 }}>{contract.cedant_name}</p>
                            {contract.broker_name && (
                              <p className="text-xs truncate" style={{ color: t.text5 }}>via {contract.broker_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm max-w-[120px] truncate" style={{ color: t.text3 }} title={contract.class_of_cover}>{contract.class_of_cover}</td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap" style={{ color: t.text3 }}>
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="flex-shrink-0" style={{ color: t.text5 }} />
                          {formatDate(contract.inception_date)} - {formatDate(contract.expiry_date)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium w-20" style={{ color: t.text2, fontVariantNumeric: 'tabular-nums' }}>
                        {contract.our_share || 100}%
                      </td>
                      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap" style={{ color: t.text1, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(contract.gross_premium || 0)}
                      </td>
                      <td className="px-3 py-3 text-center w-20">
                        {getStatusBadge(contract.status)}
                      </td>
                      <td className="px-1 py-2 text-center w-10 relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === contract.id ? null : contract.id); }}
                          className="p-1.5 rounded-lg"
                          style={{ background: 'transparent' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <MoreVertical size={16} style={{ color: t.text4 }} />
                        </button>
                        {openMenuId === contract.id && (
                          <div className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-[120px]" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadowLg }}>
                            <button onClick={() => { setOpenMenuId(null); navigate(`/inward-reinsurance/${origin === 'FOREIGN' ? 'foreign' : 'domestic'}/view/${contract.id}`); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm"
                              style={{ color: t.text2, background: 'transparent' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <Eye size={14} /> View
                            </button>
                            <button onClick={() => { setOpenMenuId(null); navigate(`/inward-reinsurance/${origin === 'FOREIGN' ? 'foreign' : 'domestic'}/edit/${contract.id}`); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm"
                              style={{ color: t.text2, background: 'transparent' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <Edit size={14} /> Edit
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="p-4 flex items-center justify-between" style={{ borderTop: `1px solid ${t.border}`, background: t.bgApp }}>
              <div className="text-sm" style={{ color: t.text4 }}>
                Showing <span className="font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * rowsPerPage, totalCount)}</span> of <span className="font-medium">{totalCount}</span> contracts
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow, color: t.text2 }}
                >
                  <ChevronLeft size={16}/>
                </button>
                <span className="flex items-center px-4 text-sm font-medium rounded-lg" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow, color: t.text1 }}>
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || totalPages === 0}
                  className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow, color: t.text2 }}
                >
                  <ChevronRight size={16}/>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default InwardReinsuranceDashboard;
