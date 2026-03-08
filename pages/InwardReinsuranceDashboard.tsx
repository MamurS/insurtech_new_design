import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DB } from '../services/db';
import { InwardReinsurance, Currency } from '../types';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/dateUtils';
import { toISODateString } from '../components/DatePickerInput';
import { CompactDateFilter } from '../components/CompactDateFilter';
import { FormModal } from '../components/FormModal';
import { InwardReinsuranceFormContent } from '../components/InwardReinsuranceFormContent';
import {
  Search, RefreshCw, Download,
  Globe, Home, TrendingUp, DollarSign,
  FileText, Building2, Calendar, Eye, Edit, MoreVertical,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { exportToExcel } from '../services/excelExport';
import { usePageHeader } from '../context/PageHeaderContext';

const InwardReinsuranceDashboard: React.FC = () => {
  const toast = useToast();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();

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

  // Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [editingOrigin, setEditingOrigin] = useState<'FOREIGN' | 'DOMESTIC'>('FOREIGN');

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
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-500 font-medium">Contracts</span>
          <span className="text-sm font-bold text-slate-800">{stats.total}</span>
        </div>
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-purple-600 font-medium">🌍 Foreign</span>
          <span className="text-sm font-bold text-purple-800">{stats.foreign}</span>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-blue-600 font-medium">🏠 Domestic</span>
          <span className="text-sm font-bold text-blue-800">{stats.domestic}</span>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-emerald-600 font-medium">Active</span>
          <span className="text-sm font-bold text-emerald-800">{stats.active}</span>
        </div>
      </>
    );
    setHeaderActions(
      <button
        onClick={() => handleExport()}
        disabled={exporting || contracts.length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 shadow-sm transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={16} /> Export
      </button>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [contracts, exporting, stats, setHeaderActions, setHeaderLeft]);

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
    const styles: Record<string, string> = {
      'DRAFT': 'bg-slate-100 text-slate-600',
      'PENDING': 'bg-amber-100 text-amber-700',
      'ACTIVE': 'bg-emerald-100 text-emerald-700',
      'EXPIRED': 'bg-slate-100 text-slate-500',
      'CANCELLED': 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
        {status}
      </span>
    );
  };

  const getTypeBadge = (source: string) => {
    if (source === 'inward-foreign') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
          <Globe size={12} /> Foreign
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <Home size={12} /> Domestic
      </span>
    );
  };

  return (
    <div>
      {/* Sticky filter bar */}
      <div ref={filterRef} className="sticky top-0 z-30 bg-gray-50 sticky-filter-blur">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-3 min-h-[48px] overflow-visible">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          />
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => handleTypeFilterChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
        >
          <option value="all">All Types</option>
          <option value="foreign">Foreign</option>
          <option value="domestic">Domestic</option>
        </select>

        {/* Class Filter */}
        <select
          value={classFilter}
          onChange={(e) => handleClassFilterChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
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
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
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
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
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
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
        </button>
      </div>
      </div>
      </div>{/* end sticky filter bar */}

      {/* Contracts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="animate-spin text-blue-600" size={32} />
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <FileText size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">No contracts found</p>
            <p className="text-sm">Try adjusting your filters or create new contracts</p>
          </div>
        ) : (
          <>
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 sticky z-20 shadow-sm" style={{ top: `${filterHeight}px` }}>
                <tr>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contract #</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Origin</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide max-w-[200px]">Cedant</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide max-w-[120px]">Class</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Period</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Our Share</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">GWP</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Status</th>
                  <th className="px-1 py-3 w-10 bg-gray-50"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((contract: any) => {
                  const origin = contract.source === 'inward-foreign' ? 'FOREIGN' : 'DOMESTIC';
                  return (
                    <tr
                      key={contract.id}
                      onClick={() => {
                        setEditingContractId(contract.id);
                        setEditingOrigin(origin as 'FOREIGN' | 'DOMESTIC');
                        setShowFormModal(true);
                      }}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-3">
                        <span className="font-medium text-slate-800">{contract.contract_number}</span>
                      </td>
                      <td className="px-3 py-3 w-24">
                        {getTypeBadge(contract.source)}
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-sm">
                        {contract.type} / {contract.structure}
                      </td>
                      <td className="px-3 py-3 max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-slate-700 font-medium truncate">{contract.cedant_name}</p>
                            {contract.broker_name && (
                              <p className="text-xs text-slate-400 truncate">via {contract.broker_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-sm max-w-[120px] truncate" title={contract.class_of_cover}>{contract.class_of_cover}</td>
                      <td className="px-3 py-3 text-slate-600 text-sm whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                          {formatDate(contract.inception_date)} - {formatDate(contract.expiry_date)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700 font-medium w-20">
                        {contract.our_share || 100}%
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {formatCurrency(contract.gross_premium || 0)}
                      </td>
                      <td className="px-3 py-3 text-center w-20">
                        {getStatusBadge(contract.status)}
                      </td>
                      <td className="px-1 py-2 text-center w-10 relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === contract.id ? null : contract.id); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg">
                          <MoreVertical size={16} className="text-gray-500" />
                        </button>
                        {openMenuId === contract.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[120px]">
                            <button onClick={() => { setOpenMenuId(null); setEditingContractId(contract.id); setEditingOrigin(origin as 'FOREIGN' | 'DOMESTIC'); setShowFormModal(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              <Eye size={14} /> View
                            </button>
                            <button onClick={() => { setOpenMenuId(null); setEditingContractId(contract.id); setEditingOrigin(origin as 'FOREIGN' | 'DOMESTIC'); setShowFormModal(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
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
            <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * rowsPerPage, totalCount)}</span> of <span className="font-medium">{totalCount}</span> contracts
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm"
                >
                  <ChevronLeft size={16}/>
                </button>
                <span className="flex items-center px-4 text-sm font-medium bg-white border rounded-lg shadow-sm">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || totalPages === 0}
                  className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm"
                >
                  <ChevronRight size={16}/>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Form Modal */}
      <FormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingContractId(null);
        }}
        title={editingContractId ? 'Edit Inward Reinsurance' : 'New Inward Reinsurance'}
        subtitle={editingOrigin === 'FOREIGN' ? 'Foreign Contract' : 'Domestic Contract'}
      >
        <InwardReinsuranceFormContent
          id={editingContractId || undefined}
          origin={editingOrigin}
          onSave={() => {
            setShowFormModal(false);
            setEditingContractId(null);
            fetchData();
            loadStats();
          }}
          onCancel={() => {
            setShowFormModal(false);
            setEditingContractId(null);
          }}
        />
      </FormModal>
    </div>
  );
};

export default InwardReinsuranceDashboard;
