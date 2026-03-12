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
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="primary" icon={<Download size={16} />} onClick={handleExport} style={{ whiteSpace: 'nowrap', background: t.success }}>
          Export
        </Button>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowRegisterModal(true)} style={{ whiteSpace: 'nowrap', background: t.danger }}>
          Register Claim
        </Button>
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
      <div ref={filterRef} className="sticky-filter-blur" style={{ position: 'sticky', top: 0, zIndex: 30, background: t.bgApp }}>
      <div style={{ borderRadius: 12, padding: 12, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, minHeight: 48, overflow: 'visible' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={14} className="-translate-y-1/2" style={{ position: 'absolute', left: 12, top: '50%', color: t.text5, zIndex: 1 }}/>
            <Input
              type="text"
              placeholder="Search..."
              value={filters.searchTerm}
              onChange={(val) => handleFilterChange('searchTerm', val)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            icon={<Filter size={14}/>}
            style={showFilters
              ? { background: t.accentMuted, border: `1px solid ${t.accent}`, color: t.accent }
              : { color: t.text2 }
            }
          >
            Filters
          </Button>
          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, width: 380 }}>
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

          <Button variant="ghost" size="sm" onClick={() => refetch()} style={{ padding: 8, border: 'none' }}>
            <RefreshCw size={16} style={{ color: t.text4 }}/>
          </Button>

        </div>
      </div>
      </div>{/* end sticky filter bar */}

      <div style={{ borderRadius: 12, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>

        {/* Expandable Filter Panel */}
        {showFilters && (
            <div className="animate-in slide-in-from-top-2" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, background: t.accentMuted, borderBottom: `1px solid ${t.border}` }}>
                <div>
                    <label style={{ display: 'block', marginBottom: 4, color: t.text4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const }}>Status</label>
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
                    <label style={{ display: 'block', marginBottom: 4, color: t.text4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const }}>Liability Type</label>
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
            <div style={{ paddingTop: 80, paddingBottom: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: t.text4 }}>
                <Loader2 size={32} className="animate-spin" style={{ marginBottom: 12, color: t.accent }}/>
                Loading claims...
            </div>
        )}

        {/* Error State */}
        {isError && (
            <div style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: t.danger }}>
                <AlertOctagon size={32} style={{ marginBottom: 12 }}/>
                <p style={{ fontWeight: 500 }}>Failed to load claims.</p>
                <Button variant="ghost" size="sm" onClick={() => refetch()} style={{ marginTop: 12, color: t.accent, border: 'none' }}>Try Again</Button>
            </div>
        )}

        {/* Table */}
        {!isLoading && !isError && (
            <>
                    <table style={{ width: '100%', textAlign: 'left', fontSize: 14, whiteSpace: 'nowrap', tableLayout: 'fixed' }}>
                        <thead style={{ position: 'sticky', zIndex: 20, top: `${filterHeight}px`, background: t.bgApp, boxShadow: t.shadow }}>
                            <tr>
                                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, width: 120, color: t.text2 }}>Claim Ref</th>
                                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, width: 110, color: t.text2 }}>Policy Ref</th>
                                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, width: 80, color: t.text2 }}>Status</th>
                                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, width: 90, color: t.text2 }}>Loss Date</th>
                                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, color: t.text2 }}>Insured / Claimant</th>
                                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, textAlign: 'right', width: 110, color: t.text2, background: t.bgApp }}>Incurred (100%)</th>
                                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, textAlign: 'right', width: 120, color: t.text2, background: t.accentMuted }}>Incurred (Ours)</th>
                                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, textAlign: 'right', width: 110, color: t.text2, background: t.successBg }}>Paid (Ours)</th>
                                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, textAlign: 'right', width: 100, color: t.text2, background: t.dangerBg }}>Outstanding</th>
                                <th style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 12, paddingBottom: 12, width: 40, background: t.bgApp }}></th>
                            </tr>
                        </thead>
                        <tbody style={{ borderColor: t.border }}>
                            {claims.map(claim => {
                                const badgeStyle = getStatusBadgeStyle(claim.status);
                                return (
                                <tr
                                    key={claim.id}
                                    onClick={() => navigate(`/claims/${claim.id}`)}
                                    className="transition-colors"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text1 }}>
                                        {claim.claimNumber}
                                        {claim.liabilityType === 'INFORMATIONAL' && (
                                            <span style={{ marginLeft: 8, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4, fontSize: 10, background: t.bgInput, color: t.text3, border: `1px solid ${t.borderL}` }}>INFO</span>
                                        )}
                                    </td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.accent }}>{claim.policyNumber}</td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16 }}>
                                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: badgeStyle.color, background: badgeStyle.background }}>
                                            {claim.status}
                                        </span>
                                    </td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, fontSize: 12, color: t.text3 }}>{formatDate(claim.lossDate)}</td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, overflow: 'hidden' }}>
                                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text1 }} title={claim.insuredName}>{claim.insuredName}</div>
                                        <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text4 }}>{claim.claimantName}</div>
                                    </td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: t.text3 }}>
                                        {formatMoney(claim.totalIncurred100)}
                                    </td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: t.text1 }}>
                                        {formatMoney(claim.totalIncurredOurShare)}
                                    </td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: t.success }}>
                                        {formatMoney(claim.totalPaidOurShare)}
                                    </td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: t.danger }}>
                                        {formatMoney(claim.outstandingOurShare)}
                                    </td>
                                    <td style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 8, paddingBottom: 8, textAlign: 'center', width: 40, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === claim.id ? null : claim.id); }} style={{ padding: 6, border: 'none' }}>
                                            <MoreVertical size={16} style={{ color: t.text4 }} />
                                        </Button>
                                        {openMenuId === claim.id && (
                                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, borderRadius: 8, paddingTop: 4, paddingBottom: 4, zIndex: 50, minWidth: 120, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadowLg }}>
                                                <Button variant="ghost" size="sm" onClick={() => { setOpenMenuId(null); navigate(`/claims/${claim.id}`); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                                                    <Eye size={14} /> View
                                                </Button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                );
                            })}
                            {claims.length === 0 && (
                                <tr>
                                    <td colSpan={10} style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: t.text5 }}>
                                        <AlertOctagon size={48} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 16, opacity: 0.2 }}/>
                                        No claims found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>

                        {/* Summary Row */}
                        {claims.length > 0 && (
                            <tfoot style={{ fontWeight: 700, fontSize: 12, background: t.bgApp, borderTop: `2px solid ${t.border}`, color: t.text2 }}>
                                <tr>
                                    <td colSpan={5} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Page Summary:</td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>-</td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(summaryIncurred)}</td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: t.success }}>{formatMoney(summaryPaid)}</td>
                                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: t.danger }}>{formatMoney(summaryOutstanding)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} style={{ height: 4 }} />
                {isLoading && filters.page > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16, paddingBottom: 16 }}>
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
