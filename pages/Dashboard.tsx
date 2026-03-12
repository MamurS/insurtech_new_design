import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../services/db';
import { Policy, Currency, PolicyStatus, LegalEntity, Installment, PortfolioRow, PortfolioSource, PortfolioStatus, InwardReinsurance } from '../types';
import { ExcelService } from '../services/excel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DetailModal } from '../components/DetailModal';
import { EntityDetailModal } from '../components/EntityDetailModal';
import { formatDate } from '../utils/dateUtils';
import { DatePickerInput, toISODateString } from '../components/DatePickerInput';
import { CompactDateFilter } from '../components/CompactDateFilter';
import { Search, Edit, Trash2, Plus, Download, ArrowUpDown, ArrowUp, ArrowDown, FileText, CheckCircle, XCircle, AlertCircle, AlertTriangle, RefreshCw, Lock, Filter, Globe, Home, Briefcase, MoreVertical, Eye, Shield } from 'lucide-react';
import { usePageHeader } from '../context/PageHeaderContext';
import { parseSearchString } from '../utils/searchParser';
import { useTheme } from '../theme/useTheme';
import SidePanel, { PanelField } from '../components/ui/SidePanel';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

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
  const { t } = useTheme();
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
  const [selectedRowForPanel, setSelectedRowForPanel] = useState<PortfolioRow | null>(null);
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
    // Navigate to full-page form based on source type
    switch (row.source) {
      case 'direct':
        navigate(`/edit/${row.id}`);
        break;
      case 'inward-foreign':
        navigate(`/inward-reinsurance/foreign/edit/${row.id}`);
        break;
      case 'inward-domestic':
        navigate(`/inward-reinsurance/domestic/edit/${row.id}`);
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
    // Toggle side panel: clicking same row closes it, different row opens it
    if (selectedRowForPanel && selectedRowForPanel.id === row.id && selectedRowForPanel.source === row.source) {
      setSelectedRowForPanel(null);
      return;
    }
    setSelectedRowForPanel(row);
  };

  const handleViewFullDetail = async (row: PortfolioRow) => {
    switch (row.source) {
      case 'direct':
        navigate(`/edit/${row.id}`);
        break;
      case 'inward-foreign':
        navigate(`/inward-reinsurance/foreign/view/${row.id}`);
        break;
      case 'inward-domestic':
        navigate(`/inward-reinsurance/domestic/view/${row.id}`);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '4px 12px' }}>
          <span style={{ fontSize: 11, color: t.text4, fontWeight: 500 }}>Policies</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text1 }}>{totalCount.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: t.accentMuted, border: `1px solid ${t.accent}33`, borderRadius: 8, padding: '4px 12px' }}>
          <span style={{ fontSize: 11, color: t.accent, fontWeight: 500 }}>Sum Insured</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{formatCompact(totalSumInsured)}</span>
          <span style={{ fontSize: 11, color: t.text4, fontWeight: 500 }}>USD</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: t.successBg, border: `1px solid ${t.success}33`, borderRadius: 8, padding: '4px 12px' }}>
          <span style={{ fontSize: 11, color: t.success, fontWeight: 500 }}>GWP</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.success }}>{formatCompact(totalGWP)}</span>
          <span style={{ fontSize: 11, color: t.text4, fontWeight: 500 }}>USD</span>
        </div>
      </>
    );
    setHeaderActions(
      <Button variant="primary" icon={<Download size={16} />} onClick={() => ExcelService.exportPortfolio(sortedRows)} style={{ whiteSpace: 'nowrap', background: t.success }}>
        Export
      </Button>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [sortedRows, setHeaderActions, setHeaderLeft, totalCount, totalSumInsured, totalGWP]);

  const SortableHeader = ({ label, sortKey, className = "", style }: { label: string, sortKey: string, className?: string, style?: React.CSSProperties }) => {
    const isActive = sortConfig.key === sortKey;
    // Parse className for text-right
    const textAlign = className.includes('text-right') ? 'right' as const : undefined;
    return (
      <th
        className="transition-colors group select-none"
        onClick={() => handleSort(sortKey)}
        style={{ padding: '12px 12px', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `1px solid ${t.border}`, color: t.text4, background: t.bgPanel, textAlign, ...style }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {label}
          <div style={{ color: isActive ? t.accent : t.text5 }}>
             {isActive ? (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>) : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50"/>}
          </div>
        </div>
      </th>
    );
  };

  const SourceBadge = ({ source }: { source: PortfolioSource }) => {
      const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 };
      switch (source) {
        case 'direct':
          return (
            <span style={{ ...pill, color: t.accent, background: t.accentMuted, border: `1px solid ${t.accent}33` }}>
              <Briefcase size={10} /> DIRECT
            </span>
          );
        case 'inward-foreign':
          return (
            <span style={{ ...pill, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <Globe size={10} /> IN-FOREIGN
            </span>
          );
        case 'inward-domestic':
          return (
            <span style={{ ...pill, color: t.success, background: t.successBg, border: `1px solid ${t.success}33` }}>
              <Home size={10} /> IN-DOMESTIC
            </span>
          );
        default:
          return <span style={{ fontSize: 11, color: t.text4 }}>{source}</span>;
      }
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Sticky group: filter bar + table header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: t.bgApp }}>
      {/* Row 1: All Filters in One Row */}
      <div style={{ background: t.bgPanel, borderRadius: 10, boxShadow: t.shadow, border: `1px solid ${t.border}`, padding: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, minHeight: 48, overflow: 'visible' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.text4, zIndex: 1 }} />
          <Input
            type="text"
            placeholder="Search... (try broker:Howden or class:Fire)"
            value={searchInput}
            onChange={(val) => handleSearchChange(val)}
            style={{ paddingLeft: 32, fontSize: 12 }}
          />
        </div>

        {/* Source Filter Dropdown */}
        <select
          value={sourceFilter}
          onChange={(e) => handleSourceFilterChange(e.target.value as any)}
          style={{ padding: '8px 12px', border: `1px solid ${t.border}`, borderRadius: 8, background: t.bgInput, color: t.text1, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
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
          style={{ padding: '8px 12px', border: `1px solid ${t.border}`, borderRadius: 8, background: t.bgInput, color: t.text1, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
          <option value="Pending">Pending</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Deleted">Deleted</option>
        </select>

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, width: 380 }}>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchData()}
          title="Refresh"
          style={{ padding: 8, border: 'none' }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={{ color: loading ? t.accent : t.text4 }} />
        </Button>
      </div>
      </div>
        {/* Header table — inside sticky group, synced with body scroll */}
        <div ref={headerScrollRef} style={{ border: `1px solid ${t.border}`, borderBottom: 'none', marginTop: 4, overflow: 'hidden', borderRadius: '10px 10px 0 0' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1280 }}>
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
                <thead>
                        <tr>
                            <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${t.border}`, color: t.text4, background: t.bgPanel }}>STATUS</th>
                            <SortableHeader label="Source" sortKey="source" />
                            <SortableHeader label="Ref No" sortKey="referenceNumber" />
                            <SortableHeader label="Insured / Cedant" sortKey="insuredName" />
                            <SortableHeader label="Broker" sortKey="brokerName" />
                            <SortableHeader label="Class" sortKey="classOfBusiness" />
                            <SortableHeader label="Territory" sortKey="territory" />
                            <SortableHeader label="Sum Insured" sortKey="sumInsuredNational" className="text-right" />
                            <SortableHeader label="Gross Prem" sortKey="grossPremium" className="text-right" />
                            <SortableHeader label="Our %" sortKey="ourShare" className="text-right" />
                            <th style={{ padding: '12px 8px', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', textAlign: 'right', borderBottom: `1px solid ${t.border}`, color: t.text4, background: t.bgPanel }}>Ceded %</th>
                            <SortableHeader label="Inception" sortKey="inceptionDate" />
                            <SortableHeader label="Expiry" sortKey="expiryDate" />
                            <th style={{ padding: '12px 4px', borderBottom: `1px solid ${t.border}`, background: t.bgPanel }}></th>
                        </tr>
                </thead>
          </table>
        </div>
      </div>{/* end sticky group (filter bar + header) */}

      {/* Grid container: table + optional side panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedRowForPanel ? '1fr 360px' : '1fr', transition: 'grid-template-columns 0.2s ease' }}>
      {/* Body table — scrollable, horizontal scroll synced to header */}
      <div
        ref={bodyScrollRef}
        style={{ overflowX: 'auto', background: t.bgPanel, border: `1px solid ${t.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', boxShadow: t.shadow, marginTop: -1, minWidth: 0 }}
        onScroll={() => {
          if (headerScrollRef.current && bodyScrollRef.current) {
            headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
          }
        }}
      >
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1280 }}>
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
                <tbody style={{ fontSize: 14 }}>
                    {paginatedRows.map(row => {
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
                            className="group transition-colors"
                            style={{
                              borderBottom: `1px solid ${t.borderS}`,
                              opacity: row.isDeleted ? 0.6 : 1,
                              cursor: 'pointer',
                              background: selectedRowForPanel && selectedRowForPanel.id === row.id && selectedRowForPanel.source === row.source ? t.bgActive : undefined,
                            }}
                            onMouseEnter={e => { if (!(selectedRowForPanel && selectedRowForPanel.id === row.id && selectedRowForPanel.source === row.source)) e.currentTarget.style.background = t.bgHover; }}
                            onMouseLeave={e => { e.currentTarget.style.background = selectedRowForPanel && selectedRowForPanel.id === row.id && selectedRowForPanel.source === row.source ? t.bgActive : 'transparent'; }}
                        >
                                    <td style={{ padding: '12px 8px', textAlign: 'center', overflow: 'hidden' }}>
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                                          ...(row.normalizedStatus === 'Active' ? { color: t.success, background: t.successBg } :
                                              row.normalizedStatus === 'Expired' ? { color: t.warning, background: t.warningBg } :
                                              row.normalizedStatus === 'Pending' ? { color: t.warning, background: t.warningBg } :
                                              row.normalizedStatus === 'Cancelled' ? { color: t.danger, background: t.dangerBg } :
                                              { color: t.text4, background: t.bgInput })
                                        }}>
                                          {row.isDeleted ? <><Trash2 size={10}/> DELETED</> : row.normalizedStatus.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 8px', overflow: 'hidden' }}>
                                        <SourceBadge source={row.source} />
                                    </td>
                                    <td style={{ padding: '12px 8px', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", color: t.accent }}>
                                        {row.referenceNumber}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontWeight: 500, overflow: 'hidden', color: t.text1 }}>
                                        {row.cedantName ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <span
                                                    className="hover:underline"
                                                    style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                    onClick={(e) => handleEntityClick(e, row.cedantName)}
                                                >
                                                    {row.cedantName}
                                                </span>
                                                <span style={{ fontSize: 11, color: t.text4, display: 'flex', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    Orig:
                                                    <span
                                                        style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                        className="hover:underline"
                                                        onClick={(e) => handleEntityClick(e, row.insuredName)}
                                                    >
                                                        {row.insuredName}
                                                    </span>
                                                </span>
                                            </div>
                                        ) : (
                                            <span
                                                className="hover:underline"
                                                style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                                                onClick={(e) => handleEntityClick(e, row.insuredName)}
                                            >
                                                {row.insuredName}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text3 }}>
                                        {row.brokerName ? (
                                            <span
                                                style={{ color: t.accent, cursor: 'pointer' }}
                                                className="hover:underline"
                                                onClick={(e) => handleEntityClick(e, row.brokerName)}
                                            >
                                                {row.brokerName}
                                            </span>
                                        ) : (
                                            <span style={{ color: t.text5, fontStyle: 'italic' }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text3 }}>
                                        {row.classOfBusiness}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text3 }}>
                                        {row.territory || '-'}
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap', color: t.text2, fontVariantNumeric: 'tabular-nums' }}>
                                        {row.sumInsuredNational ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(row.sumInsuredNational) : '-'}
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: t.text1, fontVariantNumeric: 'tabular-nums' }}>
                                        {formatMoney(row.grossPremium, row.currency)}
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap', color: t.text3 }}>
                                        {row.ourShare}%
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap' }}>
                                        {cededPct > 100 ? (
                                          <span style={{ fontWeight: 500, color: t.danger }}>100%+</span>
                                        ) : cededPct > 0 ? (
                                          <span style={{ fontWeight: 500, color: cededPct >= 100 ? t.success : cededPct >= 50 ? t.accent : t.warning }}>
                                            {cededPct.toFixed(2)}%
                                          </span>
                                        ) : (
                                          <span style={{ color: t.text5 }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontSize: 12, whiteSpace: 'nowrap', color: t.text3 }}>
                                        {formatDate(row.inceptionDate)}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontSize: 12, whiteSpace: 'nowrap', color: t.text4 }}>
                                        {formatDate(row.expiryDate)}
                                    </td>

                                    <td style={{ padding: '8px 4px', textAlign: 'center', position: 'relative', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                                        {row.isDeleted ? (
                                            user?.role === 'Super Admin' && row.source === 'direct' && (
                                                <Button variant="success" size="sm" onClick={(e) => handleRestore(e, row)} title="Restore" style={{ padding: 6, border: 'none' }}>
                                                    <RefreshCw size={14}/>
                                                </Button>
                                            )
                                        ) : (
                                            <>\
                                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === `${row.source}-${row.id}` ? null : `${row.source}-${row.id}`); }} style={{ padding: 6, border: 'none' }}>
                                                    <MoreVertical size={16} style={{ color: t.text4 }} />
                                                </Button>
                                                {openMenuId === `${row.source}-${row.id}` && (
                                                    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: t.bgPanel, borderRadius: 10, boxShadow: t.shadowLg, border: `1px solid ${t.borderL}`, padding: 4, zIndex: 50, minWidth: 120 }}>
                                                        <Button variant="ghost" size="sm" onClick={() => { setOpenMenuId(null); handleViewFullDetail(row); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                                                            <Eye size={14} /> View
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={(e) => { setOpenMenuId(null); handleEdit(e as any, row); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                                                            <Edit size={14} /> Edit
                                                        </Button>
                                                        {row.source === 'direct' && (
                                                            <>
                                                                <Button variant="ghost" size="sm" onClick={(e) => { setOpenMenuId(null); handleWording(e as any, row); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                                                                    <FileText size={14} /> Wording
                                                                </Button>
                                                                <Button variant="danger" size="sm" onClick={(e) => { setOpenMenuId(null); initiateDelete(e as any, row); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                                                                    <Trash2 size={14} /> Delete
                                                                </Button>
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
                            <td colSpan={14} style={{ padding: '48px 0', textAlign: 'center', color: t.text4 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                    <Filter size={32} style={{ opacity: 0.2, color: t.text5 }}/>
                                    {statusFilter === 'Deleted' ? (
                                        <p>Deleted records are excluded from the consolidated view.</p>
                                    ) : (
                                        <>
                                            <p>No records found matching your criteria.</p>
                                            {totalCount === 0 && (
                                                <Button variant="primary" size="sm" onClick={fetchData} icon={<RefreshCw size={14} />} style={{ marginTop: 8 }}>
                                                    Retry
                                                </Button>
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
            <div ref={sentinelRef} style={{ height: 4 }} />
            {loadingMore && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                <RefreshCw size={20} className="animate-spin" style={{ color: t.accent }} />
              </div>
            )}
      </div>

      {/* Inline Side Panel */}
      <SidePanel
        open={!!selectedRowForPanel}
        onClose={() => setSelectedRowForPanel(null)}
        title={selectedRowForPanel?.referenceNumber || ''}
        subtitle={selectedRowForPanel?.source === 'direct' ? 'Direct Policy' : selectedRowForPanel?.source === 'inward-foreign' ? 'Inward Foreign' : 'Inward Domestic'}
        footer={
          <>
            <Button variant="primary" icon={<Eye size={14} />} onClick={() => { if (selectedRowForPanel) handleViewFullDetail(selectedRowForPanel); }} style={{ flex: 1, justifyContent: 'center' }}>
              View Full Detail
            </Button>
            <Button variant="ghost" icon={<Edit size={14} />} onClick={(e) => { if (selectedRowForPanel) handleEdit(e as any, selectedRowForPanel); }} style={{ justifyContent: 'center' }}>
              Edit
            </Button>
          </>
        }
      >
        {selectedRowForPanel && (
          <>
            <PanelField label="Policy / Contract No" value={selectedRowForPanel.referenceNumber} />
            <PanelField label={selectedRowForPanel.cedantName ? 'Cedent Name' : 'Insured Name'} value={selectedRowForPanel.cedantName || selectedRowForPanel.insuredName} />
            {selectedRowForPanel.cedantName && (
              <PanelField label="Original Insured" value={selectedRowForPanel.insuredName} />
            )}
            <PanelField label="Type" value={
              selectedRowForPanel.source === 'direct' ? 'Direct' : selectedRowForPanel.source === 'inward-foreign' ? 'Inward Foreign' : 'Inward Domestic'
            } />
            <PanelField label="Class of Business" value={selectedRowForPanel.classOfBusiness} />
            <PanelField label="Period" value={
              selectedRowForPanel.inceptionDate || selectedRowForPanel.expiryDate
                ? `${formatDate(selectedRowForPanel.inceptionDate)} — ${formatDate(selectedRowForPanel.expiryDate)}`
                : undefined
            } />
            <PanelField label="Gross Premium" value={
              selectedRowForPanel.grossPremium
                ? formatMoney(selectedRowForPanel.grossPremium, selectedRowForPanel.currency)
                : undefined
            } />
            <PanelField label="Status" value={
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                ...(selectedRowForPanel.normalizedStatus === 'Active' ? { color: t.success, background: t.successBg } :
                    selectedRowForPanel.normalizedStatus === 'Expired' ? { color: t.warning, background: t.warningBg } :
                    selectedRowForPanel.normalizedStatus === 'Pending' ? { color: t.warning, background: t.warningBg } :
                    selectedRowForPanel.normalizedStatus === 'Cancelled' ? { color: t.danger, background: t.dangerBg } :
                    { color: t.text4, background: t.bgInput })
              }}>
                {selectedRowForPanel.normalizedStatus?.toUpperCase()}
              </span>
            } />
            {selectedRowForPanel.brokerName && (
              <PanelField label="Broker" value={selectedRowForPanel.brokerName} />
            )}
            {selectedRowForPanel.territory && (
              <PanelField label="Territory" value={selectedRowForPanel.territory} />
            )}
            <PanelField label="Our Share" value={selectedRowForPanel.ourShare != null ? `${selectedRowForPanel.ourShare}%` : undefined} />
          </>
        )}
      </SidePanel>
      </div>{/* end grid container */}

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

      <EntityDetailModal
        entity={selectedEntity}
        onClose={() => setSelectedEntity(null)}
        onEdit={(id) => { setSelectedEntity(null); navigate(`/entities/edit/${id}`); }}
      />


    </div>
  );
};

export default Dashboard;
