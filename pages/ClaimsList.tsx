
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

const PAGE_SIZE = 20;

const ClaimsList: React.FC = () => {
  const navigate = useNavigate();
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
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 shadow-sm transition-all whitespace-nowrap"
        >
          <Download size={16} /> Export
        </button>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-all text-sm shadow-sm whitespace-nowrap"
        >
          <Plus size={16} /> Register Claim
        </button>
      </div>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [claims, setHeaderActions, setHeaderLeft]);

  // Format Currency Helper
  const formatMoney = (val: number | undefined) => {
      if (val === undefined || val === null) return '-';
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate Summary from current page
  const summaryIncurred = claims.reduce((acc, c) => acc + (c.totalIncurredOurShare || 0), 0);
  const summaryPaid = claims.reduce((acc, c) => acc + (c.totalPaidOurShare || 0), 0);
  const summaryOutstanding = claims.reduce((acc, c) => acc + (c.outstandingOurShare || 0), 0);

  return (
    <div>
      {/* Sticky filter bar */}
      <div ref={filterRef} className="sticky top-0 z-30 bg-gray-50 sticky-filter-blur">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-3 min-h-[48px] overflow-visible">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              value={filters.searchTerm}
              onChange={e => handleFilterChange('searchTerm', e.target.value)}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            <Filter size={14}/> Filters
          </button>
          {/* Date Filter */}
          <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: '380px' }}>
          <select
            value={dateFilterField}
            onChange={(e) => setDateFilterField(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
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

          <button onClick={() => refetch()} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16}/>
          </button>

        </div>
      </div>
      </div>{/* end sticky filter bar */}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">

        {/* Expandable Filter Panel */}
        {showFilters && (
            <div className="p-4 bg-blue-50/50 border-b border-blue-100 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                    <select 
                        className="w-full p-2 border rounded-lg text-sm bg-white"
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
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Liability Type</label>
                    <select 
                        className="w-full p-2 border rounded-lg text-sm bg-white"
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
            <div className="py-20 text-center flex flex-col items-center justify-center text-gray-500">
                <Loader2 size={32} className="animate-spin mb-3 text-blue-600"/>
                Loading claims...
            </div>
        )}

        {/* Error State */}
        {isError && (
            <div className="py-12 text-center flex flex-col items-center justify-center text-red-500">
                <AlertOctagon size={32} className="mb-3"/>
                <p className="font-medium">Failed to load claims.</p>
                <button onClick={() => refetch()} className="mt-3 text-blue-600 hover:underline text-sm">Try Again</button>
            </div>
        )}

        {/* Table */}
        {!isLoading && !isError && (
            <>
                    <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
                        <thead className="bg-gray-50 sticky z-20 shadow-sm" style={{ top: `${filterHeight}px` }}>
                            <tr>
                                <th className="px-4 py-4 w-[120px]">Claim Ref</th>
                                <th className="px-4 py-4 w-[110px]">Policy Ref</th>
                                <th className="px-4 py-4 w-[80px]">Status</th>
                                <th className="px-4 py-4 w-[90px]">Loss Date</th>
                                <th className="px-4 py-4">Insured / Claimant</th>
                                <th className="px-4 py-4 text-right bg-gray-50 w-[110px]">Incurred (100%)</th>
                                <th className="px-4 py-4 text-right bg-blue-50/50 w-[120px]">Incurred (Ours)</th>
                                <th className="px-4 py-4 text-right bg-green-50/50 w-[110px]">Paid (Ours)</th>
                                <th className="px-4 py-4 text-right bg-red-50/50 w-[100px]">Outstanding</th>
                                <th className="px-1 py-3 w-10 bg-gray-50"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {claims.map(claim => (
                                <tr 
                                    key={claim.id} 
                                    onClick={() => navigate(`/claims/${claim.id}`)}
                                    className="hover:bg-blue-50 cursor-pointer transition-colors group"
                                >
                                    <td className="px-4 py-4 font-bold text-gray-900 truncate">
                                        {claim.claimNumber}
                                        {claim.liabilityType === 'INFORMATIONAL' && (
                                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-gray-600 border border-gray-300">INFO</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 font-mono text-blue-600 text-xs truncate">{claim.policyNumber}</td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                            claim.status === 'OPEN' ? 'bg-green-100 text-green-800' :
                                            claim.status === 'CLOSED' ? 'bg-gray-100 text-gray-600' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {claim.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-gray-600 text-xs">{formatDate(claim.lossDate)}</td>
                                    <td className="px-4 py-4 overflow-hidden">
                                        <div className="font-medium text-gray-900 truncate" title={claim.insuredName}>{claim.insuredName}</div>
                                        <div className="text-xs text-gray-500 truncate">{claim.claimantName}</div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-gray-600 bg-gray-50/30">
                                        {formatMoney(claim.totalIncurred100)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono font-bold text-gray-900 bg-blue-50/20">
                                        {formatMoney(claim.totalIncurredOurShare)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-green-700 bg-green-50/20">
                                        {formatMoney(claim.totalPaidOurShare)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-red-700 bg-red-50/20">
                                        {formatMoney(claim.outstandingOurShare)}
                                    </td>
                                    <td className="px-1 py-2 text-center w-10 relative" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === claim.id ? null : claim.id); }}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg">
                                            <MoreVertical size={16} className="text-gray-500" />
                                        </button>
                                        {openMenuId === claim.id && (
                                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[120px]">
                                                <button onClick={() => { setOpenMenuId(null); navigate(`/claims/${claim.id}`); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                                    <Eye size={14} /> View
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {claims.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-gray-400">
                                        <AlertOctagon size={48} className="mx-auto mb-4 opacity-20"/>
                                        No claims found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        
                        {/* Summary Row */}
                        {claims.length > 0 && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800 text-xs shadow-inner">
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wider">Page Summary:</td>
                                    <td className="px-4 py-3 text-right">-</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatMoney(summaryIncurred)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-green-800">{formatMoney(summaryPaid)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-red-800">{formatMoney(summaryOutstanding)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-1" />
                {isLoading && filters.page > 1 && (
                  <div className="flex justify-center py-4">
                    <RefreshCw size={20} className="animate-spin text-blue-600" />
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
