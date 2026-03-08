import React, { useState } from 'react';
import { PortfolioRow, Policy, InwardReinsurance, PolicyStatus } from '../types';
import { formatDate } from '../utils/dateUtils';
import {
  X, Building2, Calendar, DollarSign, FileText, Layers,
  CheckCircle, AlertCircle, XCircle, AlertTriangle, Upload,
  Shield, Briefcase, Globe, Home, FileSpreadsheet, Archive
} from 'lucide-react';

// ── Types ──

interface MasterDetailModalProps {
  row: PortfolioRow;
  outwardPolicies?: Policy[];
  onClose: () => void;
  onRefresh?: () => void;
  onEdit?: (row: PortfolioRow) => void;
}

type TabKey = 'summary' | 'premium' | 'reinsurance' | 'claims' | 'documents';

// ── Helpers ──

const fmt = (amount: number | undefined, currency: string = 'USD'): string => {
  if (amount === undefined || amount === null) return '-';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
};

const fmtFull = (amount: number | undefined, currency: string = 'USD'): string => {
  if (amount === undefined || amount === null) return '-';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
};

const pct = (v: number | undefined): string => {
  if (v === undefined || v === null) return '-';
  return `${v}%`;
};

// Normalize cededShare: values <= 1 are decimals (0.95 = 95%), values > 1 are already percentages
const normalizeCededShare = (v: number): number => v <= 1 ? v * 100 : v;

const sourceColor: Record<string, string> = {
  direct: 'bg-blue-100 text-blue-700',
  'inward-foreign': 'bg-purple-100 text-purple-700',
  'inward-domestic': 'bg-emerald-100 text-emerald-700',
};

const sourceLabel: Record<string, string> = {
  direct: 'Direct Insurance',
  'inward-foreign': 'Inward Reinsurance — Foreign',
  'inward-domestic': 'Inward Reinsurance — Domestic',
};

const statusBadge = (status: string, isDeleted?: boolean) => {
  if (isDeleted) return 'bg-red-600 text-white';
  const s = status?.toUpperCase() || '';
  if (s.includes('ACTIVE') || s === 'BOUND' || s === 'SIGNED') return 'bg-emerald-100 text-emerald-700';
  if (s.includes('PENDING') || s === 'DRAFT' || s === 'QUOTED') return 'bg-amber-100 text-amber-700';
  if (s.includes('CANCEL') || s === 'NTU' || s === 'DECLINED') return 'bg-red-100 text-red-700';
  if (s.includes('EXPIRED') || s === 'CLOSED') return 'bg-slate-100 text-slate-600';
  return 'bg-gray-100 text-gray-700';
};

// ── Field row helper ──

const Field: React.FC<{ label: string; value?: string | number | null; mono?: boolean; className?: string }> = ({ label, value, mono, className }) => (
  <div className={className}>
    <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
    <div className={`text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>{value ?? '-'}</div>
  </div>
);

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

export const MasterDetailModal: React.FC<MasterDetailModalProps> = ({
  row,
  outwardPolicies = [],
  onClose,
  onRefresh,
  onEdit,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const currency = row.currency || 'USD';
  const isInward = row.source === 'inward-foreign' || row.source === 'inward-domestic';
  const isDirect = row.source === 'direct';

  // Get original data
  const policy = isDirect ? (row.originalData as Policy) : null;
  const inward = isInward ? (row.originalData as InwardReinsurance) : null;

  // Build tabs
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'summary', label: 'Summary', icon: <FileText size={14} /> },
    { key: 'premium', label: 'Premium & Installments', icon: <DollarSign size={14} /> },
  ];

  if (isDirect) {
    tabs.push({ key: 'reinsurance', label: 'Outward Reinsurance', icon: <Shield size={14} /> });
  } else if (isInward) {
    tabs.push({ key: 'reinsurance', label: 'Treaty / Structure', icon: <Layers size={14} /> });
  }

  tabs.push({ key: 'claims', label: 'Claims', icon: <AlertTriangle size={14} /> });
  tabs.push({ key: 'documents', label: 'Documents', icon: <Archive size={14} /> });

  // ── Tab: Summary ──
  const renderSummary = () => (
    <div className="space-y-5">
      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Core Info */}
        <div>
          <h4 className="font-bold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2 text-sm"><Building2 size={14} /> Core Information</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Policy / Ref No" value={row.referenceNumber} mono />
            {row.secondaryRef && <Field label="Secondary Ref" value={row.secondaryRef} mono />}
            <Field label="Insured Name" value={row.insuredName} className="col-span-2" />
            {row.insuredAddress && <Field label="Insured Address" value={row.insuredAddress} className="col-span-2" />}
            {row.cedantName && (
              <div className="col-span-2 bg-purple-50 p-2 rounded border border-purple-100">
                <div className="text-[11px] text-purple-600 uppercase font-bold">Cedant</div>
                <div className="text-sm font-medium text-purple-900">{row.cedantName}</div>
              </div>
            )}
            {row.brokerName && <Field label="Broker" value={row.brokerName} />}
            {row.borrower && <Field label="Borrower" value={row.borrower} />}
            {row.performer && <Field label="Performer" value={row.performer} />}
            {row.retrocedent && <Field label="Retrocedent" value={row.retrocedent} />}
            <Field label="Class of Business" value={row.classOfBusiness} />
            {row.typeOfInsurance && <Field label="Type of Insurance" value={row.typeOfInsurance} />}
            {row.riskCode && <Field label="Risk Code" value={row.riskCode} />}
            {row.insuredRisk && <Field label="Insured Risk" value={row.insuredRisk} />}
            {row.industry && <Field label="Industry" value={row.industry} />}
            <Field label="Territory" value={row.territory || '-'} />
            {row.city && <Field label="City" value={row.city} />}
          </div>
        </div>

        {/* Right: Dates */}
        <div>
          <h4 className="font-bold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2 text-sm"><Calendar size={14} /> Key Dates</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Inception Date" value={formatDate(row.inceptionDate)} />
            <Field label="Expiry Date" value={formatDate(row.expiryDate)} />
            {row.insuranceDays != null && <Field label="Insurance Days" value={row.insuranceDays} />}
            {row.dateOfSlip && <Field label="Date of Slip" value={formatDate(row.dateOfSlip)} />}
            {row.accountingDate && <Field label="Accounting Date" value={formatDate(row.accountingDate)} />}
            {row.reinsuranceInceptionDate && <Field label="RI Inception" value={formatDate(row.reinsuranceInceptionDate)} />}
            {row.reinsuranceExpiryDate && <Field label="RI Expiry" value={formatDate(row.reinsuranceExpiryDate)} />}
            {row.reinsuranceDays != null && <Field label="RI Days" value={row.reinsuranceDays} />}
            {row.warrantyPeriod != null && <Field label="Warranty Period" value={`${row.warrantyPeriod} months`} />}
            {row.premiumPaymentDate && <Field label="Premium Payment Date" value={formatDate(row.premiumPaymentDate)} />}
            {row.actualPaymentDate && <Field label="Actual Payment Date" value={formatDate(row.actualPaymentDate)} />}
          </div>

          {/* Contract info for inward */}
          {isInward && (
            <div className="mt-5">
              <h4 className="font-bold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2 text-sm"><Layers size={14} /> Contract Structure</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {row.contractType && <Field label="Type" value={row.contractType} />}
                {row.structure && <Field label="Structure" value={row.structure} />}
                {inward?.treatyName && <Field label="Treaty Name" value={inward.treatyName} />}
                {inward?.layerNumber != null && <Field label="Layer" value={inward.layerNumber} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm"><DollarSign size={14} /> Financial Summary ({currency})</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Sum Insured</div>
            <div className="text-base font-bold text-gray-900 font-mono">{fmt(row.sumInsured, currency)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Limit (FC)</div>
            <div className="text-base font-bold text-gray-900 font-mono">{fmt(row.limit, currency)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Limit (NC)</div>
            <div className="text-base font-bold text-gray-900 font-mono">{fmt(row.limitNational)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Excess</div>
            <div className="text-base font-medium text-gray-900 font-mono">{fmt(row.excess, currency)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Priority Sum</div>
            <div className="text-base font-medium text-gray-900 font-mono">{fmt(row.prioritySum, currency)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mt-4 pt-4 border-t border-slate-200">
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Gross Premium</div>
            <div className="text-base font-bold text-green-700 font-mono">{fmt(row.grossPremium, currency)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Net Premium</div>
            <div className="text-base font-bold text-blue-700 font-mono">{fmt(row.netPremium, currency)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Our Share</div>
            <div className="text-base font-bold text-gray-900">{pct(row.ourShare)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Premium Rate</div>
            <div className="text-base font-medium text-gray-900">{row.premiumRate != null ? `${row.premiumRate}%` : '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Commission %</div>
            <div className="text-base font-medium text-gray-900">{pct(row.commissionPercent)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mt-4 pt-4 border-t border-slate-200">
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Commission (NC)</div>
            <div className="font-medium text-gray-900 font-mono">{fmt(row.commissionNational)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Tax %</div>
            <div className="font-medium text-gray-900">{row.taxPercent != null ? `${row.taxPercent}%` : '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">FX Rate</div>
            <div className="font-medium text-gray-900 font-mono">{row.exchangeRate ?? '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">FX Rate (USD)</div>
            <div className="font-medium text-gray-900 font-mono">{row.exchangeRateUSD ?? '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase">Equivalent USD</div>
            <div className="font-medium text-gray-900 font-mono">{fmt(row.equivalentUSD, 'USD')}</div>
          </div>
        </div>
      </div>

      {/* Outward Reinsurance Quick Summary */}
      {outwardPolicies.length > 0 && (() => {
        // Deduplicate by reinsurer to avoid installment double-counting
        const uniqueShares = new Map<string, number>();
        for (const p of outwardPolicies) {
          const name = p.reinsurerName || p.insuredName || 'Unknown';
          const share = normalizeCededShare(Number(p.cededShare || 0));
          if (!uniqueShares.has(name) || share > (uniqueShares.get(name) || 0)) {
            uniqueShares.set(name, share);
          }
        }
        const totalCeded = Array.from(uniqueShares.values()).reduce((a, b) => a + b, 0);
        const retention = Math.max(0, 100 - totalCeded);
        return (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2 text-sm"><Shield size={14} /> Outward Reinsurance Summary</h4>
            <div className="flex gap-4">
              <div className="flex-1 text-center">
                <div className="text-[11px] text-blue-600 uppercase font-bold">Total Ceded</div>
                <div className="text-lg font-bold text-blue-800">{totalCeded.toFixed(2)}%</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-[11px] text-emerald-600 uppercase font-bold">Retention</div>
                <div className="text-lg font-bold text-emerald-800">{retention.toFixed(2)}%</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-[11px] text-amber-600 uppercase font-bold">Reinsurers</div>
                <div className="text-lg font-bold text-amber-800">{uniqueShares.size}</div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ── Tab: Premium & Installments ──
  const renderPremium = () => {
    const installments = row.installments || [row.originalData];
    const isDirectSource = isDirect;

    return (
      <div className="space-y-5">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Ref Number</th>
                  <th className="px-4 py-3 text-right">Gross Premium</th>
                  <th className="px-4 py-3 text-right">Net Premium</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-right">FX Rate</th>
                  <th className="px-4 py-3 text-left">Payment Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {installments.map((inst: any, idx: number) => {
                  const refNum = isDirectSource
                    ? (inst.policyNumber || inst.policy_number || '-')
                    : (inst.contractNumber || inst.contract_number || '-');
                  const gross = Number(inst.grossPremium || inst.gross_premium || 0);
                  const net = Number(inst.netPremium || inst.net_premium || 0);
                  const comm = Number(inst.commissionPercent || inst.commission_percent || 0);
                  const fx = inst.exchangeRate || inst.exchange_rate || '-';
                  const payDate = inst.premiumPaymentDate || inst.premium_payment_date || '';
                  const instStatus = inst.status || '-';

                  return (
                    <tr key={inst.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-blue-600 font-medium">{refNum}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtFull(gross, currency)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtFull(net, currency)}</td>
                      <td className="px-4 py-2.5 text-right">{pct(comm)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fx}</td>
                      <td className="px-4 py-2.5 text-gray-600">{payDate ? formatDate(payDate) : '-'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(instStatus)}`}>
                          {instStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Total row */}
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-sm">
                <tr>
                  <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">{fmtFull(row.grossPremium, currency)}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">{fmtFull(row.netPremium, currency)}</td>
                  <td className="px-4 py-3" colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Additional premium details */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="font-bold text-gray-800 mb-3 text-sm">Premium Details</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Field label="Full Premium (FC)" value={fmt(row.fullPremiumForeign, currency)} mono />
            <Field label="Full Premium (NC)" value={fmt(row.fullPremiumNational)} mono />
            <Field label="Gross Premium (NC)" value={fmt(row.grossPremiumNational)} mono />
            <Field label="Net Premium (NC)" value={fmt(row.netPremiumNational)} mono />
            <Field label="Premium (NC)" value={fmt(row.premiumNational)} mono />
            <Field label="Received Premium (FC)" value={fmt(row.receivedPremiumForeign, currency)} mono />
            <Field label="Received Premium (NC)" value={fmt(row.receivedPremiumNational)} mono />
            {row.receivedPremiumCurrency && <Field label="Received Currency" value={row.receivedPremiumCurrency} />}
            {row.receivedPremiumExchangeRate != null && <Field label="Received FX Rate" value={row.receivedPremiumExchangeRate} mono />}
            {row.numberOfSlips != null && <Field label="Number of Slips" value={row.numberOfSlips} />}
          </div>
        </div>
      </div>
    );
  };

  // ── Tab: Reinsurance (Direct) / Treaty Structure (Inward) ──
  const renderReinsurance = () => {
    if (isDirect) {
      return renderDirectReinsurance();
    }
    if (isInward) {
      return renderInwardStructure();
    }
    return null;
  };

  const renderDirectReinsurance = () => {
    if (outwardPolicies.length === 0) {
      return (
        <div className="text-center py-16 text-gray-400">
          <Shield size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No outward reinsurance arrangements</p>
          <p className="text-sm mt-1">This policy has no recorded outward cessions</p>
        </div>
      );
    }

    // Group outward policies by reinsurer — installments repeat the same cededShare
    type ReinsurerRow = { name: string; share: number; cededPremium: number; commission: number; netPremium: number; slipNo: string; status: string };
    const reinsurerMap = new Map<string, ReinsurerRow>();
    for (const op of outwardPolicies) {
      const name = op.reinsurerName || op.insuredName || 'Unknown';
      const share = normalizeCededShare(Number(op.cededShare || 0));
      const existing = reinsurerMap.get(name);
      if (existing) {
        // Sum premiums across installments, keep max share
        existing.cededPremium += Number(op.cededPremiumForeign || op.grossPremium || 0);
        existing.netPremium += Number(op.netPremium || 0);
        if (share > existing.share) existing.share = share;
      } else {
        reinsurerMap.set(name, {
          name,
          share,
          cededPremium: Number(op.cededPremiumForeign || op.grossPremium || 0),
          commission: Number(op.commissionPercent || 0),
          netPremium: Number(op.netPremium || 0),
          slipNo: op.slipNumber || '-',
          status: op.status,
        });
      }
    }
    const reinsurerRows = Array.from(reinsurerMap.values());
    const totalCededShare = reinsurerRows.reduce((sum, r) => sum + r.share, 0);
    const totalCededPremium = reinsurerRows.reduce((sum, r) => sum + r.cededPremium, 0);

    return (
      <div className="space-y-5">
        {/* Summary bar */}
        <div className="flex gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex-1 text-center">
            <div className="text-[11px] text-blue-600 uppercase font-bold">Total Ceded</div>
            <div className="text-xl font-bold text-blue-800">{totalCededShare.toFixed(2)}%</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex-1 text-center">
            <div className="text-[11px] text-emerald-600 uppercase font-bold">Retention</div>
            <div className="text-xl font-bold text-emerald-800">{Math.max(0, 100 - totalCededShare).toFixed(2)}%</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex-1 text-center">
            <div className="text-[11px] text-amber-600 uppercase font-bold">Reinsurers</div>
            <div className="text-xl font-bold text-amber-800">{reinsurerRows.length}</div>
          </div>
        </div>

        {/* Reinsurer table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Reinsurer</th>
                <th className="px-4 py-3 text-right">Share %</th>
                <th className="px-4 py-3 text-right">Ceded Premium</th>
                <th className="px-4 py-3 text-right">Commission %</th>
                <th className="px-4 py-3 text-right">Net RI Premium</th>
                <th className="px-4 py-3 text-left">Slip No</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reinsurerRows.map((rr, idx) => (
                <tr key={rr.name + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{rr.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{rr.share.toFixed(2)}%</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmtFull(rr.cededPremium, currency)}</td>
                  <td className="px-4 py-2.5 text-right">{pct(rr.commission)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmtFull(rr.netPremium, currency)}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-600">{rr.slipNo}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(rr.status)}`}>
                      {rr.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-sm">
              <tr>
                <td className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-right font-mono">{totalCededShare.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right font-mono text-green-700">{fmtFull(totalCededPremium, currency)}</td>
                <td className="px-4 py-3" colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>

        {/* Additional reinsurance fields from the policy */}
        {policy && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-gray-800 mb-3 text-sm">Reinsurance Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Field label="Sum Reinsured (FC)" value={fmt(row.sumReinsuredForeign, currency)} mono />
              <Field label="Sum Reinsured (NC)" value={fmt(row.sumReinsuredNational)} mono />
              <Field label="Reinsurance Commission" value={fmt(row.reinsuranceCommission, currency)} mono />
              <Field label="Net RI Premium" value={fmt(row.netReinsurancePremium, currency)} mono />
              {row.treatyPlacement && <Field label="Treaty Placement" value={row.treatyPlacement} />}
              {row.treatyPremium != null && <Field label="Treaty Premium" value={fmt(row.treatyPremium, currency)} mono />}
              {row.aicCommission != null && <Field label="AIC Commission" value={fmt(row.aicCommission, currency)} mono />}
              {row.aicRetention != null && <Field label="AIC Retention" value={fmt(row.aicRetention, currency)} mono />}
              {row.aicPremium != null && <Field label="AIC Premium" value={fmt(row.aicPremium, currency)} mono />}
              {row.retroSumReinsured != null && <Field label="Retro Sum Reinsured" value={fmt(row.retroSumReinsured, currency)} mono />}
              {row.retroPremium != null && <Field label="Retro Premium" value={fmt(row.retroPremium, currency)} mono />}
              {row.risksCount != null && <Field label="Risks Count" value={row.risksCount} />}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderInwardStructure = () => {
    if (!inward) return null;
    return (
      <div className="space-y-5">
        {/* Structure summary */}
        <div className="flex gap-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex-1 text-center">
            <div className="text-[11px] text-purple-600 uppercase font-bold">Type</div>
            <div className="text-lg font-bold text-purple-800">{inward.type}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex-1 text-center">
            <div className="text-[11px] text-purple-600 uppercase font-bold">Structure</div>
            <div className="text-lg font-bold text-purple-800">{inward.structure === 'PROPORTIONAL' ? 'Proportional' : 'Non-Proportional'}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex-1 text-center">
            <div className="text-[11px] text-purple-600 uppercase font-bold">Our Share</div>
            <div className="text-lg font-bold text-purple-800">{pct(inward.ourShare)}</div>
          </div>
        </div>

        {/* Treaty details */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="font-bold text-gray-800 mb-3 text-sm">Contract Details</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {inward.treatyName && <Field label="Treaty Name" value={inward.treatyName} />}
            {inward.treatyNumber && <Field label="Treaty Number" value={inward.treatyNumber} mono />}
            {inward.layerNumber != null && <Field label="Layer Number" value={inward.layerNumber} />}
            {inward.excessPoint != null && <Field label="Excess Point" value={fmt(inward.excessPoint, currency)} mono />}
            {inward.aggregateLimit != null && <Field label="Aggregate Limit" value={fmt(inward.aggregateLimit, currency)} mono />}
            {inward.aggregateDeductible != null && <Field label="Aggregate Deductible" value={fmt(inward.aggregateDeductible, currency)} mono />}
            <Field label="Limit of Liability" value={fmt(inward.limitOfLiability, currency)} mono />
            {inward.deductible != null && <Field label="Deductible" value={fmt(inward.deductible, currency)} mono />}
            {inward.retention != null && <Field label="Retention" value={fmt(inward.retention, currency)} mono />}
          </div>
        </div>

        {/* Reinstatements & special premiums */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="font-bold text-gray-800 mb-3 text-sm">Reinstatements & Premium</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {inward.reinstatements != null && <Field label="Reinstatements" value={inward.reinstatements} />}
            {inward.reinstatementPremium != null && <Field label="Reinstatement Premium" value={fmt(inward.reinstatementPremium, currency)} mono />}
            {inward.minimumPremium != null && <Field label="Minimum Premium" value={fmt(inward.minimumPremium, currency)} mono />}
            {inward.depositPremium != null && <Field label="Deposit Premium" value={fmt(inward.depositPremium, currency)} mono />}
            {inward.adjustablePremium != null && <Field label="Adjustable Premium" value={fmt(inward.adjustablePremium, currency)} mono />}
            <Field label="Gross Premium" value={fmt(row.grossPremium, currency)} mono />
            <Field label="Net Premium" value={fmt(row.netPremium, currency)} mono />
            <Field label="Commission %" value={pct(inward.commissionPercent)} />
          </div>
        </div>

        {/* Retrocession details */}
        {(row.retroSumReinsured != null || row.retroPremium != null || row.risksCount != null) && (
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h4 className="font-bold text-amber-800 mb-3 text-sm flex items-center gap-2"><Shield size={14} /> Retrocession</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {row.retroSumReinsured != null && <Field label="Retro Sum Reinsured" value={fmt(row.retroSumReinsured, currency)} mono />}
              {row.retroPremium != null && <Field label="Retro Premium" value={fmt(row.retroPremium, currency)} mono />}
              {row.risksCount != null && <Field label="Risks Count" value={row.risksCount} />}
            </div>
          </div>
        )}

        {/* Slip information */}
        {row.slipNumber && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h4 className="font-bold text-blue-800 mb-3 text-sm flex items-center gap-2"><FileText size={14} /> Slip Information</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Field label="Slip Number" value={row.slipNumber} mono />
              {row.dateOfSlip && <Field label="Date of Slip" value={formatDate(row.dateOfSlip)} />}
              {row.numberOfSlips != null && <Field label="Number of Slips" value={row.numberOfSlips} />}
              {row.referenceLink && <Field label="Reference Link" value={row.referenceLink} />}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Tab: Claims ──
  const renderClaims = () => {
    // Claims tab is a placeholder — linking claims requires a separate data fetch.
    return (
      <div className="text-center py-16 text-gray-400">
        <CheckCircle size={48} className="mx-auto mb-4 text-emerald-300" />
        <p className="text-lg font-medium text-gray-500">Claims data not yet linked</p>
        <p className="text-sm mt-1">Claims matching will be available in a future update</p>
      </div>
    );
  };

  // ── Tab: Documents ──
  const renderDocuments = () => (
    <div className="text-center py-16 text-gray-400">
      <Archive size={48} className="mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium text-gray-500">Document management coming soon</p>
      <p className="text-sm mt-1">Upload PDFs, slips, endorsements, and more</p>
    </div>
  );

  // ── Render active tab ──
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'summary': return renderSummary();
      case 'premium': return renderPremium();
      case 'reinsurance': return renderReinsurance();
      case 'claims': return renderClaims();
      case 'documents': return renderDocuments();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="border-b bg-white px-5 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${statusBadge(row.status, row.isDeleted)}`}>
                {row.isDeleted ? 'DELETED' : row.status}
              </span>
              <h2 className="text-lg font-bold text-gray-900 truncate font-mono">{row.referenceNumber}</h2>
              <span className="text-gray-400">—</span>
              <span className="text-gray-700 font-medium truncate">{row.insuredName || row.cedantName || '-'}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              {onEdit && (
                <button
                  onClick={() => onEdit(row)}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  Edit
                </button>
              )}
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
          </div>
          {/* Sub-header metadata */}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sourceColor[row.source] || 'bg-gray-100 text-gray-700'}`}>
              {sourceLabel[row.source] || row.source}
            </span>
            <span>{currency}</span>
            <span>Inception: {formatDate(row.inceptionDate)}</span>
            <span>— Expiry: {formatDate(row.expiryDate)}</span>
            {(row.installmentCount || 0) > 1 && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">
                {row.installmentCount} installments
              </span>
            )}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="border-b bg-gray-50 px-5 flex-shrink-0">
          <div className="flex gap-0 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="h-[70vh] overflow-y-auto p-5 bg-white">
          {renderActiveTab()}
        </div>

        {/* ── Footer ── */}
        <div className="border-t bg-gray-50 px-5 py-3 flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-800 font-medium text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
