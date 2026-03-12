import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { InwardReinsurance, InwardReinsuranceOrigin, Currency } from '../types';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Plus, Search, Filter, RefreshCw, Trash2, Edit, Eye,
  Globe, Home, FileSpreadsheet, Layers, Calendar, DollarSign,
  ChevronLeft, ChevronRight, MoreVertical, Download
} from 'lucide-react';
import { exportToExcel } from '../services/excelExport';
import { usePageHeader } from '../context/PageHeaderContext';
import { CompactDateFilter } from '../components/CompactDateFilter';
import { toISODateString } from '../components/DatePickerInput';
import { useTheme } from '../theme/useTheme';
import SidePanel, { PanelField } from '../components/ui/SidePanel';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const InwardReinsuranceList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const { t } = useTheme();

  // Determine origin from URL path
  const origin: InwardReinsuranceOrigin = location.pathname.includes('/foreign') ? 'FOREIGN' : 'DOMESTIC';

  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<InwardReinsurance[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FAC' | 'TREATY'>('ALL');
  const [structureFilter, setStructureFilter] = useState<'ALL' | 'PROPORTIONAL' | 'NON_PROPORTIONAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Date filter state
  const [dateFilterField, setDateFilterField] = useState<string>('inceptionDate');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; number: string }>({
    isOpen: false, id: '', number: ''
  });
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  useEffect(() => {
    const handleClickOutside = () => setActionMenuOpen(null);
    if (actionMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [actionMenuOpen]);
  const [migrationRequired, setMigrationRequired] = useState(false);

  // Modal state

  // Side panel state
  const [selectedContract, setSelectedContract] = useState<InwardReinsurance | null>(null);

  // Fetch contracts
  const fetchContracts = async () => {
    setLoading(true);
    try {
      if (supabase) {
        let query = supabase
          .from('inward_reinsurance')
          .select('*', { count: 'exact' })
          .eq('origin', origin)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        if (typeFilter !== 'ALL') {
          query = query.eq('type', typeFilter);
        }
        if (structureFilter !== 'ALL') {
          query = query.eq('structure', structureFilter);
        }
        if (statusFilter !== 'ALL') {
          query = query.eq('status', statusFilter);
        }
        if (searchTerm) {
          query = query.or(`contract_number.ilike.%${searchTerm}%,cedant_name.ilike.%${searchTerm}%,broker_name.ilike.%${searchTerm}%`);
        }

        // Date range filter
        if (dateFrom || dateTo) {
          const dateColumnMap: Record<string, string> = {
            'inceptionDate': 'inception_date', 'expiryDate': 'expiry_date',
            'dateOfSlip': 'date_of_slip', 'accountingDate': 'accounting_date',
            'reinsuranceInceptionDate': 'reinsurance_inception_date', 'reinsuranceExpiryDate': 'reinsurance_expiry_date',
            'premiumPaymentDate': 'premium_payment_date', 'actualPaymentDate': 'actual_payment_date',
          };
          const dbDateCol = dateColumnMap[dateFilterField] || 'inception_date';
          if (dateFrom) query = query.gte(dbDateCol, toISODateString(dateFrom) || '');
          if (dateTo) query = query.lte(dbDateCol, toISODateString(dateTo) || '');
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        const mapped: InwardReinsurance[] = (data || []).map((row: any) => ({
          id: row.id,
          contractNumber: row.contract_number,
          origin: row.origin,
          type: row.type,
          structure: row.structure,
          status: row.status,
          cedantName: row.cedant_name,
          cedantEntityId: row.cedant_entity_id,
          cedantCountry: row.cedant_country,
          brokerName: row.broker_name,
          brokerEntityId: row.broker_entity_id,
          inceptionDate: row.inception_date,
          expiryDate: row.expiry_date,
          uwYear: row.uw_year,
          typeOfCover: row.type_of_cover,
          classOfCover: row.class_of_cover,
          industry: row.industry,
          territory: row.territory,
          originalInsuredName: row.original_insured_name,
          riskDescription: row.risk_description,
          currency: row.currency,
          limitOfLiability: row.limit_of_liability,
          deductible: row.deductible,
          retention: row.retention,
          ourShare: row.our_share,
          grossPremium: row.gross_premium,
          commissionPercent: row.commission_percent,
          netPremium: row.net_premium,
          minimumPremium: row.minimum_premium,
          depositPremium: row.deposit_premium,
          adjustablePremium: row.adjustable_premium,
          treatyName: row.treaty_name,
          treatyNumber: row.treaty_number,
          layerNumber: row.layer_number,
          excessPoint: row.excess_point,
          aggregateLimit: row.aggregate_limit,
          aggregateDeductible: row.aggregate_deductible,
          reinstatements: row.reinstatements,
          reinstatementPremium: row.reinstatement_premium,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          createdBy: row.created_by,
          isDeleted: row.is_deleted
        }));

        setContracts(mapped);
        setTotalCount(count || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch contracts:', err);
      // Check if the error is due to missing table (migration not run)
      const errorStr = JSON.stringify(err);
      const isMigrationError =
        err?.code === 'PGRST205' ||
        err?.code === '42P01' ||
        err?.status === 404 ||
        err?.statusCode === 404 ||
        err?.message?.includes('inward_reinsurance') ||
        err?.message?.includes('schema cache') ||
        err?.message?.includes('does not exist') ||
        errorStr?.includes('PGRST205') ||
        errorStr?.includes('inward_reinsurance') ||
        errorStr?.includes('schema cache');

      if (isMigrationError) {
        setMigrationRequired(true);
      } else {
        toast.error('Failed to load contracts');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [origin, typeFilter, structureFilter, statusFilter, searchTerm, page, dateFilterField, dateFrom, dateTo]);

  // Handle delete
  const handleDelete = async () => {
    if (!deleteConfirm.id) return;

    try {
      if (supabase) {
        const { error } = await supabase
          .from('inward_reinsurance')
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq('id', deleteConfirm.id);

        if (error) throw error;
      }

      toast.success('Contract deleted successfully');
      setDeleteConfirm({ isOpen: false, id: '', number: '' });
      fetchContracts();
    } catch (err: any) {
      toast.error('Failed to delete: ' + (err.message || 'Unknown error'));
    }
  };

  const handleExport = () => {
    if (contracts.length === 0) return;
    const exportData = contracts.map(c => ({
      'Contract #': c.contractNumber,
      'Type': c.type,
      'Structure': c.structure,
      'Cedant': c.cedantName,
      'Broker': c.brokerName || '',
      'Coverage': c.typeOfCover || '',
      'Class': c.classOfCover || '',
      'Inception': c.inceptionDate || '',
      'Expiry': c.expiryDate || '',
      'Currency': c.currency,
      'Limit': c.limitOfLiability || 0,
      'Our Share %': c.ourShare || 0,
      'Gross Premium': c.grossPremium || 0,
      'Net Premium': c.netPremium || 0,
      'Status': c.status,
    }));
    exportToExcel(exportData, `Inward_${origin}_${new Date().toISOString().split('T')[0]}`, `${origin} Contracts`);
  };

  // Format currency
  const formatAmount = (amount: number, currency: Currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; bg: string }> = {
      DRAFT: { color: t.text2, bg: t.bgInput },
      PENDING: { color: t.warning, bg: t.warningBg },
      ACTIVE: { color: t.success, bg: t.successBg },
      EXPIRED: { color: t.danger, bg: t.dangerBg },
      CANCELLED: { color: t.text3, bg: t.bgInput }
    };
    const s = statusMap[status] || { color: t.text2, bg: t.bgInput };
    return (
      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, color: s.color, background: s.bg }}>
        {status}
      </span>
    );
  };

  // Type badge
  const getTypeBadge = (type: string, structure: string) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4,
          fontSize: 11, fontWeight: 500,
          color: type === 'FAC' ? t.accent : '#6366f1',
          background: type === 'FAC' ? `${t.accent}18` : 'rgba(99,102,241,0.1)'
        }}>
          {type}
        </span>
        <span style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4,
          fontSize: 11,
          color: structure === 'PROPORTIONAL' ? t.success : t.warning,
          background: structure === 'PROPORTIONAL' ? t.successBg : t.warningBg
        }}>
          {structure === 'PROPORTIONAL' ? 'Prop' : 'Non-Prop'}
        </span>
      </div>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Stats badges in header left, Export button in header right
  useEffect(() => {
    const activeCount = contracts.filter(c => c.status === 'ACTIVE' || c.status === 'Active').length;
    const totalGWP = contracts.reduce((sum, c) => sum + (c.grossPremium || 0), 0);
    const fmtCompact = (v: number): string => {
      if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
      if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
      if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
      return v.toFixed(0);
    };
    setHeaderLeft(
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, background: t.bgCard, border: `1px solid ${t.border}` }}>
          <span style={{ fontWeight: 500, fontSize: 11, color: t.text4 }}>Contracts</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: t.text1 }}>{totalCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, background: t.successBg, border: `1px solid ${t.success}33` }}>
          <span style={{ fontWeight: 500, fontSize: 11, color: t.success }}>Active</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: t.success }}>{activeCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, background: `${t.accent}15`, border: `1px solid ${t.accent}33` }}>
          <span style={{ fontWeight: 500, fontSize: 11, color: t.accent }}>GWP</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: t.accent }}>{fmtCompact(totalGWP)}</span>
        </div>
      </>
    );
    setHeaderActions(
      <Button variant="primary" icon={<Download size={16} />} onClick={() => handleExport()} style={{ whiteSpace: 'nowrap', background: t.success }}>
        Export
      </Button>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [contracts, totalCount, setHeaderActions, setHeaderLeft]);

  return (
    <div>
      {/* Sticky filter bar */}
      <div ref={filterRef} className="sticky-filter-blur" style={{ position: 'sticky', top: 0, zIndex: 30, background: t.bgApp }}>
      <div style={{ borderRadius: 12, padding: 12, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={14} className="-translate-y-1/2" style={{ position: 'absolute', left: 12, top: '50%', color: t.text4, zIndex: 1 }} />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(val) => { setSearchTerm(val); setPage(1); }}
              style={{ paddingLeft: 32 }}
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1); }}
            style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, outline: 'none', fontSize: 14, border: `1px solid ${t.borderL}`, background: t.bgInput, color: t.text1 }}
          >
            <option value="ALL">All Types</option>
            <option value="FAC">Facultative</option>
            <option value="TREATY">Treaty</option>
          </select>

          {/* Structure Filter */}
          <select
            value={structureFilter}
            onChange={(e) => { setStructureFilter(e.target.value as any); setPage(1); }}
            style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, outline: 'none', fontSize: 14, border: `1px solid ${t.borderL}`, background: t.bgInput, color: t.text1 }}
          >
            <option value="ALL">All Structures</option>
            <option value="PROPORTIONAL">Proportional</option>
            <option value="NON_PROPORTIONAL">Non-Proportional</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, outline: 'none', fontSize: 14, border: `1px solid ${t.borderL}`, background: t.bgInput, color: t.text1 }}
          >
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, width: '380px' }}>
          <select
            value={dateFilterField}
            onChange={(e) => { setDateFilterField(e.target.value); setPage(1); }}
            style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, outline: 'none', fontSize: 14, border: `1px solid ${t.borderL}`, background: t.bgInput, color: t.text1 }}
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
            onChange={(d) => { setDateFrom(d); setPage(1); }}
            placeholder="From"
          />
          <CompactDateFilter
            value={dateTo}
            onChange={(d) => { setDateTo(d); setPage(1); }}
            placeholder="To"
          />
          </div>

          {/* Refresh */}
          <Button variant="ghost" size="sm" onClick={fetchContracts} title="Refresh" style={{ padding: 8, border: 'none' }}>
            <RefreshCw size={16} style={{ color: t.text4 }} />
          </Button>

          <div style={{ width: 1, height: 20, background: t.borderL }} />

          {/* New Contract Button */}
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate(`/inward-reinsurance/${origin === 'FOREIGN' ? 'foreign' : 'domestic'}/new`)}>
            New Contract
          </Button>
        </div>
      </div>
      </div>{/* end sticky header block */}

      <div style={{ display: 'grid', gridTemplateColumns: selectedContract ? '1fr 360px' : '1fr', gap: 0, alignItems: 'start' }}>
      <div style={{ minWidth: 0 }}>
      {/* Migration Required Message */}
      {migrationRequired && (
        <div style={{ borderRadius: 12, padding: 24, marginTop: 16, background: t.warningBg, border: `1px solid ${t.warning}33` }}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${t.warning}25` }}>
              <FileSpreadsheet size={20} style={{ color: t.warning }} />
            </div>
            <div>
              <h3 style={{ color: t.warning, fontSize: 15, fontWeight: 600 }}>{`Database Setup Required`}</h3>
              <p className="mt-1" style={{ color: t.warning }}>
                The Inward Reinsurance tables have not been created in the database yet.
              </p>
              <p className="mt-2 text-sm" style={{ color: `${t.warning}cc` }}>
                To use this feature, please run the migration script in your Supabase SQL Editor:
              </p>
              <code className="block mt-2 p-3 rounded-lg text-sm font-mono" style={{ background: `${t.warning}20`, color: t.text1 }}>
                supabase_inward_reinsurance_migration.sql
              </code>
              <p className="mt-3 text-sm" style={{ color: `${t.warning}cc` }}>
                You can find this file in the root directory of the project. Copy its contents and execute it in the Supabase Dashboard SQL Editor.
              </p>
              <Button variant="primary" size="sm" onClick={() => { setMigrationRequired(false); fetchContracts(); }} style={{ marginTop: 16, background: t.warning }}>
                Retry After Running Migration
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {!migrationRequired && (
      <div className="rounded-xl" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
        {loading ? (
          <div className="p-12 text-center" style={{ color: t.text4 }}>Loading contracts...</div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet size={48} className="mx-auto mb-4" style={{ color: t.text5 }} />
            <p style={{ color: t.text4 }}>No contracts found</p>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/inward-reinsurance/${origin === 'FOREIGN' ? 'foreign' : 'domestic'}/new`)} style={{ marginTop: 16, color: t.accent, border: 'none' }}>
              Create your first contract
            </Button>
          </div>
        ) : (
            <table className="w-full">
              <thead className="sticky z-20" style={{ top: `${filterHeight}px`, background: t.bgCard, boxShadow: t.shadow }}>
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase" style={{ color: t.text3 }}>Contract #</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase" style={{ color: t.text3 }}>Type</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase" style={{ color: t.text3 }}>Cedant</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase" style={{ color: t.text3 }}>Coverage</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase" style={{ color: t.text3 }}>Period</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase" style={{ color: t.text3 }}>Limit</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase" style={{ color: t.text3 }}>Share</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase" style={{ color: t.text3 }}>Status</th>
                  <th className="px-1 py-3 w-10" style={{ background: t.bgCard }}></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr
                    key={contract.id}
                    onClick={() => {
                      setSelectedContract(selectedContract?.id === contract.id ? null : contract);
                    }}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: `1px solid ${t.border}`, background: selectedContract?.id === contract.id ? t.bgActive : 'transparent' }}
                    onMouseEnter={(e) => { if (selectedContract?.id !== contract.id) e.currentTarget.style.background = t.bgHover; }}
                    onMouseLeave={(e) => { if (selectedContract?.id !== contract.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium" style={{ color: t.text1, fontFamily: "'JetBrains Mono', monospace" }}>{contract.contractNumber}</div>
                      <div style={{ fontSize: 11, color: t.text4 }}>UW {contract.uwYear}</div>
                    </td>
                    <td className="px-3 py-3">
                      {getTypeBadge(contract.type, contract.structure)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium" style={{ color: t.text1 }}>{contract.cedantName}</div>
                      {contract.brokerName && (
                        <div style={{ fontSize: 11, color: t.text4 }}>via {contract.brokerName}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm" style={{ color: t.text1 }}>{contract.typeOfCover}</div>
                      <div style={{ fontSize: 11, color: t.text4 }}>{contract.classOfCover}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm" style={{ color: t.text1 }}>{formatDate(contract.inceptionDate)}</div>
                      <div style={{ fontSize: 11, color: t.text4 }}>to {formatDate(contract.expiryDate)}</div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-medium" style={{ color: t.text1, fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(contract.limitOfLiability, contract.currency)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-medium" style={{ color: t.text1, fontVariantNumeric: 'tabular-nums' }}>{contract.ourShare}%</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {getStatusBadge(contract.status)}
                    </td>
                    <td className="px-1 py-2 text-center w-10 relative" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setActionMenuOpen(actionMenuOpen === contract.id ? null : contract.id); }} style={{ padding: 6, border: 'none' }}>
                        <MoreVertical size={16} style={{ color: t.text4 }} />
                      </Button>
                      {actionMenuOpen === contract.id && (
                        <div className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-[120px]" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadowLg }}>
                          <Button variant="ghost" size="sm" onClick={() => { setActionMenuOpen(null); navigate(`/inward-reinsurance/${origin === 'FOREIGN' ? 'foreign' : 'domestic'}/view/${contract.id}`); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                            <Eye size={14} /> View
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setActionMenuOpen(null); navigate(`/inward-reinsurance/${origin === 'FOREIGN' ? 'foreign' : 'domestic'}/edit/${contract.id}`); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                            <Edit size={14} /> Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => { setActionMenuOpen(null); setDeleteConfirm({ isOpen: true, id: contract.id, number: contract.contractNumber }); }} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 6, fontSize: 14 }}>
                            <Trash2 size={14} /> Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${t.border}` }}>
            <div className="text-sm" style={{ color: t.text4 }}>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} contracts
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: 4, border: 'none' }}>
                <ChevronLeft size={20} />
              </Button>
              <span className="text-sm" style={{ color: t.text2 }}>
                Page {page} of {totalPages}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: 4, border: 'none' }}>
                <ChevronRight size={20} />
              </Button>
            </div>
          </div>
        )}
      </div>
      )}
      </div>{/* end main content column */}

      {/* Side Panel */}
      <SidePanel
        open={!!selectedContract}
        onClose={() => setSelectedContract(null)}
        title={selectedContract?.contractNumber || ''}
        subtitle={selectedContract?.cedantName || ''}
        footer={
          <>
            <Button variant="ghost" icon={<Eye size={14} />} onClick={() => { if (selectedContract) navigate(`/inward-reinsurance/${origin === 'FOREIGN' ? 'foreign' : 'domestic'}/view/${selectedContract.id}`); }} style={{ flex: 1, justifyContent: 'center' }}>
              View Full Detail
            </Button>
            <Button variant="primary" icon={<Edit size={14} />} onClick={() => { if (selectedContract) navigate(`/inward-reinsurance/${origin === 'FOREIGN' ? 'foreign' : 'domestic'}/edit/${selectedContract.id}`); }} style={{ flex: 1, justifyContent: 'center' }}>
              Edit
            </Button>
          </>
        }
      >
        {selectedContract && (
          <>
            <PanelField label="Contract Number" value={selectedContract.contractNumber} />
            <PanelField label="Cedent" value={selectedContract.cedantName} />
            <PanelField label="Type" value={selectedContract.type} />
            <PanelField label="Treaty Structure" value={selectedContract.structure === 'PROPORTIONAL' ? 'Proportional' : 'Non-Proportional'} />
            <PanelField label="Territory" value={selectedContract.territory || undefined} />
            <PanelField label="Period" value={
              selectedContract.inceptionDate
                ? `${formatDate(selectedContract.inceptionDate)} — ${formatDate(selectedContract.expiryDate)}`
                : undefined
            } />
            <PanelField label="UW Year" value={selectedContract.uwYear || undefined} />
            <PanelField label="Coverage" value={selectedContract.typeOfCover || undefined} />
            <PanelField label="Class of Cover" value={selectedContract.classOfCover || undefined} />
            <PanelField label="Currency" value={selectedContract.currency} />
            <PanelField label="Limit of Liability" value={formatAmount(selectedContract.limitOfLiability, selectedContract.currency)} />
            <PanelField label="Our Share" value={`${selectedContract.ourShare}%`} />
            <PanelField label="Gross Premium (GWP)" value={formatAmount(selectedContract.grossPremium || 0, selectedContract.currency)} />
            <PanelField label="Net Premium" value={selectedContract.netPremium ? formatAmount(selectedContract.netPremium, selectedContract.currency) : undefined} />
            <PanelField label="Broker" value={selectedContract.brokerName || undefined} />
            <PanelField label="Status" value={getStatusBadge(selectedContract.status)} />
          </>
        )}
      </SidePanel>
      </div>{/* end grid container */}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Contract"
        message={`Are you sure you want to delete contract "${deleteConfirm.number}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '', number: '' })}
        confirmText="Delete"
        variant="danger"
      />

    </div>
  );
};

export default InwardReinsuranceList;
