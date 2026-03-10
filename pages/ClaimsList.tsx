
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClaimFilters } from '../types';
import { useClaimsList } from '../hooks/useClaims';
import { formatDate } from '../utils/dateUtils';
import { toISODateString } from '../components/DatePickerInput';
import { CompactDateFilter } from '../components/CompactDateFilter';
import RegisterClaimModal from '../components/RegisterClaimModal';
import { AlertOctagon, Search, Plus, Filter, Loader2, RefreshCw, Download, MoreVertical, Eye } from 'lucide-react';
import { exportToExcel } from '../services/excelExport';
import { usePageHeader } from '../context/PageHeaderContext';
import { useTheme } from '../theme/useTheme';

const PAGE_SIZE = 20;

const ClaimsList: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTheme();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const [showFilters, setShowFilters] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Infinite scroll state
  const [allClaims, setAllClaims] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Kebab menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

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

  // Filter State
  const [filters, setFilters] = useState<ClaimFilters>({
      liabilityType: 'ALL',
      status: 'ALL',
      searchTerm: '',
      page: 1,
      pageSize: PAGE_SIZE
  });

  // Date filter state
  const [dateFilterField, setDateFilterField] = useState<string>('lossDate');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const { data, isLoading, isError, refetch } = useClaimsList(filters);
  const totalCount = data?.count || 0;

  // Accumulate claims across pages
  useEffect(() => {
    const newClaims = data?.data || [];
    if (newClaims.length === 0) return;
    setHasMore(newClaims.length >= PAGE_SIZE);
    if (filters.page === 1) {
      setAllClaims(newClaims);
    } else {
      setAllClaims(prev => [...prev, ...newClaims]);
    }
  }, [data, filters.page]);

  const claims = allClaims.filter(claim => {
    const fromStr = toISODateString(dateFrom) || '';
    const toStr = toISODateString(dateTo) || '';
    if (fromStr || toStr) {
      const val = (claim as any)[dateFilterField] || '';
      const dateStr = typeof val === 'string' ? val.slice(0, 10) : '';
      if (fromStr && dateStr < fromStr) return false;
      if (toStr && dateStr > toStr) return false;
    }
    return true;
  });

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setFilters(prev => ({ ...prev, page: prev.page + 1 }));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  const handleFilterChange = (key: keyof ClaimFilters, value: any) => {
      setAllClaims([]);
      setHasMore(true);
      setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleExport = () => {
    if (claims.length === 0) return;
    const exportData = claims.map(c => ({
      'Claim Ref': c.claimNumber,
      'Policy Ref': c.policyNumber,
      'Status': c.status,
      'Loss Date': c.lossDate || '',
      'Insured': c.insuredName || '',
      'Claimant': c.claimantName || '',
      'Incurred (100%)': c.totalIncurred100 || 0,
      'Incurred (Ours)': c.totalIncurredOurShare || 0,
      'Paid (Ours)': c.totalPaidOurShare || 0,
      'Outstanding': c.outstandingOurShare || 0,
    }));
    exportToExcel(exportData, `Claims_${new Date().toISOString().split('T')[0]}`, 'Claims');
  };

  // Header actions: Export + Register Claim
  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          style={{ background: t.success, color: '#fff', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, boxShadow: t.shadow }}
          className="flex items-center gap-2 transition-all whitespace-nowrap"
        >
          <Download size={16} /> Export
        </button>
        <button
          onClick={() => setShowRegisterModal(true)}
          style={{ background: t.danger, color: '#fff', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, boxShadow: t.shadow }}
          className="flex items-center gap-2 transition-all whitespace-nowrap"
        >
          <Plus size={16} /> Register Claim
        </button>
      </div>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [claims, setHeaderActions, setHeaderLeft, t]);

  // Format Currency Helper
  const formatMoney = (val: number | undefined) => {
      if (val === undefined || val === null) return '-';
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate Summary from current page
  const summaryIncurred = claims.reduce((acc, c) => acc + (c.totalIncurredOurShare || 0), 0);
  const summaryPaid = claims.reduce((acc, c) => acc + (c.totalPaidOurShare || 0), 0);
  const summaryOutstanding = claims.reduce((acc, c) => acc + (c.outstandingOurShare || 0), 0);

  // Status badge styling
  const getStatusBadgeStyle = (status: string) => {
    if (status === 'OPEN') return { color: t.success, background: t.successBg };
    if (status === 'CLOSED') return { color: t.text3, background: t.bgInput };
    return { color: t.danger, background: t.dangerBg };
  };

  return (
    <div>
      {/* Sticky filter bar */}
      <div ref={filterRef} className="sticky top-0 z-30 sticky-filter-blur" style={{ background: t.bgApp }}>
      <div className="rounded-xl p-3" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
        <div className="flex flex-wrap items-center gap-3 min-h-[48px] overflow-visible">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.text5 }}/>
            <input
              type="text"
              placeholder="Search..."
              style={{ width: '100%', padding: '8px 12px 8px 32px', background: t.bgInput, border: `1px solid ${t.borderL}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none' }}
              value={filters.searchTerm}
              onChange={e => handleFilterChange('searchTerm', e.target.value)}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={showFilters
              ? { background: t.accentMuted, border: `1px solid ${t.accent}`, color: t.accent }
              : { background: t.bgPanel, border: `1px solid ${t.borderL}`, color: t.text2 }
            }
          >
            <Filter size={14}/> Filters
          </button>
          {/* Date Filter */}
          <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: '380px' }}>
          <select
            value={dateFilterField}
            onChange={(e) => setDateFilterField(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${t.borderL}`, borderRadius: 8, fontSize: 13, background: t.bgPanel, color: t.text1, outline: 'none' }}
          >
            <option value="lossDate">Loss Date</option>
            <option value="reportDate">Report Date</option>
          </select>
          <CompactDateFilter
            value={dateFrom}
            onChange={(d) => setDateFrom(d)}
            placeholder="From"
          />
          <CompactDateFilter
            value={dateTo}
            onChange={(d) => setDateTo(d)}
            placeholder="To"
          />
          </div>

          <button onClick={() => refetch()} className="p-2 rounded-lg" style={{ color: t.text4 }}>
            <RefreshCw size={16}/>
          </button>

        </div>
      </div>
      </div>{/* end sticky filter bar */}

      <div className="rounded-xl" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>

        {/* Expandable Filter Panel */}
        {showFilters && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200" style={{ background: t.accentMuted, borderBottom: `1px solid ${t.border}` }}>
                <div>
                    <label style={{ color: t.text4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const }} className="block mb-1">Status</label>
                    <select
                        style={{ width: '100%', padding: '8px 12px', border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13, background: t.bgPanel, color: t.text1 }}
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="OPEN">Open</option>
                        <option value="CLOSED">Closed</option>
                        <option value="REOPENED">Reopened</option>
                        <option value="DENIED">Denied</option>
                    </select>
                </div>
                <div>
                    <label style={{ color: t.text4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const }} className="block mb-1">Liability Type</label>
                    <select
                        style={{ width: '100%', padding: '8px 12px', border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13, background: t.bgPanel, color: t.text1 }}
                        value={filters.liabilityType}
                        onChange={(e) => handleFilterChange('liabilityType', e.target.value)}
                    >
                        <option value="ALL">All Types</option>
                        <option value="ACTIVE">Active Liability</option>
                        <option value="INFORMATIONAL">Informational</option>
                    </select>
                </div>
            </div>
        )}

        {/* Loading State */}
        {isLoading && (
            <div className="py-20 text-center flex flex-col items-center justify-center" style={{ color: t.text4 }}>
                <Loader2 size={32} className="animate-spin mb-3" style={{ color: t.accent }}/>
                Loading claims...
            </div>
        )}

        {/* Error State */}
        {isError && (
            <div className="py-12 text-center flex flex-col items-center justify-center" style={{ color: t.danger }}>
                <AlertOctagon size={32} className="mb-3"/>
                <p className="font-medium">Failed to load claims.</p>
                <button onClick={() => refetch()} className="mt-3 text-sm hover:underline" style={{ color: t.accent }}>Try Again</button>
            </div>
        )}

        {/* Table */}
        {!isLoading && !isError && (
            <>
                    <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
                        <thead className="sticky z-20" style={{ top: `${filterHeight}px`, background: t.bgApp, boxShadow: t.shadow }}>
                            <tr>
                                <th className="px-4 py-4 w-[120px]" style={{ color: t.text2 }}>Claim Ref</th>
                                <th className="px-4 py-4 w-[110px]" style={{ color: t.text2 }}>Policy Ref</th>
                                <th className="px-4 py-4 w-[80px]" style={{ color: t.text2 }}>Status</th>
                                <th className="px-4 py-4 w-[90px]" style={{ color: t.text2 }}>Loss Date</th>
                                <th className="px-4 py-4" style={{ color: t.text2 }}>Insured / Claimant</th>
                                <th className="px-4 py-4 text-right w-[110px]" style={{ color: t.text2, background: t.bgApp }}>Incurred (100%)</th>
                                <th className="px-4 py-4 text-right w-[120px]" style={{ color: t.text2, background: t.accentMuted }}>Incurred (Ours)</th>
                                <th className="px-4 py-4 text-right w-[110px]" style={{ color: t.text2, background: t.successBg }}>Paid (Ours)</th>
                                <th className="px-4 py-4 text-right w-[100px]" style={{ color: t.text2, background: t.dangerBg }}>Outstanding</th>
                                <th className="px-1 py-3 w-10" style={{ background: t.bgApp }}></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: t.border }}>
                            {claims.map(claim => {
                                const badgeStyle = getStatusBadgeStyle(claim.status);
                                return (
                                <tr
                                    key={claim.id}
                                    onClick={() => navigate(`/claims/${claim.id}`)}
                                    className="cursor-pointer transition-colors"
                                    onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                    <td className="px-4 py-4 font-bold truncate" style={{ color: t.text1 }}>
                                        {claim.claimNumber}
                                        {claim.liabilityType === 'INFORMATIONAL' && (
                                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]" style={{ background: t.bgInput, color: t.text3, border: `1px solid ${t.borderL}` }}>INFO</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 font-mono text-xs truncate" style={{ color: t.accent }}>{claim.policyNumber}</td>
                                    <td className="px-4 py-4">
                                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: badgeStyle.color, background: badgeStyle.background }}>
                                            {claim.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-xs" style={{ color: t.text3 }}>{formatDate(claim.lossDate)}</td>
                                    <td className="px-4 py-4 overflow-hidden">
                                        <div className="font-medium truncate" style={{ color: t.text1 }} title={claim.insuredName}>{claim.insuredName}</div>
                                        <div className="text-xs truncate" style={{ color: t.text4 }}>{claim.claimantName}</div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono" style={{ color: t.text3 }}>
                                        {formatMoney(claim.totalIncurred100)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono font-bold" style={{ color: t.text1 }}>
                                        {formatMoney(claim.totalIncurredOurShare)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono" style={{ color: t.success }}>
                                        {formatMoney(claim.totalPaidOurShare)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono" style={{ color: t.danger }}>
                                        {formatMoney(claim.outstandingOurShare)}
                                    </td>
                                    <td className="px-1 py-2 text-center w-10 relative" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === claim.id ? null : claim.id); }}
                                            className="p-1.5 rounded-lg"
                                            onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
                                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                                        >
                                            <MoreVertical size={16} style={{ color: t.text4 }} />
                                        </button>
                                        {openMenuId === claim.id && (
                                            <div className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-[120px]" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadowLg }}>
                                                <button onClick={() => { setOpenMenuId(null); navigate(`/claims/${claim.id}`); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm"
                                                  style={{ color: t.text2 }}
                                                  onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
                                                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                                                >
                                                    <Eye size={14} /> View
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                );
                            })}
                            {claims.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center" style={{ color: t.text5 }}>
                                        <AlertOctagon size={48} className="mx-auto mb-4 opacity-20"/>
                                        No claims found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>

                        {/* Summary Row */}
                        {claims.length > 0 && (
                            <tfoot className="font-bold text-xs" style={{ background: t.bgApp, borderTop: `2px solid ${t.border}`, color: t.text2 }}>
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wider">Page Summary:</td>
                                    <td className="px-4 py-3 text-right">-</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatMoney(summaryIncurred)}</td>
                                    <td className="px-4 py-3 text-right font-mono" style={{ color: t.success }}>{formatMoney(summaryPaid)}</td>
                                    <td className="px-4 py-3 text-right font-mono" style={{ color: t.danger }}>{formatMoney(summaryOutstanding)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-1" />
                {isLoading && filters.page > 1 && (
                  <div className="flex justify-center py-4">
                    <RefreshCw size={20} className="animate-spin" style={{ color: t.accent }} />
                  </div>
                )}
            </>
        )}
      </div>

      <RegisterClaimModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
      />
    </div>
  );
};

export default ClaimsList;
