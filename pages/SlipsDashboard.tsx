import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../services/db';
import { ReinsuranceSlip, PolicyStatus } from '../types';
import { exportToExcel } from '../services/excelExport';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DetailModal } from '../components/DetailModal';
import { FormModal } from '../components/FormModal';
import { SlipFormContent } from '../components/SlipFormContent';
import { formatDate } from '../utils/dateUtils';
import { toISODateString } from '../components/DatePickerInput';
import { CompactDateFilter } from '../components/CompactDateFilter';
import { Search, Edit, Trash2, Plus, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Download, FileText, CheckCircle, AlertCircle, XCircle, AlertTriangle, MoreVertical, Eye, RefreshCw } from 'lucide-react';
import { usePageHeader } from '../context/PageHeaderContext';
import { useTheme } from '../theme/useTheme';

// Detect shifted column data from legacy CSV import:
// insuredName got a numeric ID, brokerReinsurer got the actual insured name.
const isNumericValue = (v: string) => /^\d+(\.\d+)?$/.test(v);
const getDisplayInsured = (slip: ReinsuranceSlip): string => {
  if (!slip.insuredName || isNumericValue(slip.insuredName)) {
    return slip.brokerReinsurer || '';
  }
  return slip.insuredName;
};
const getDisplayBroker = (slip: ReinsuranceSlip): string => {
  if (!slip.insuredName || isNumericValue(slip.insuredName)) {
    return ''; // brokerReinsurer is actually the insured, not the broker
  }
  return slip.brokerReinsurer || '';
};
const getDisplaySlipNumber = (slip: ReinsuranceSlip): string => {
  const num = slip.slipNumber || '';
  const clean = num.replace(/\.0$/, '');
  if (/^\d+$/.test(clean)) return `SLIP-${clean}`;
  return num;
};

const SlipsDashboard: React.FC = () => {
  const { t } = useTheme();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const [slips, setSlips] = useState<ReinsuranceSlip[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Infinite scroll
  const VISIBLE_INCREMENT = 20;
  const [visibleCount, setVisibleCount] = useState(VISIBLE_INCREMENT);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Date filter state
  const [dateFilterField, setDateFilterField] = useState<string>('date');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // Selection State
  const [selectedSlip, setSelectedSlip] = useState<ReinsuranceSlip | null>(null);

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

  // Kebab menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof ReinsuranceSlip; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc'
  });

  // Modal State
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [editingSlipId, setEditingSlipId] = useState<string | null>(null);

  const navigate = useNavigate();

  const slipStatusTabs = [
    { key: 'ALL', label: 'All' },
    { key: 'DRAFT', label: 'Draft' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'QUOTED', label: 'Quoted' },
    { key: 'SIGNED', label: 'Signed' },
    { key: 'SENT', label: 'Sent' },
    { key: 'BOUND', label: 'Bound' },
    { key: 'CLOSED', label: 'Closed' },
    { key: 'DECLINED', label: 'Declined/NTU' },
    { key: 'DELETED', label: 'Deleted' }
  ];

  const fetchData = async () => {
      setLoading(true);
      try {
        const data = await DB.getSlips();
        setSlips(data);
      } catch (e) {
         console.error("Failed to fetch slips", e);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const initiateDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteId(id);
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSlipId(id);
    setShowSlipModal(true);
  };

  const handleWording = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/wording/${id}`);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      try {
        setSlips(prev => prev.map(s => s.id === deleteId ? { ...s, isDeleted: true } : s));
        await DB.deleteSlip(deleteId);
      } catch (err) {
        console.error("Failed to delete slip", err);
        fetchData();
      } finally {
        setDeleteId(null);
      }
    }
  };

  const handleSort = (key: keyof ReinsuranceSlip) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredSlips = slips.filter(slip => {
    // Deleted filter - special handling
    if (statusFilter === 'DELETED') {
        return slip.isDeleted === true;
    }

    // For non-deleted filters, exclude deleted slips
    if (slip.isDeleted && statusFilter !== 'ALL') return false;

    const currentStatus = (slip.status as any) || 'DRAFT';

    // Status filter
    if (statusFilter !== 'ALL') {
        if (statusFilter === 'DECLINED') {
            // Include both DECLINED, NTU, and CANCELLED
            if (!['DECLINED', 'NTU', 'CANCELLED'].includes(currentStatus)) return false;
        } else if (statusFilter === 'BOUND') {
            // Include legacy 'Active' as BOUND
            if (currentStatus !== 'BOUND' && currentStatus !== 'Active') return false;
        } else {
            if (currentStatus !== statusFilter) return false;
        }
    }

    // Search filter — use display values (handles shifted column data)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        getDisplaySlipNumber(slip).toLowerCase().includes(search) ||
        getDisplayInsured(slip).toLowerCase().includes(search) ||
        getDisplayBroker(slip).toLowerCase().includes(search)
      );
    }

    return true;
  }).filter(slip => {
    // Date filter (client-side)
    const fromStr = toISODateString(dateFrom) || '';
    const toStr = toISODateString(dateTo) || '';
    if (fromStr || toStr) {
      const val = (slip as any)[dateFilterField] || '';
      const dateStr = typeof val === 'string' ? val.slice(0, 10) : '';
      if (fromStr && dateStr < fromStr) return false;
      if (toStr && dateStr > toStr) return false;
    }
    return true;
  });

  const sortedSlips = [...filteredSlips].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const visibleSlips = sortedSlips.slice(0, visibleCount);
  const hasMore = visibleCount < sortedSlips.length;

  // Reset visibleCount when filters change
  useEffect(() => {
    setVisibleCount(VISIBLE_INCREMENT);
  }, [searchTerm, statusFilter]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setVisibleCount(prev => prev + VISIBLE_INCREMENT);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const handleExport = () => {
    if (sortedSlips.length === 0) return;
    const exportData = sortedSlips.map(slip => ({
      'Slip Number': getDisplaySlipNumber(slip),
      'Status': (slip.status as string) || 'DRAFT',
      'Date': slip.date ? formatDate(slip.date) : '',
      'Insured': getDisplayInsured(slip),
      'Broker / Reinsurer': getDisplayBroker(slip),
      'Currency': (slip.currency as string) || '',
      'Limit of Liability': slip.limitOfLiability || 0,
    }));
    exportToExcel(exportData, `Reinsurance_Slips_${new Date().toISOString().split('T')[0]}`, 'Slips');
  };

  // Export button in page header
  useEffect(() => {
    setHeaderActions(
      <button
        onClick={handleExport}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap"
        style={{ background: t.success, color: '#fff', boxShadow: t.shadow }}
      >
        <Download size={16} /> Export
      </button>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [sortedSlips, setHeaderActions, setHeaderLeft, t]);

  const formatMoney = (amount: number | undefined, currency: string | undefined) => {
    if (amount === undefined || amount === null) return '-';
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount);
    } catch {
        return `${amount}`;
    }
  };

  const getStatusBadge = (status: string, isDeleted?: boolean) => {
    if (isDeleted) {
        return (
            <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: t.dangerBg, color: t.danger, border: `1px solid ${t.danger}` }}>
                DELETED
            </span>
        );
    }

    // Normalize legacy status
    if (status === 'Active') status = 'BOUND';

    const badgeStyles: Record<string, React.CSSProperties> = {
        'DRAFT': { background: t.bgInput, color: t.text1, border: `1px solid ${t.border}` },
        'PENDING': { background: t.accentMuted + '22', color: t.accent, border: `1px solid ${t.accent}44` },
        'QUOTED': { background: '#7c3aed18', color: '#7c3aed', border: '1px solid #7c3aed44' },
        'SIGNED': { background: '#4f46e518', color: '#4f46e5', border: '1px solid #4f46e544' },
        'SENT': { background: '#0891b218', color: '#0891b2', border: '1px solid #0891b244' },
        'BOUND': { background: t.successBg, color: t.success, border: `1px solid ${t.success}44` },
        'CLOSED': { background: t.bgInput, color: t.text3, border: `1px solid ${t.borderL}` },
        'DECLINED': { background: t.dangerBg, color: t.danger, border: `1px solid ${t.danger}44` },
        'NTU': { background: t.warningBg, color: t.warning, border: `1px solid ${t.warning}44` },
        'CANCELLED': { background: t.dangerBg, color: t.danger, border: `1px solid ${t.danger}44` },
    };
    return (
        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, ...(badgeStyles[status] || { background: t.bgInput, color: t.text1 }) }}>
            {status || 'DRAFT'}
        </span>
    );
  };

  const SortableHeader = ({ label, sortKey }: { label: string, sortKey: keyof ReinsuranceSlip }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th
        className="px-4 py-4 cursor-pointer transition-colors group select-none"
        onClick={() => handleSort(sortKey)}
        style={{ background: 'inherit' }}
      >
        <div className="flex items-center gap-2">
          {label}
          <div style={{ color: t.text4 }}>
             {isActive ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50"/>}
          </div>
        </div>
      </th>
    );
  };

  return (
    <div>
      {/* Sticky filter bar */}
      <div ref={filterRef} className="sticky top-0 z-30 sticky-filter-blur" style={{ background: t.bgApp }}>
      <div className="p-3" style={{ background: t.bgPanel, borderRadius: 12, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
        <div className="flex flex-wrap items-center gap-3 min-h-[48px] overflow-visible">
          {/* Status Tabs - Compact */}
          <div className="flex p-0.5 rounded-lg overflow-x-auto" style={{ background: t.bgInput }}>
            {slipStatusTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap"
                style={
                  statusFilter === tab.key
                    ? { background: t.bgPanel, color: t.accent, boxShadow: t.shadow }
                    : { color: t.text4 }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5" style={{ background: t.borderL }} />

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-2 rounded-lg outline-none text-sm"
              style={{ border: `1px solid ${t.borderL}`, background: t.bgInput, color: t.text1 }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="w-px h-5" style={{ background: t.borderL }} />

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: '380px' }}>
          <select
            value={dateFilterField}
            onChange={(e) => { setDateFilterField(e.target.value); setVisibleCount(VISIBLE_INCREMENT); }}
            className="px-3 py-2 rounded-lg outline-none text-sm"
            style={{ border: `1px solid ${t.borderL}`, background: t.bgPanel, color: t.text1 }}
          >
            <option value="date">Slip Date</option>
          </select>
          <CompactDateFilter
            value={dateFrom}
            onChange={(d) => { setDateFrom(d); setVisibleCount(VISIBLE_INCREMENT); }}
            placeholder="From"
          />
          <CompactDateFilter
            value={dateTo}
            onChange={(d) => { setDateTo(d); setVisibleCount(VISIBLE_INCREMENT); }}
            placeholder="To"
          />
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchData()}
            className="p-2 rounded-lg"
            title="Refresh"
            style={{ color: t.text4 }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={loading ? { color: t.accent } : undefined} />
          </button>

          <div className="w-px h-5" style={{ background: t.borderL }} />

          {/* New Slip Button */}
          <button
            type="button"
            onClick={() => { setEditingSlipId(null); setShowSlipModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm"
            style={{ background: t.accent, color: '#fff' }}
          >
            <Plus size={16} /> New Slip
          </button>
        </div>
      </div>
      </div>{/* end sticky filter bar */}

      {/* Slips Table */}
      <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: t.shadow }}>
        <table className="w-full text-sm text-left">
            <thead className="sticky z-20" style={{ background: t.bgApp, boxShadow: t.shadow, top: `${filterHeight}px` }}>
                <tr>
                    <th className="px-4 py-4 w-12">#</th>
                    <th className="px-4 py-4 w-24">Status</th>
                    <SortableHeader label="Slip Number" sortKey="slipNumber" />
                    <SortableHeader label="Date" sortKey="date" />
                    <SortableHeader label="Insured" sortKey="insuredName" />
                    <SortableHeader label="Limit of Liab" sortKey="limitOfLiability" />
                    <SortableHeader label="Broker / Reinsurer" sortKey="brokerReinsurer" />
                    <th className="px-1 py-3 w-10" style={{ background: t.bgApp }}></th>
                </tr>
            </thead>
            <tbody>
                {visibleSlips.map((slip, index) => (
                    <tr
                      key={slip.id}
                      onClick={() => setSelectedSlip(slip)}
                      className="transition-colors cursor-pointer"
                      style={slip.isDeleted ? { background: t.bgInput, opacity: 0.6, filter: 'grayscale(1)', cursor: 'not-allowed', borderBottom: `1px solid ${t.border}` } : { borderBottom: `1px solid ${t.border}` }}
                    >
                        <td className="px-4 py-4" style={{ color: t.text4 }}>{index + 1}</td>
                        <td className="px-4 py-4">
                            {getStatusBadge((slip.status as any) || 'DRAFT', slip.isDeleted)}
                        </td>
                        <td className="px-4 py-4 font-mono font-medium" style={{ color: t.warning }}>
                            {getDisplaySlipNumber(slip)}
                        </td>
                        <td className="px-4 py-4" style={{ color: t.text3 }}>{formatDate(slip.date)}</td>
                        <td className="px-4 py-4 font-medium" style={{ color: t.text1 }}>{getDisplayInsured(slip)}</td>
                        <td className="px-4 py-4 font-mono" style={{ color: t.text2 }}>
                            {formatMoney(slip.limitOfLiability, slip.currency as string)}
                        </td>
                        <td className="px-4 py-4" style={{ color: t.text3 }}>{getDisplayBroker(slip)}</td>
                        <td className="px-1 py-2 text-center w-10 relative" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === slip.id ? null : slip.id); }}
                                className="p-1.5 rounded-lg">
                                <MoreVertical size={16} style={{ color: t.text4 }} />
                            </button>
                            {openMenuId === slip.id && (
                                <div className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-[120px]" style={{ background: t.bgPanel, boxShadow: t.shadowLg, border: `1px solid ${t.border}` }}>
                                    <button onClick={() => { setOpenMenuId(null); setSelectedSlip(slip); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm" style={{ color: t.text2 }}>
                                        <Eye size={14} /> View
                                    </button>
                                    <button onClick={(e) => { setOpenMenuId(null); handleEdit(e as any, slip.id); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm" style={{ color: t.text2 }}>
                                        <Edit size={14} /> Edit
                                    </button>
                                    <button onClick={(e) => { setOpenMenuId(null); handleWording(e as any, slip.id); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm" style={{ color: t.text2 }}>
                                        <FileText size={14} /> Wording
                                    </button>
                                    {!slip.isDeleted && (
                                        <button onClick={(e) => { setOpenMenuId(null); initiateDelete(e as any, slip.id); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm" style={{ color: t.danger }}>
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    )}
                                </div>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />
        {hasMore && (
          <div className="flex justify-center py-4">
            <RefreshCw size={20} className="animate-spin" style={{ color: t.accent }} />
          </div>
        )}

        {!loading && filteredSlips.length === 0 && (
            <div className="p-12 text-center flex flex-col items-center" style={{ color: t.text4 }}>
                <FileSpreadsheet size={48} className="mb-4 opacity-20" />
                <p>No slips found matching your search.</p>
            </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Slip?"
        message="Are you sure you want to delete this reinsurance slip record? It will be marked as deleted."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

       {/* Detail Modal */}
       {selectedSlip && (
          <DetailModal
            item={selectedSlip}
            onClose={() => setSelectedSlip(null)}
            title="Slip Details"
          />
      )}

      {/* Slip Form Modal */}
      <FormModal
        isOpen={showSlipModal}
        onClose={() => { setShowSlipModal(false); setEditingSlipId(null); }}
        title={editingSlipId ? 'Edit Reinsurance Slip' : 'New Reinsurance Slip'}
        subtitle={editingSlipId ? 'Editing slip details' : 'Create a new outward reinsurance slip'}
      >
        <SlipFormContent
          id={editingSlipId || undefined}
          onSave={() => { setShowSlipModal(false); setEditingSlipId(null); fetchData(); }}
          onCancel={() => { setShowSlipModal(false); setEditingSlipId(null); }}
        />
      </FormModal>
    </div>
  );
};

export default SlipsDashboard;
