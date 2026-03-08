import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../services/db';
import { Policy, Currency, PolicyStatus, LegalEntity, Installment, PortfolioRow, PortfolioSource, PortfolioStatus, InwardReinsurance } from '../types';
import { ExcelService } from '../services/excel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DetailModal } from '../components/DetailModal';
import { MasterDetailModal } from '../components/MasterDetailModal';
import { EntityDetailModal } from '../components/EntityDetailModal';
import { FormModal } from '../components/FormModal';
import { PolicyFormContent } from '../components/PolicyFormContent';
import { InwardReinsuranceFormContent } from '../components/InwardReinsuranceFormContent';
import { formatDate } from '../utils/dateUtils';
import { DatePickerInput, toISODateString } from '../components/DatePickerInput';
import { CompactDateFilter } from '../components/CompactDateFilter';
import { Search, Edit, Trash2, Plus, Download, ArrowUpDown, ArrowUp, ArrowDown, FileText, CheckCircle, XCircle, AlertCircle, AlertTriangle, RefreshCw, Lock, Filter, Globe, Home, Briefcase, MoreVertical, Eye, Shield } from 'lucide-react';
import { usePageHeader } from '../context/PageHeaderContext';
import { parseSearchString } from '../utils/searchParser';

// --- HELPERS ---

const formatCompact = (value: number): string => {
  if (value >= 1e12) return (value / 1e12).toFixed(1) + 'T';
  if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
  return value.toFixed(0);
};

// --- MAPPER FUNCTIONS ---

const normalizeStatus = (status: string, isDeleted?: boolean): PortfolioStatus => {
  if (isDeleted) return 'Deleted';
  const s = status?.toUpperCase() || '';
  // Active statuses
  if (s.includes('ACTIVE') || s === 'BOUND' || s === 'SIGNED') return 'Active';
  // Pending statuses
  if (s.includes('PENDING') || s.includes('DRAFT') || s === 'QUOTED' || s === 'SENT') return 'Pending';
  // Cancelled/Closed statuses
  if (s.includes('CANCEL') || s.includes('NTU') || s.includes('TERMINATION') || s.includes('EXPIRED') || s === 'CLOSED' || s === 'DECLINED') return 'Cancelled';
  return 'Active';
};

const mapPolicyToPortfolioRow = (p: Policy): PortfolioRow => ({
  id: p.id,
  source: 'direct',
  referenceNumber: p.policyNumber,
  secondaryRef: p.secondaryPolicyNumber,
  slipNumber: p.slipNumber,
  agreementNumber: p.agreementNumber,
  bordereauNo: p.bordereauNo,
  accountingCode: p.accountingCode,
  referenceLink: p.referenceLink,

  // Parties
  insuredName: p.insuredName,
  insuredAddress: p.insuredAddress,
  cedantName: p.cedantName,
  brokerName: p.intermediaryName,
  borrower: p.borrower,
  retrocedent: p.retrocedent,
  performer: p.performer,

  // Classification
  classOfBusiness: p.classOfInsurance,
  typeOfInsurance: p.typeOfInsurance,
  riskCode: p.riskCode,
  insuredRisk: p.insuredRisk,
  industry: p.industry,
  territory: p.territory,
  city: p.city,

  // Financial
  currency: p.currency,
  exchangeRate: p.exchangeRate,
  exchangeRateUSD: p.exchangeRateUSD,
  equivalentUSD: p.equivalentUSD,
  sumInsured: p.sumInsured,
  sumInsuredNational: p.sumInsuredNational,
  limit: p.limitForeignCurrency || p.sumInsured,
  limitNational: p.limitNationalCurrency,
  excess: p.excessForeignCurrency,
  prioritySum: p.prioritySum,
  grossPremium: p.grossPremium,
  grossPremiumNational: p.grossPremiumNational,
  premiumNational: p.premiumNationalCurrency,
  netPremium: p.netPremium,
  netPremiumNational: p.netPremiumNational,
  fullPremiumForeign: p.fullPremiumForeign,
  fullPremiumNational: p.fullPremiumNational,
  ourShare: p.ourShare,

  // Rates and percentages
  premiumRate: p.premiumRate,
  commissionPercent: p.commissionPercent,
  commissionNational: p.commissionNational,
  taxPercent: p.taxPercent,

  // Reinsurance details
  reinsuranceType: p.reinsuranceType,
  sumReinsuredForeign: p.sumReinsuredForeign,
  sumReinsuredNational: p.sumReinsuredNational,
  hasOutwardReinsurance: p.hasOutwardReinsurance,
  reinsurerName: p.reinsurerName,
  cededShare: p.cededShare,
  cededPremium: p.cededPremiumForeign,
  reinsuranceCommission: p.reinsuranceCommission,
  netReinsurancePremium: p.netReinsurancePremium,

  // Treaty & AIC
  treatyPlacement: p.treatyPlacement,
  treatyPremium: p.treatyPremium,
  aicCommission: p.aicCommission,
  aicRetention: p.aicRetention,
  aicPremium: p.aicPremium,

  // Retrocession
  risksCount: p.risksCount,
  retroSumReinsured: p.retroSumReinsured,
  retroPremium: p.retroPremium,

  // Dates
  inceptionDate: p.inceptionDate,
  expiryDate: p.expiryDate,
  insuranceDays: p.insuranceDays,
  reinsuranceInceptionDate: p.reinsuranceInceptionDate,
  reinsuranceExpiryDate: p.reinsuranceExpiryDate,
  reinsuranceDays: p.reinsuranceDays,
  dateOfSlip: p.dateOfSlip,
  accountingDate: p.accountingDate,
  warrantyPeriod: p.warrantyPeriod,

  // Payment tracking
  premiumPaymentDate: p.premiumPaymentDate,
  actualPaymentDate: p.actualPaymentDate,
  receivedPremiumForeign: p.receivedPremiumForeign,
  receivedPremiumCurrency: p.receivedPremiumCurrency,
  receivedPremiumExchangeRate: p.receivedPremiumExchangeRate,
  receivedPremiumNational: p.receivedPremiumNational,
  numberOfSlips: p.numberOfSlips,

  // Status
  status: p.status,
  normalizedStatus: normalizeStatus(p.status, p.isDeleted),
  isDeleted: p.isDeleted,
  originalData: p,
});

const mapInwardReinsuranceToPortfolioRow = (ir: InwardReinsurance): PortfolioRow => ({
  id: ir.id,
  source: ir.origin === 'FOREIGN' ? 'inward-foreign' : 'inward-domestic',
  referenceNumber: ir.contractNumber,

  // Parties
  insuredName: ir.originalInsuredName || ir.cedantName,
  cedantName: ir.cedantName,
  brokerName: ir.brokerName,

  // Classification
  classOfBusiness: ir.classOfCover,
  typeOfInsurance: ir.typeOfCover,
  insuredRisk: ir.riskDescription,
  industry: ir.industry,
  territory: ir.territory,

  // Financial
  currency: ir.currency,
  limit: ir.limitOfLiability,
  excess: ir.deductible,
  prioritySum: ir.retention,
  grossPremium: ir.grossPremium,
  netPremium: ir.netPremium,
  ourShare: ir.ourShare,

  // Rates and percentages
  commissionPercent: ir.commissionPercent,

  // Reinsurance details
  reinsuranceType: ir.structure === 'NON_PROPORTIONAL' ? 'XL' : '%',

  // Dates
  inceptionDate: ir.inceptionDate,
  expiryDate: ir.expiryDate,

  // Status
  status: ir.status,
  normalizedStatus: normalizeStatus(ir.status, ir.isDeleted),
  isDeleted: ir.isDeleted,
  contractType: ir.type,
  structure: ir.structure,
  originalData: ir,
});


// LEGACY: Client-side consolidation (replaced by v_portfolio view)
// Kept as fallback in case view is unavailable
/*
const consolidateDirectPolicies = (policies: Policy[]): PortfolioRow[] => {
  const groups = new Map<string, Policy[]>();
  for (const p of policies) {
    const key = p.policyNumber || p.id;
    const existing = groups.get(key);
    if (existing) existing.push(p);
    else groups.set(key, [p]);
  }

  const result: PortfolioRow[] = [];
  for (const items of groups.values()) {
    const row = mapPolicyToPortfolioRow(items[0]);

    let gross = 0, net = 0, grossNat = 0, netNat = 0, fullFor = 0, fullNat = 0;
    for (const p of items) {
      gross += Number(p.grossPremium || 0);
      net += Number(p.netPremium || 0);
      grossNat += Number(p.grossPremiumNational || 0);
      netNat += Number(p.netPremiumNational || 0);
      fullFor += Number(p.fullPremiumForeign || 0);
      fullNat += Number(p.fullPremiumNational || 0);
    }
    row.grossPremium = gross;
    row.netPremium = net;
    row.grossPremiumNational = grossNat;
    row.netPremiumNational = netNat;
    row.fullPremiumForeign = fullFor;
    row.fullPremiumNational = fullNat;

    row.installmentCount = items.length;
    row.installments = items;
    result.push(row);
  }
  return result;
};

const consolidateInwardReinsurance = (contracts: InwardReinsurance[]): PortfolioRow[] => {
  const groups = new Map<string, InwardReinsurance[]>();
  for (const ir of contracts) {
    const key = ir.contractNumber || ir.id;
    const existing = groups.get(key);
    if (existing) existing.push(ir);
    else groups.set(key, [ir]);
  }

  const result: PortfolioRow[] = [];
  for (const items of groups.values()) {
    const row = mapInwardReinsuranceToPortfolioRow(items[0]);

    let gross = 0, net = 0;
    for (const ir of items) {
      gross += Number(ir.grossPremium || 0);
      net += Number(ir.netPremium || 0);
    }
    row.grossPremium = gross;
    row.netPremium = net;

    row.installmentCount = items.length;
    row.installments = items;
    result.push(row);
  }
  return result;
};
*/

// --- DASHBOARD COMPONENT ---

const Dashboard: React.FC = () => {
  const [portfolioData, setPortfolioData] = useState<PortfolioRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalSumInsured, setTotalSumInsured] = useState(0);
  const [totalGWP, setTotalGWP] = useState(0);
  const outwardByPolicyRef = useRef<Map<string, Policy[]>>(new Map());
  const outwardLoadedRef = useRef(false);
  const [, setOutwardReady] = useState(false); // triggers re-render when outward data loads
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Synchronized scroll refs for split header/body tables
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  // Kebab menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  // Source Filter State
  const [sourceFilter, setSourceFilter] = useState<'All' | PortfolioSource>('All');

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Expired' | 'Pending' | 'Cancelled' | 'Deleted'>('All');

  // Date Filter State
  const [dateFilterField, setDateFilterField] = useState<string>('inceptionDate');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // Infinite scroll
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);

  // Selection State
  const [selectedRow, setSelectedRow] = useState<PortfolioRow | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<LegalEntity | null>(null); // State for Entity Modal

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; source: PortfolioSource } | null>(null);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof Policy | string; direction: 'asc' | 'desc' }>({
    key: 'inceptionDate',
    direction: 'desc'
  });

  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();

  // Create Entity Confirmation State
  const [createEntityConfirm, setCreateEntityConfirm] = useState<{ isOpen: boolean; name: string }>({ isOpen: false, name: '' });

  // Policy Form Modal State
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  // Inward Reinsurance Form Modal State
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [editingInwardId, setEditingInwardId] = useState<string | null>(null);
  const [editingInwardOrigin, setEditingInwardOrigin] = useState<'FOREIGN' | 'DOMESTIC'>('FOREIGN');

  const fetchData = useCallback(async () => {
    const isFirstPage = currentPage === 1;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    try {
      // Map UI source filter to view's source values
      const sourceMap: Record<string, string> = {
        'All': 'all',
        'direct': 'direct',
        'inward-foreign': 'inward-foreign',
        'inward-domestic': 'inward-domestic',
      };

      const viewSource = sourceMap[sourceFilter] || 'all';

      // Handle "Deleted" status: v_portfolio excludes deleted records
      if (statusFilter === 'Deleted') {
        setPortfolioData([]);
        setTotalCount(0);
        setHasMore(false);
        setLoading(false);
        return;
      }

      // Fetch view data and slips in parallel when source is 'All' and first page
      const filters = parseSearchString(searchTerm);
      const portfolioPromise = DB.getPortfolioPage({
        page: currentPage - 1, // API is 0-indexed, UI is 1-indexed
        pageSize: PAGE_SIZE,
        sourceFilter: viewSource,
        statusFilter: statusFilter,
        searchFilters: filters.length > 0 ? filters : undefined,
        sortField: sortConfig.key,
        sortDirection: sortConfig.direction,
        dateField: (dateFrom || dateTo) ? dateFilterField : undefined,
        dateFrom: toISODateString(dateFrom) || undefined,
        dateTo: toISODateString(dateTo) || undefined,
      });
      const result = await portfolioPromise;

      // Map view columns to PortfolioRow format
      const today = new Date().toISOString().split('T')[0];
      const rows: PortfolioRow[] = result.rows.map((row: any) => ({
        id: row.id,
        source: row.source as PortfolioSource,
        referenceNumber: row.reference_number || '',
        insuredName: row.insured_name || '',
        brokerName: row.broker_name || '',
        classOfBusiness: row.class_of_business || '',
        territory: row.territory || '',
        currency: row.currency || 'USD',
        sumInsuredNational: Number(row.sum_insured_national || 0),
        grossPremium: Number(row.gross_premium || 0),
        netPremium: Number(row.net_premium || 0),
        ourShare: Number(row.our_share || 0),
        inceptionDate: row.inception_date || '',
        expiryDate: row.expiry_date || '',
        normalizedStatus: (row.status?.toUpperCase()?.includes('ACTIVE') && row.expiry_date && row.expiry_date < today)
          ? 'Expired' as PortfolioStatus
          : normalizeStatus(row.status),
        status: row.status || '',
        installmentCount: Number(row.installment_count || 1),
        cedantName: row.cedant_name || '',
        dateOfSlip: row.date_of_slip || '',
        accountingDate: row.accounting_date || '',
        reinsuranceInceptionDate: row.reinsurance_inception_date || '',
        reinsuranceExpiryDate: row.reinsurance_expiry_date || '',
        premiumPaymentDate: row.premium_payment_date || '',
        actualPaymentDate: row.actual_payment_date || '',
        originalData: null as any,
      }));

      setHasMore(rows.length >= PAGE_SIZE);

      if (isFirstPage) {
        setPortfolioData(rows);
        setTotalCount(result.totalCount);
        setTotalSumInsured(result.totalSumInsured);
        setTotalGWP(result.totalGWP);
      } else {
        // Subsequent pages: append rows
        setPortfolioData(prev => [...prev, ...rows]);
      }
    } catch (e) {
      console.error("Failed to fetch portfolio data", e);
    } finally {
      if (isFirstPage) setLoading(false);
      else setLoadingMore(false);
    }

    // Load outward data in background (only needed for modal drill-down)
    if (!outwardLoadedRef.current) {
      DB.getOutwardPolicies().then(outwardPolicies => {
        const outwardMap = new Map<string, Policy[]>();
        console.log('[Ceded%] Outward policies loaded:', outwardPolicies.length);
        if (outwardPolicies.length > 0) {
          const sample = outwardPolicies.slice(0, 3);
          sample.forEach((p, i) => console.log(`[Ceded%] Sample ${i}: policyNumber=${p.policyNumber}, secondaryPolicyNumber=${p.secondaryPolicyNumber}, channel=${p.channel}, reinsurerName=${p.reinsurerName}, cededShare=${p.cededShare}`));
        }
        for (const p of outwardPolicies) {
          const key = p.secondaryPolicyNumber || p.policyNumber || p.id;
          const existing = outwardMap.get(key);
          if (existing) existing.push(p);
          else outwardMap.set(key, [p]);
        }
        console.log('[Ceded%] Outward map size:', outwardMap.size, 'keys sample:', Array.from(outwardMap.keys()).slice(0, 5));
        outwardByPolicyRef.current = outwardMap;
        outwardLoadedRef.current = true;
        setOutwardReady(true);
      });
    }
  }, [currentPage, sourceFilter, statusFilter, searchTerm, sortConfig, dateFilterField, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const initiateDelete = (e: React.MouseEvent, row: PortfolioRow) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id: row.id, source: row.source });
  };

  const handleEdit = (e: React.MouseEvent, row: PortfolioRow) => {
    e.preventDefault();
    e.stopPropagation();
    // Open modal based on source type
    switch (row.source) {
      case 'direct':
        setEditingPolicyId(row.id);
        setShowPolicyModal(true);
        break;
      case 'inward-foreign':
        setEditingInwardId(row.id);
        setEditingInwardOrigin('FOREIGN');
        setShowInwardModal(true);
        break;
      case 'inward-domestic':
        setEditingInwardId(row.id);
        setEditingInwardOrigin('DOMESTIC');
        setShowInwardModal(true);
        break;
    }
  };

  const handleWording = (e: React.MouseEvent, row: PortfolioRow) => {
    e.preventDefault();
    e.stopPropagation();
    if (row.source === 'direct') {
      navigate(`/wording/${row.id}`);
    }
  };

  const handleRowClick = async (row: PortfolioRow) => {
    // Open MasterDetailModal for direct and inward rows
    switch (row.source) {
      case 'direct':
      case 'inward-foreign':
      case 'inward-domestic':
        // Lazy-load installment data if not already present
        if (!row.installments) {
          const installments = await DB.getInstallmentsByRef(row.referenceNumber, row.source);
          row.installments = installments;
          row.installmentCount = installments.length || row.installmentCount;
        }
        setSelectedRow(row);
        break;
    }
  };

  const handleRestore = async (e: React.MouseEvent, row: PortfolioRow) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.role !== 'Super Admin') {
        toast.warning("Only Super Admins can restore deleted records.");
        return;
    }
    try {
        setPortfolioData(prev => prev.map(p => p.id === row.id ? { ...p, isDeleted: false, normalizedStatus: 'Active' as PortfolioStatus } : p));
        // Restore based on source type
        if (row.source === 'direct') {
          await DB.restorePolicy(row.id);
        }
        // Add restore methods for other sources if available
    } catch (err) {
        console.error("Restore failed", err);
        fetchData();
    }
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      try {
        setPortfolioData(prev => prev.map(p => p.id === deleteTarget.id ? { ...p, isDeleted: true, normalizedStatus: 'Deleted' as PortfolioStatus } : p));
        // Delete based on source type
        if (deleteTarget.source === 'direct') {
          await DB.deletePolicy(deleteTarget.id);
        }
        // Add delete methods for other sources if available
      } catch (err) {
        console.error("Delete failed", err);
        fetchData();
      } finally {
        setDeleteTarget(null);
      }
    }
  };

  // Helper to find and open entity
  const handleEntityClick = async (e: React.MouseEvent, name?: string) => {
      e.stopPropagation();
      if (!name) return;
      const entity = await DB.findLegalEntityByName(name);
      if (entity) {
          setSelectedEntity(entity);
      } else {
          // Prompt to create
          setCreateEntityConfirm({ isOpen: true, name });
      }
  };

  const handleSort = (key: keyof Policy | string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setPortfolioData([]);
    setCurrentPage(1);
  };

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

  // sortedRows is used throughout the template — alias to portfolioData
  const sortedRows = portfolioData;
  const paginatedRows = portfolioData;

  // Debounced search handler
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchTerm(value);
      setPortfolioData([]);
      setCurrentPage(1);
    }, 300);
  };

  // Reset page and rows when source or status filters change
  const handleSourceFilterChange = (filter: 'All' | PortfolioSource) => {
    setSourceFilter(filter);
    setPortfolioData([]);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (filter: 'All' | 'Active' | 'Expired' | 'Pending' | 'Cancelled' | 'Deleted') => {
    setStatusFilter(filter);
    setPortfolioData([]);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (field: string, from: Date | null, to: Date | null) => {
    setDateFilterField(field);
    setDateFrom(from);
    setDateTo(to);
    setPortfolioData([]);
    setCurrentPage(1);
  };

  const formatMoney = (amount: number | undefined, currency: Currency | string) => {
    if (amount === undefined || amount === null) return '-';
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount);
    } catch {
        return `${amount}`;
    }
  };

  const formatNumber = (val: number | undefined) => {
      if (val === undefined || val === null) return '-';
      return new Intl.NumberFormat('en-US').format(val);
  }

  const handleExport = async () => {
    await ExcelService.exportPortfolio(sortedRows);
  };

  // Stats badges in header left, Export button in header right
  useEffect(() => {
    setHeaderLeft(
      <>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-500 font-medium">Policies</span>
          <span className="text-sm font-bold text-slate-800">{totalCount.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-blue-600 font-medium">Sum Insured</span>
          <span className="text-sm font-bold text-blue-800">{formatCompact(totalSumInsured)}</span>
          <span className="text-[10px] text-blue-400 font-medium">USD</span>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-emerald-600 font-medium">GWP</span>
          <span className="text-sm font-bold text-emerald-800">{formatCompact(totalGWP)}</span>
          <span className="text-[10px] text-emerald-400 font-medium">USD</span>
        </div>
      </>
    );
    setHeaderActions(
      <button
        onClick={() => ExcelService.exportPortfolio(sortedRows)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 shadow-sm transition-all whitespace-nowrap"
      >
        <Download size={16} /> Export
      </button>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [sortedRows, setHeaderActions, setHeaderLeft, totalCount, totalSumInsured, totalGWP]);

  const SortableHeader = ({ label, sortKey, className = "", style }: { label: string, sortKey: string, className?: string, style?: React.CSSProperties }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th
        className={`px-3 py-3 border-b border-gray-200 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group select-none whitespace-nowrap bg-gray-50 ${className}`}
        onClick={() => handleSort(sortKey)}
        style={style}
      >
        <div className="flex items-center gap-1">
          {label}
          <div className="text-gray-400 group-hover:text-gray-600">
             {isActive ? (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>) : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50"/>}
          </div>
        </div>
      </th>
    );
  };

  const SourceBadge = ({ source }: { source: PortfolioSource }) => {
      switch (source) {
        case 'direct':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              <Briefcase size={10} /> DIRECT
            </span>
          );
        case 'inward-foreign':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
              <Globe size={10} /> IN-FOREIGN
            </span>
          );
        case 'inward-domestic':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              <Home size={10} /> IN-DOMESTIC
            </span>
          );
        default:
          return <span className="text-[10px] text-gray-500">{source}</span>;
      }
  };

  return (
    <div>
      {/* Sticky group: filter bar + table header */}
      <div className="sticky top-0 z-30 bg-gray-50 sticky-filter-blur">
      {/* Row 1: All Filters in One Row */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-3 min-h-[48px] overflow-visible">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search... (try broker:Howden or class:Fire)"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Source Filter Dropdown */}
        <select
          value={sourceFilter}
          onChange={(e) => handleSourceFilterChange(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
        >
          <option value="All">All Sources</option>
          <option value="direct">Direct</option>
          <option value="inward-foreign">In-Foreign</option>
          <option value="inward-domestic">In-Domestic</option>
        </select>

        {/* Status Filter Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
          <option value="Pending">Pending</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Deleted">Deleted</option>
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
          <option value="premiumPaymentDate">Prem. Payment</option>
          <option value="actualPaymentDate">Actual Payment</option>
          <option value="reinsuranceInceptionDate">RI Inception</option>
          <option value="reinsuranceExpiryDate">RI Expiry</option>
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
          onClick={() => fetchData()}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
        </button>
      </div>
      </div>
        {/* Header table — inside sticky group, synced with body scroll */}
        <div ref={headerScrollRef} className="border-x border-t border-gray-200 mt-1 overflow-hidden rounded-t-lg">
          <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', minWidth: '1280px' }}>
                <colgroup>
                    <col style={{ width: '80px' }} />   {/* STATUS */}
                    <col style={{ width: '90px' }} />   {/* Source */}
                    <col style={{ width: '130px' }} />  {/* Ref No */}
                    <col style={{ width: '180px' }} />  {/* Insured / Cedant */}
                    <col style={{ width: '120px' }} />  {/* Broker */}
                    <col style={{ width: '120px' }} />  {/* Class */}
                    <col style={{ width: '100px' }} />  {/* Territory */}
                    <col style={{ width: '110px' }} />  {/* Sum Insured */}
                    <col style={{ width: '110px' }} />  {/* Gross Prem */}
                    <col style={{ width: '60px' }} />   {/* Our % */}
                    <col style={{ width: '70px' }} />   {/* Ceded % */}
                    <col style={{ width: '90px' }} />   {/* Inception */}
                    <col style={{ width: '90px' }} />   {/* Expiry */}
                    <col style={{ width: '40px' }} />   {/* Actions */}
                </colgroup>
                <thead className="bg-gray-50 shadow-sm">
                        <tr>
                            <th className="px-2 py-3 border-b border-gray-200 text-center font-semibold text-gray-600 text-xs bg-gray-50">STATUS</th>
                            <SortableHeader label="Source" sortKey="source" />
                            <SortableHeader label="Ref No" sortKey="referenceNumber" />
                            <SortableHeader label="Insured / Cedant" sortKey="insuredName" />
                            <SortableHeader label="Broker" sortKey="brokerName" />
                            <SortableHeader label="Class" sortKey="classOfBusiness" />
                            <SortableHeader label="Territory" sortKey="territory" />
                            <SortableHeader label="Sum Insured" sortKey="sumInsuredNational" className="text-right" />
                            <SortableHeader label="Gross Prem" sortKey="grossPremium" className="text-right" />
                            <SortableHeader label="Our %" sortKey="ourShare" className="text-right" />
                            <th className="px-2 py-3 border-b border-gray-200 font-semibold text-gray-600 text-xs uppercase tracking-wider whitespace-nowrap bg-gray-50 text-right">Ceded %</th>
                            <SortableHeader label="Inception" sortKey="inceptionDate" />
                            <SortableHeader label="Expiry" sortKey="expiryDate" />
                            <th className="px-1 py-3 border-b border-gray-200 bg-gray-50"></th>
                        </tr>
                </thead>
          </table>
        </div>
      </div>{/* end sticky group (filter bar + header) */}

      {/* Body table — scrollable, horizontal scroll synced to header */}
      <div
        ref={bodyScrollRef}
        className="bg-white border border-gray-200 border-t-0 rounded-b-xl shadow-sm overflow-x-auto -mt-px"
        onScroll={() => {
          if (headerScrollRef.current && bodyScrollRef.current) {
            headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
          }
        }}
      >
            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', minWidth: '1280px' }}>
                <colgroup>
                    <col style={{ width: '80px' }} />   {/* STATUS */}
                    <col style={{ width: '90px' }} />   {/* Source */}
                    <col style={{ width: '130px' }} />  {/* Ref No */}
                    <col style={{ width: '180px' }} />  {/* Insured / Cedant */}
                    <col style={{ width: '120px' }} />  {/* Broker */}
                    <col style={{ width: '120px' }} />  {/* Class */}
                    <col style={{ width: '100px' }} />  {/* Territory */}
                    <col style={{ width: '110px' }} />  {/* Sum Insured */}
                    <col style={{ width: '110px' }} />  {/* Gross Prem */}
                    <col style={{ width: '60px' }} />   {/* Our % */}
                    <col style={{ width: '70px' }} />   {/* Ceded % */}
                    <col style={{ width: '90px' }} />   {/* Inception */}
                    <col style={{ width: '90px' }} />   {/* Expiry */}
                    <col style={{ width: '40px' }} />   {/* Actions */}
                </colgroup>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {paginatedRows.map(row => {
                        const rowClass = row.isDeleted ? 'bg-gray-50 opacity-75' : 'hover:bg-blue-50/30';
                        // Compute ceded % from outward reinsurance data (matches both direct and inward rows)
                        // Deduplicate: one share per reinsurer (installments repeat the same cededShare)
                        const outwardForRow = outwardByPolicyRef.current.get(row.referenceNumber) || [];
                        if (outwardForRow.length > 0 && paginatedRows.indexOf(row) < 3) console.log(`[Ceded%] Row ${row.referenceNumber}: found ${outwardForRow.length} outward policies, cededShares:`, outwardForRow.map(op => op.cededShare));
                        const uniqueReinsurers = new Map<string, number>();
                        for (const op of outwardForRow) {
                          const name = op.reinsurerName || op.intermediaryName || op.insuredName || 'Unknown';
                          const raw = Number(op.cededShare || 0);
                          const share = raw <= 1 ? raw * 100 : raw;
                          if (!uniqueReinsurers.has(name) || share > (uniqueReinsurers.get(name) || 0)) {
                            uniqueReinsurers.set(name, share);
                          }
                        }
                        const cededPct = Array.from(uniqueReinsurers.values()).reduce((a, b) => a + b, 0);

                        return (
                        <tr
                            key={`${row.source}-${row.id}`}
                            onClick={() => handleRowClick(row)}
                            className={`group transition-colors cursor-pointer ${rowClass}`}
                        >
                                    <td className="px-2 py-3 text-center overflow-hidden">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                          row.normalizedStatus === 'Active' ? 'text-green-700 bg-green-100' :
                                          row.normalizedStatus === 'Expired' ? 'text-orange-700 bg-orange-100' :
                                          row.normalizedStatus === 'Pending' ? 'text-amber-700 bg-amber-100' :
                                          row.normalizedStatus === 'Cancelled' ? 'text-red-700 bg-red-100' :
                                          'text-gray-600 bg-gray-100'
                                        }`}>
                                          {row.isDeleted ? <><Trash2 size={10}/> DELETED</> : row.normalizedStatus.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-2 py-3 overflow-hidden">
                                        <SourceBadge source={row.source} />
                                    </td>
                                    <td className="px-2 py-3 font-mono text-xs text-blue-600 font-medium truncate overflow-hidden">
                                        {row.referenceNumber}
                                    </td>
                                    <td className="px-2 py-3 font-medium text-gray-900 overflow-hidden">
                                        {row.cedantName ? (
                                            <div className="flex flex-col min-w-0">
                                                <span
                                                    className="hover:text-blue-600 hover:underline cursor-pointer truncate"
                                                    onClick={(e) => handleEntityClick(e, row.cedantName)}
                                                >
                                                    {row.cedantName}
                                                </span>
                                                <span className="text-[10px] text-gray-500 flex gap-1 truncate">
                                                    Orig:
                                                    <span
                                                        className="hover:text-blue-600 hover:underline cursor-pointer truncate"
                                                        onClick={(e) => handleEntityClick(e, row.insuredName)}
                                                    >
                                                        {row.insuredName}
                                                    </span>
                                                </span>
                                            </div>
                                        ) : (
                                            <span
                                                className="hover:text-blue-600 hover:underline cursor-pointer truncate block"
                                                onClick={(e) => handleEntityClick(e, row.insuredName)}
                                            >
                                                {row.insuredName}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-2 py-3 text-xs text-gray-600 truncate overflow-hidden">
                                        {row.brokerName ? (
                                            <span
                                                className="text-blue-600 hover:underline cursor-pointer"
                                                onClick={(e) => handleEntityClick(e, row.brokerName)}
                                            >
                                                {row.brokerName}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic">-</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-3 text-gray-600 text-xs truncate overflow-hidden">
                                        {row.classOfBusiness}
                                    </td>
                                    <td className="px-2 py-3 text-gray-600 text-xs truncate overflow-hidden">
                                        {row.territory || '-'}
                                    </td>
                                    <td className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap">
                                        {row.sumInsuredNational ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(row.sumInsuredNational) : '-'}
                                    </td>
                                    <td className="px-2 py-3 text-right font-bold text-gray-900 bg-gray-50/50 whitespace-nowrap">
                                        {formatMoney(row.grossPremium, row.currency)}
                                    </td>
                                    <td className="px-2 py-3 text-right text-xs whitespace-nowrap">
                                        {row.ourShare}%
                                    </td>
                                    <td className="px-2 py-3 text-right text-xs whitespace-nowrap">
                                        {cededPct > 100 ? (
                                          <span className="font-medium text-red-600">100%+</span>
                                        ) : cededPct > 0 ? (
                                          <span className={`font-medium ${cededPct >= 100 ? 'text-green-700' : cededPct >= 50 ? 'text-blue-700' : 'text-amber-700'}`}>
                                            {cededPct.toFixed(2)}%
                                          </span>
                                        ) : (
                                          <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-3 text-xs text-gray-600 whitespace-nowrap">
                                        {formatDate(row.inceptionDate)}
                                    </td>
                                    <td className="px-2 py-3 text-xs text-gray-600 whitespace-nowrap">
                                        {formatDate(row.expiryDate)}
                                    </td>

                                    <td className="px-1 py-2 text-center relative overflow-hidden" onClick={e => e.stopPropagation()}>
                                        {row.isDeleted ? (
                                            user?.role === 'Super Admin' && row.source === 'direct' && (
                                                <button onClick={(e) => handleRestore(e, row)} title="Restore" className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg">
                                                    <RefreshCw size={14}/>
                                                </button>
                                            )
                                        ) : (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === `${row.source}-${row.id}` ? null : `${row.source}-${row.id}`); }}
                                                    className="p-1.5 hover:bg-gray-100 rounded-lg">
                                                    <MoreVertical size={16} className="text-gray-500" />
                                                </button>
                                                {openMenuId === `${row.source}-${row.id}` && (
                                                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[120px]">
                                                        <button onClick={() => { setOpenMenuId(null); handleRowClick(row); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                                            <Eye size={14} /> View
                                                        </button>
                                                        <button onClick={(e) => { setOpenMenuId(null); handleEdit(e as any, row); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                                            <Edit size={14} /> Edit
                                                        </button>
                                                        {row.source === 'direct' && (
                                                            <>
                                                                <button onClick={(e) => { setOpenMenuId(null); handleWording(e as any, row); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                                                    <FileText size={14} /> Wording
                                                                </button>
                                                                <button onClick={(e) => { setOpenMenuId(null); initiateDelete(e as any, row); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                                                                    <Trash2 size={14} /> Delete
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </td>
                        </tr>
                    )})}

                    {!loading && paginatedRows.length === 0 && (
                        <tr>
                            <td colSpan={14} className="py-12 text-center text-gray-400">
                                <div className="flex flex-col items-center gap-2">
                                    <Filter size={32} className="opacity-20"/>
                                    {statusFilter === 'Deleted' ? (
                                        <p>Deleted records are excluded from the consolidated view.</p>
                                    ) : (
                                        <>
                                            <p>No records found matching your criteria.</p>
                                            {totalCount === 0 && (
                                                <button
                                                    onClick={fetchData}
                                                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    <RefreshCw size={14} /> Retry
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <RefreshCw size={20} className="animate-spin text-blue-600" />
              </div>
            )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Record?"
        message="Are you sure you want to delete this record? It will be moved to the Deleted Records bin."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
        confirmText="Delete"
      />

      <ConfirmDialog
        isOpen={createEntityConfirm.isOpen}
        title="Entity Not Found"
        message={`Entity "${createEntityConfirm.name}" not found in database. Would you like to create it?`}
        onConfirm={() => { setCreateEntityConfirm({ isOpen: false, name: '' }); navigate('/entities/new'); }}
        onCancel={() => setCreateEntityConfirm({ isOpen: false, name: '' })}
        variant="info"
        confirmText="Create Entity"
      />

      {selectedRow && (selectedRow.source === 'direct' || selectedRow.source === 'inward-foreign' || selectedRow.source === 'inward-domestic') && (
          <MasterDetailModal
            row={selectedRow}
            outwardPolicies={outwardByPolicyRef.current.get(selectedRow.referenceNumber) || []}
            onClose={() => setSelectedRow(null)}
            onRefresh={fetchData}
            onEdit={(r) => {
              setSelectedRow(null);
              if (r.source === 'direct') {
                setEditingPolicyId(r.id);
                setShowPolicyModal(true);
              } else if (r.source === 'inward-foreign') {
                setEditingInwardId(r.id);
                setEditingInwardOrigin('FOREIGN');
                setShowInwardModal(true);
              } else if (r.source === 'inward-domestic') {
                setEditingInwardId(r.id);
                setEditingInwardOrigin('DOMESTIC');
                setShowInwardModal(true);
              }
            }}
          />
      )}

      <EntityDetailModal
        entity={selectedEntity}
        onClose={() => setSelectedEntity(null)}
        onEdit={(id) => { setSelectedEntity(null); navigate(`/entities/edit/${id}`); }}
      />

      {/* Policy Form Modal */}
      <FormModal
        isOpen={showPolicyModal}
        onClose={() => {
          setShowPolicyModal(false);
          setEditingPolicyId(null);
        }}
        title={editingPolicyId ? 'Edit Policy' : 'New Policy Record'}
        subtitle={editingPolicyId ? 'Editing policy' : 'Create a new insurance policy'}
      >
        <PolicyFormContent
          id={editingPolicyId || undefined}
          onSave={() => {
            setShowPolicyModal(false);
            setEditingPolicyId(null);
            fetchData();
          }}
          onCancel={() => {
            setShowPolicyModal(false);
            setEditingPolicyId(null);
          }}
        />
      </FormModal>

      {/* Inward Reinsurance Form Modal */}
      <FormModal
        isOpen={showInwardModal}
        onClose={() => {
          setShowInwardModal(false);
          setEditingInwardId(null);
        }}
        title={editingInwardId ? 'Edit Inward Reinsurance' : 'New Inward Reinsurance'}
        subtitle={editingInwardOrigin === 'FOREIGN' ? 'Foreign Contract' : 'Domestic Contract'}
      >
        <InwardReinsuranceFormContent
          id={editingInwardId || undefined}
          origin={editingInwardOrigin}
          onSave={() => {
            setShowInwardModal(false);
            setEditingInwardId(null);
            fetchData();
          }}
          onCancel={() => {
            setShowInwardModal(false);
            setEditingInwardId(null);
          }}
        />
      </FormModal>

    </div>
  );
};

export default Dashboard;
