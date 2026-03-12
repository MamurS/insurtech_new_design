import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../services/db';
import { ReinsuranceSlip, PolicyStatus } from '../types';
import { exportToExcel } from '../services/excelExport';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DetailModal } from '../components/DetailModal';
import { formatDate } from '../utils/dateUtils';
import { toISODateString } from '../components/DatePickerInput';
import { CompactDateFilter } from '../components/CompactDateFilter';
import SidePanel, { PanelField } from '../components/ui/SidePanel';
import { Search, Edit, Trash2, Plus, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Download, FileText, CheckCircle, AlertCircle, XCircle, AlertTriangle, MoreVertical, Eye, RefreshCw } from 'lucide-react';
import { usePageHeader } from '../context/PageHeaderContext';
import { useTheme } from '../theme/useTheme';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

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
  const [selectedSlipForPanel, setSelectedSlipForPanel] = useState<ReinsuranceSlip | null>(null);

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
    navigate(`/slips/edit/${id}`);
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
      <Button variant="primary" icon={<Download size={16} />} onClick={handleExport} style={{ whiteSpace: 'nowrap', background: t.success }}>
        Export
      </Button>
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
        className="transition-colors group"
        onClick={() => handleSort(sortKey)}
        style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, cursor: 'pointer', userSelect: 'none', background: 'inherit' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
      <div ref={filterRef} className="sticky-filter-blur" style={{ position: 'sticky', top: 0, zIndex: 30, background: t.bgApp }}>
      <div style={{ padding: 12, background: t.bgPanel, borderRadius: 12, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, minHeight: 48, overflow: 'visible' }}>
          {/* Status Tabs - Compact */}
          <div style={{ display: 'flex', padding: 2, borderRadius: 8, overflowX: 'auto', background: t.bgInput }}>
            {slipStatusTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className="transition-all"
                style={
                  statusFilter === tab.key
                    ? { paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, borderRadius: 6, whiteSpace: 'nowrap', background: t.bgPanel, color: t.accent, boxShadow: t.shadow }
                    : { paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, borderRadius: 6, whiteSpace: 'nowrap', color: t.text4 }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: t.borderL }} />

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={14} className="-translate-y-1/2" style={{ position: 'absolute', left: 12, top: '50%', color: t.text4, zIndex: 1 }} />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(val) => setSearchTerm(val)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <div style={{ width: 1, height: 20, background: t.borderL }} />

          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, width: '380px' }}>
          <select
            value={dateFilterField}
            onChange={(e) => { setDateFilterField(e.target.value); setVisibleCount(VISIBLE_INCREMENT); }}
            style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, outline: 'none', fontSize: 14, border: `1px solid ${t.borderL}`, background: t.bgPanel, color: t.text1 }}
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
          <Button variant="ghost" size="sm" onClick={() => fetchData()} title="Refresh" style={{ padding: 8, border: 'none' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={loading ? { color: t.accent } : { color: t.text4 }} />
          </Button>

          <div style={{ width: 1, height: 20, background: t.borderL }} />

          {/* New Slip Button */}
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/slips/new')}>
            New Slip
          </Button>
        </div>
      </div>
      </div>{/* end sticky filter bar */}

      {/* Grid: table + optional side panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedSlipForPanel ? '1fr 360px' : '1fr', transition: 'grid-template-columns 0.2s ease' }}>

      {/* Slips Table */}
      <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: t.shadow, overflow: 'hidden', minWidth: 0 }}>
        <table style={{ width: '100%', fontSize: 14, textAlign: 'left' }}>
            <thead style={{ position: 'sticky', zIndex: 20, background: t.bgApp, boxShadow: t.shadow, top: `${filterHeight}px` }}>
                <tr>
                    <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, width: 48 }}>#</th>
                    <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, width: 96 }}>Status</th>
                    <SortableHeader label="Slip Number" sortKey="slipNumber" />
                    <SortableHeader label="Date" sortKey="date" />
                    <SortableHeader label="Insured" sortKey="insuredName" />
                    <SortableHeader label="Limit of Liab" sortKey="limitOfLiability" />
                    <SortableHeader label="Broker / Reinsurer" sortKey="brokerReinsurer" />
                    <th style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 12, paddingBottom: 12, width: 40, background: t.bgApp }}></th>
                </tr>
            </thead>
            <tbody>
                {visibleSlips.map((slip, index) => (
                    <tr
                      key={slip.id}
                      onClick={() => setSelectedSlipForPanel(prev => prev?.id === slip.id ? null : slip)}
                      className="transition-colors"
                      style={slip.isDeleted
                        ? { cursor: 'pointer', background: t.bgInput, opacity: 0.6, filter: 'grayscale(1)', borderBottom: `1px solid ${t.border}` }
                        : { cursor: 'pointer', borderBottom: `1px solid ${t.border}`, background: selectedSlipForPanel?.id === slip.id ? t.bgActive : 'transparent' }}
                    >
                        <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, color: t.text4 }}>{index + 1}</td>
                        <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16 }}>
                            {getStatusBadge((slip.status as any) || 'DRAFT', slip.isDeleted)}
                        </td>
                        <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: t.warning }}>
                            {getDisplaySlipNumber(slip)}
                        </td>
                        <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, color: t.text3 }}>{formatDate(slip.date)}</td>
                        <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, fontWeight: 500, color: t.text1 }}>{getDisplayInsured(slip)}</td>
                        <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, fontFamily: "'JetBrains Mono', monospace", color: t.text2 }}>
                            {formatMoney(slip.limitOfLiability, slip.currency as string)}
                        </td>
                        <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, color: t.text3 }}>{getDisplayBroker(slip)}</td>
                        <td style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 8, paddingBottom: 8, textAlign: 'center', width: 40, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === slip.id ? null : slip.id); }} style={{ padding: 6, border: 'none' }}>
                                <MoreVertical size={16} style={{ color: t.text4 }} />
                            </Button>
                            {openMenuId === slip.id && (
                                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, borderRadius: 8, paddingTop: 4, paddingBottom: 4, zIndex: 50, minWidth: 120, background: t.bgPanel, boxShadow: t.shadowLg, border: `1px solid ${t.border}` }}>
                                    <Button variant="ghost" size="sm" onClick={() => { setOpenMenuId(null); setSelectedSlip(slip); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                                        <Eye size={14} /> View
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={(e) => { setOpenMenuId(null); handleEdit(e as any, slip.id); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                                        <Edit size={14} /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={(e) => { setOpenMenuId(null); handleWording(e as any, slip.id); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                                        <FileText size={14} /> Wording
                                    </Button>
                                    {!slip.isDeleted && (
                                        <Button variant="danger" size="sm" onClick={(e) => { setOpenMenuId(null); initiateDelete(e as any, slip.id); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                                            <Trash2 size={14} /> Delete
                                        </Button>
                                    )}
                                </div>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 4 }} />
        {hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16, paddingBottom: 16 }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: t.accent }} />
          </div>
        )}

        {!loading && filteredSlips.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', color: t.text4 }}>
                <FileSpreadsheet size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                <p>No slips found matching your search.</p>
            </div>
        )}
      </div>

      {/* Inline Side Panel */}
      <SidePanel
        open={!!selectedSlipForPanel}
        onClose={() => setSelectedSlipForPanel(null)}
        title={selectedSlipForPanel ? getDisplaySlipNumber(selectedSlipForPanel) : ''}
        subtitle="Slip Summary"
        footer={selectedSlipForPanel ? (
          <>
            <Button variant="primary" icon={<Eye size={14} />} onClick={() => { setSelectedSlip(selectedSlipForPanel); }} style={{ flex: 1, justifyContent: 'center' }}>
              View Full Detail
            </Button>
            <Button variant="ghost" icon={<Edit size={14} />} onClick={() => navigate(`/slips/edit/${selectedSlipForPanel.id}`)} style={{ flex: 1, justifyContent: 'center' }}>
              Edit
            </Button>
          </>
        ) : undefined}
      >
        {selectedSlipForPanel && (
          <>
            <PanelField label="Slip Number" value={getDisplaySlipNumber(selectedSlipForPanel)} />
            <PanelField label="Status" value={getStatusBadge((selectedSlipForPanel.status as any) || 'DRAFT', selectedSlipForPanel.isDeleted)} />
            <PanelField label="Date" value={formatDate(selectedSlipForPanel.date)} />
            <PanelField label="Type / Class" value={(selectedSlipForPanel as any).type || (selectedSlipForPanel as any).classOfBusiness || undefined} />
            <PanelField label="Cedent / Insured" value={getDisplayInsured(selectedSlipForPanel)} />
            <PanelField label="Broker / Reinsurer" value={getDisplayBroker(selectedSlipForPanel)} />
            <PanelField label="Treaty Type" value={(selectedSlipForPanel as any).treatyType || undefined} />
            <PanelField label="Currency" value={(selectedSlipForPanel.currency as string) || undefined} />
            <PanelField label="GWP" value={formatMoney((selectedSlipForPanel as any).gwp, selectedSlipForPanel.currency as string)} />
            <PanelField label="Limit of Liability" value={formatMoney(selectedSlipForPanel.limitOfLiability, selectedSlipForPanel.currency as string)} />
            <PanelField label="Retention" value={formatMoney((selectedSlipForPanel as any).retention, selectedSlipForPanel.currency as string)} />
          </>
        )}
      </SidePanel>

      </div>{/* end grid */}

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

    </div>
  );
};

export default SlipsDashboard;
