import React, { useState } from 'react';
import { PortfolioRow, Policy, InwardReinsurance, PolicyStatus } from '../types';
import { formatDate } from '../utils/dateUtils';
import { useTheme } from '../theme/useTheme';
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

const sourceLabel: Record<string, string> = {
  direct: 'Direct Insurance',
  'inward-foreign': 'Inward Reinsurance — Foreign',
  'inward-domestic': 'Inward Reinsurance — Domestic',
};

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
  const { t } = useTheme();
  const currency = row.currency || 'USD';
  const isInward = row.source === 'inward-foreign' || row.source === 'inward-domestic';
  const isDirect = row.source === 'direct';

  // sourceColor as inline style objects
  const sourceColorStyle: Record<string, React.CSSProperties> = {
    direct: { background: t.accent + '30', color: t.accent },
    'inward-foreign': { background: '#a855f730', color: '#a855f7' },
    'inward-domestic': { background: t.success + '30', color: t.success },
  };

  const defaultSourceStyle: React.CSSProperties = { background: t.bgHover, color: t.text2 };

  // statusBadge as inline style objects
  const getStatusBadgeStyle = (status: string, isDeleted?: boolean): React.CSSProperties => {
    if (isDeleted) return { background: '#dc2626', color: '#ffffff' };
    const s = status?.toUpperCase() || '';
    if (s.includes('ACTIVE') || s === 'BOUND' || s === 'SIGNED') return { background: t.success + '30', color: t.success };
    if (s.includes('PENDING') || s === 'DRAFT' || s === 'QUOTED') return { background: t.warning + '30', color: t.warning };
    if (s.includes('CANCEL') || s === 'NTU' || s === 'DECLINED') return { background: '#ef444430', color: '#ef4444' };
    if (s.includes('EXPIRED') || s === 'CLOSED') return { background: t.bgHover, color: t.text3 };
    return { background: t.bgHover, color: t.text2 };
  };

  // Field row helper (inline, uses theme)
  const Field: React.FC<{ label: string; value?: string | number | null; mono?: boolean; style?: React.CSSProperties }> = ({ label, value, mono, style }) => (
    <div style={style}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>{label}</div>
      <div style={{ fontSize: 14, color: t.text1, fontWeight: 500, ...(mono ? { fontFamily: "'JetBrains Mono', monospace" } : {}) }}>{value ?? '-'}</div>
    </div>
  );

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        {/* Left: Core Info */}
        <div>
          <h4 style={{ paddingBottom: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: t.text1, borderBottom: `1px solid ${t.border}`, fontWeight: 700 }}><Building2 size={14} /> Core Information</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 16, rowGap: 12 }}>
            <Field label="Policy / Ref No" value={row.referenceNumber} mono />
            {row.secondaryRef && <Field label="Secondary Ref" value={row.secondaryRef} mono />}
            <Field label="Insured Name" value={row.insuredName} style={{ gridColumn: 'span 2' }} />
            {row.insuredAddress && <Field label="Insured Address" value={row.insuredAddress} style={{ gridColumn: 'span 2' }} />}
            {row.cedantName && (
              <div style={{ gridColumn: 'span 2', padding: 8, borderRadius: 4, background: '#a855f718', border: `1px solid #a855f740` }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#a855f7', fontWeight: 700 }}>Cedant</div>
                <div style={{ fontSize: 14, color: '#a855f7', fontWeight: 500 }}>{row.cedantName}</div>
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
          <h4 style={{ paddingBottom: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: t.text1, borderBottom: `1px solid ${t.border}`, fontWeight: 700 }}><Calendar size={14} /> Key Dates</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 16, rowGap: 12 }}>
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
            <div style={{ marginTop: 20 }}>
              <h4 style={{ paddingBottom: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: t.text1, borderBottom: `1px solid ${t.border}`, fontWeight: 700 }}><Layers size={14} /> Contract Structure</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 16, rowGap: 12 }}>
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
      <div style={{ padding: 20, borderRadius: 12, background: t.bgCard, border: `1px solid ${t.border}` }}>
        <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: t.text1, fontWeight: 700 }}><DollarSign size={14} /> Financial Summary ({currency})</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, fontSize: 14 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Sum Insured</div>
            <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 700 }}>{fmt(row.sumInsured, currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Limit (FC)</div>
            <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 700 }}>{fmt(row.limit, currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Limit (NC)</div>
            <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 700 }}>{fmt(row.limitNational)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Excess</div>
            <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 500 }}>{fmt(row.excess, currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Priority Sum</div>
            <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 500 }}>{fmt(row.prioritySum, currency)}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, fontSize: 14, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Gross Premium</div>
            <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: t.success, fontWeight: 700 }}>{fmt(row.grossPremium, currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Net Premium</div>
            <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: t.accent, fontWeight: 700 }}>{fmt(row.netPremium, currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Our Share</div>
            <div style={{ fontSize: 16, color: t.text1, fontWeight: 700 }}>{pct(row.ourShare)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Premium Rate</div>
            <div style={{ fontSize: 16, color: t.text1, fontWeight: 500 }}>{row.premiumRate != null ? `${row.premiumRate}%` : '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Commission %</div>
            <div style={{ fontSize: 16, color: t.text1, fontWeight: 500 }}>{pct(row.commissionPercent)}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, fontSize: 14, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Commission (NC)</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 500 }}>{fmt(row.commissionNational)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Tax %</div>
            <div style={{ color: t.text1, fontWeight: 500 }}>{row.taxPercent != null ? `${row.taxPercent}%` : '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>FX Rate</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 500 }}>{row.exchangeRate ?? '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>FX Rate (USD)</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 500 }}>{row.exchangeRateUSD ?? '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.text4 }}>Equivalent USD</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 500 }}>{fmt(row.equivalentUSD, 'USD')}</div>
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
          <div style={{ padding: 16, borderRadius: 12, background: t.accent + '18', border: `1px solid ${t.accent}40` }}>
            <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: t.accent, fontWeight: 700 }}><Shield size={14} /> Outward Reinsurance Summary</h4>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.accent, fontWeight: 700 }}>Total Ceded</div>
                <div style={{ color: t.accent, fontSize: 15, fontWeight: 700 }}>{totalCeded.toFixed(2)}%</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.success, fontWeight: 700 }}>Retention</div>
                <div style={{ color: t.success, fontSize: 15, fontWeight: 700 }}>{retention.toFixed(2)}%</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.warning, fontWeight: 700 }}>Reinsurers</div>
                <div style={{ color: t.warning, fontSize: 15, fontWeight: 700 }}>{uniqueShares.size}</div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ borderRadius: 8, overflow: 'hidden', background: t.bgPanel, border: `1px solid ${t.border}` }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 14 }}>
              <thead style={{ fontSize: 12, textTransform: 'uppercase', background: t.bgCard, borderBottom: `1px solid ${t.border}`, color: t.text3, fontWeight: 600 }}>
                <tr>
                  <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left' }}>#</th>
                  <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left' }}>Ref Number</th>
                  <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>Gross Premium</th>
                  <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>Net Premium</th>
                  <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>Commission</th>
                  <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>FX Rate</th>
                  <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left' }}>Payment Date</th>
                  <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody style={{ borderColor: t.border }}>
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
                    <tr key={inst.id || idx} style={{ background: idx % 2 === 0 ? t.bgPanel : t.bgRowAlt, borderBottom: `1px solid ${t.border}` }}>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, color: t.text4 }}>{idx + 1}</td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: t.accent, fontWeight: 500 }}>{refNum}</td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{fmtFull(gross, currency)}</td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{fmtFull(net, currency)}</td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, textAlign: 'right' }}>{pct(comm)}</td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: t.text3 }}>{fx}</td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, color: t.text3 }}>{payDate ? formatDate(payDate) : '-'}</td>
                      <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, textAlign: 'center' }}>
                        <span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 9999, fontSize: 10, fontWeight: 700, ...getStatusBadgeStyle(instStatus) }}>
                          {instStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Total row */}
              <tfoot style={{ fontSize: 14, background: t.bgHover, borderTop: `2px solid ${t.border}`, fontWeight: 700 }}>
                <tr>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }} colSpan={2}>TOTAL</td>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: t.success }}>{fmtFull(row.grossPremium, currency)}</td>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: t.accent }}>{fmtFull(row.netPremium, currency)}</td>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }} colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Additional premium details */}
        <div style={{ padding: 16, borderRadius: 12, background: t.bgCard, border: `1px solid ${t.border}` }}>
          <h4 style={{ marginBottom: 12, fontSize: 14, color: t.text1, fontWeight: 700 }}>Premium Details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 14 }}>
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
        <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: t.text4 }}>
          <Shield size={48} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 16, opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 500 }}>No outward reinsurance arrangements</p>
          <p style={{ fontSize: 14, marginTop: 4 }}>This policy has no recorded outward cessions</p>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Summary bar */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ borderRadius: 8, padding: 12, flex: 1, textAlign: 'center', background: t.accent + '18', border: `1px solid ${t.accent}40` }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.accent, fontWeight: 700 }}>Total Ceded</div>
            <div style={{ color: t.accent, fontSize: 15, fontWeight: 700 }}>{totalCededShare.toFixed(2)}%</div>
          </div>
          <div style={{ borderRadius: 8, padding: 12, flex: 1, textAlign: 'center', background: t.success + '18', border: `1px solid ${t.success}40` }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.success, fontWeight: 700 }}>Retention</div>
            <div style={{ color: t.success, fontSize: 15, fontWeight: 700 }}>{Math.max(0, 100 - totalCededShare).toFixed(2)}%</div>
          </div>
          <div style={{ borderRadius: 8, padding: 12, flex: 1, textAlign: 'center', background: t.warning + '18', border: `1px solid ${t.warning}40` }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: t.warning, fontWeight: 700 }}>Reinsurers</div>
            <div style={{ color: t.warning, fontSize: 15, fontWeight: 700 }}>{reinsurerRows.length}</div>
          </div>
        </div>

        {/* Reinsurer table */}
        <div style={{ borderRadius: 8, overflow: 'hidden', background: t.bgPanel, border: `1px solid ${t.border}` }}>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 14 }}>
            <thead style={{ fontSize: 12, textTransform: 'uppercase', background: t.bgCard, borderBottom: `1px solid ${t.border}`, color: t.text3, fontWeight: 600 }}>
              <tr>
                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left' }}>Reinsurer</th>
                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>Share %</th>
                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>Ceded Premium</th>
                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>Commission %</th>
                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>Net RI Premium</th>
                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left' }}>Slip No</th>
                <th style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody style={{ borderColor: t.border }}>
              {reinsurerRows.map((rr, idx) => (
                <tr key={rr.name + idx} style={{ background: idx % 2 === 0 ? t.bgPanel : t.bgRowAlt, borderBottom: `1px solid ${t.border}` }}>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, color: t.text1, fontWeight: 500 }}>{rr.name}</td>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{rr.share.toFixed(2)}%</td>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{fmtFull(rr.cededPremium, currency)}</td>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, textAlign: 'right' }}>{pct(rr.commission)}</td>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{fmtFull(rr.netPremium, currency)}</td>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: t.text3 }}>{rr.slipNo}</td>
                  <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, textAlign: 'center' }}>
                    <span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 9999, fontSize: 10, fontWeight: 700, ...getStatusBadgeStyle(rr.status) }}>
                      {rr.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ fontSize: 14, background: t.bgHover, borderTop: `2px solid ${t.border}`, fontWeight: 700 }}>
              <tr>
                <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}>TOTAL</td>
                <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{totalCededShare.toFixed(2)}%</td>
                <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: t.success }}>{fmtFull(totalCededPremium, currency)}</td>
                <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }} colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>

        {/* Additional reinsurance fields from the policy */}
        {policy && (
          <div style={{ padding: 16, borderRadius: 12, background: t.bgCard, border: `1px solid ${t.border}` }}>
            <h4 style={{ marginBottom: 12, fontSize: 14, color: t.text1, fontWeight: 700 }}>Reinsurance Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 14 }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Structure summary */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ borderRadius: 8, padding: 12, flex: 1, textAlign: 'center', background: '#a855f718', border: `1px solid #a855f740` }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#a855f7', fontWeight: 700 }}>Type</div>
            <div style={{ color: '#a855f7', fontSize: 15, fontWeight: 700 }}>{inward.type}</div>
          </div>
          <div style={{ borderRadius: 8, padding: 12, flex: 1, textAlign: 'center', background: '#a855f718', border: `1px solid #a855f740` }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#a855f7', fontWeight: 700 }}>Structure</div>
            <div style={{ color: '#a855f7', fontSize: 15, fontWeight: 700 }}>{inward.structure === 'PROPORTIONAL' ? 'Proportional' : 'Non-Proportional'}</div>
          </div>
          <div style={{ borderRadius: 8, padding: 12, flex: 1, textAlign: 'center', background: '#a855f718', border: `1px solid #a855f740` }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#a855f7', fontWeight: 700 }}>Our Share</div>
            <div style={{ color: '#a855f7', fontSize: 15, fontWeight: 700 }}>{pct(inward.ourShare)}</div>
          </div>
        </div>

        {/* Treaty details */}
        <div style={{ padding: 16, borderRadius: 12, background: t.bgCard, border: `1px solid ${t.border}` }}>
          <h4 style={{ marginBottom: 12, fontSize: 14, color: t.text1, fontWeight: 700 }}>Contract Details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 14 }}>
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
        <div style={{ padding: 16, borderRadius: 12, background: t.bgCard, border: `1px solid ${t.border}` }}>
          <h4 style={{ marginBottom: 12, fontSize: 14, color: t.text1, fontWeight: 700 }}>Reinstatements & Premium</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 14 }}>
            {inward.reinstatements != null && <Field label="Reinstatements" value={inward.reinstatements} />}
            {inward.reinstatementPremium != null && <Field label="Reinstatement Premium" value={fmt(inward.reinstatementPremium, currency)} mono />}
            {inward.minimumPremium != null && <Field label="Minimum Premium" value={fmt(inward.minimumPremium, currency)} mono />}
            {inward.depositPremium != null && <Field label="Deposit Premium" value={fmt(inward.depositPremium, currency)} mono />}
            {inward.adjustablePremium != null && <Field label="Adjustable Premium" value={fmt(Number(inward.adjustablePremium), currency)} mono />}
            <Field label="Gross Premium" value={fmt(row.grossPremium, currency)} mono />
            <Field label="Net Premium" value={fmt(row.netPremium, currency)} mono />
            <Field label="Commission %" value={pct(inward.commissionPercent)} />
          </div>
        </div>

        {/* Retrocession details */}
        {(row.retroSumReinsured != null || row.retroPremium != null || row.risksCount != null) && (
          <div style={{ padding: 16, borderRadius: 12, background: t.warning + '18', border: `1px solid ${t.warning}40` }}>
            <h4 style={{ marginBottom: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: t.warning, fontWeight: 700 }}><Shield size={14} /> Retrocession</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 14 }}>
              {row.retroSumReinsured != null && <Field label="Retro Sum Reinsured" value={fmt(row.retroSumReinsured, currency)} mono />}
              {row.retroPremium != null && <Field label="Retro Premium" value={fmt(row.retroPremium, currency)} mono />}
              {row.risksCount != null && <Field label="Risks Count" value={row.risksCount} />}
            </div>
          </div>
        )}

        {/* Slip information */}
        {row.slipNumber && (
          <div style={{ padding: 16, borderRadius: 12, background: t.accent + '18', border: `1px solid ${t.accent}40` }}>
            <h4 style={{ marginBottom: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: t.accent, fontWeight: 700 }}><FileText size={14} /> Slip Information</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 14 }}>
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
      <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: t.text4 }}>
        <CheckCircle size={48} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 16, color: t.success }} />
        <p style={{ color: t.text4, fontSize: 15, fontWeight: 500 }}>Claims data not yet linked</p>
        <p style={{ fontSize: 14, marginTop: 4 }}>Claims matching will be available in a future update</p>
      </div>
    );
  };

  // ── Tab: Documents ──
  const renderDocuments = () => (
    <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: t.text4 }}>
      <Archive size={48} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 16, opacity: 0.3 }} />
      <p style={{ color: t.text4, fontSize: 15, fontWeight: 500 }}>Document management coming soon</p>
      <p style={{ fontSize: 14, marginTop: 4 }}>Upload PDFs, slips, endorsements, and more</p>
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
    <div className="backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="animate-in fade-in zoom-in"
        style={{ borderRadius: 12, width: '100%', maxWidth: 1152, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowLg }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, flexShrink: 0, borderBottom: `1px solid ${t.border}`, background: t.bgPanel }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <span style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 12, flexShrink: 0, fontWeight: 700, ...getStatusBadgeStyle(row.status, row.isDeleted) }}>
                {row.isDeleted ? 'DELETED' : row.status}
              </span>
              <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontSize: 15, fontWeight: 700 }}>{row.referenceNumber}</h2>
              <span style={{ color: t.text4 }}>—</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text2, fontWeight: 500 }}>{row.insuredName || row.cedantName || '-'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
              {onEdit && (
                <button
                  onClick={() => onEdit(row)}
                  style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 14, borderRadius: 8, color: t.accent, border: `1px solid ${t.accent}40`, fontWeight: 500, background: 'transparent', cursor: 'pointer' }}
                >
                  Edit
                </button>
              )}
              <button onClick={onClose} style={{ padding: 6, borderRadius: 8, color: t.text4, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
          </div>
          {/* Sub-header metadata */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 12, color: t.text4 }}>
            <span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4, fontSize: 10, fontWeight: 700, ...(sourceColorStyle[row.source] || defaultSourceStyle) }}>
              {sourceLabel[row.source] || row.source}
            </span>
            <span>{currency}</span>
            <span>Inception: {formatDate(row.inceptionDate)}</span>
            <span>— Expiry: {formatDate(row.expiryDate)}</span>
            {(row.installmentCount || 0) > 1 && (
              <span style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 9999, background: t.accent + '30', color: t.accent, fontWeight: 700 }}>
                {row.installmentCount} installments
              </span>
            )}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ paddingLeft: 20, paddingRight: 20, flexShrink: 0, borderBottom: `1px solid ${t.border}`, background: t.bgCard }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={
                  activeTab === tab.key
                    ? { display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, fontSize: 14, borderBottom: `2px solid ${t.accent}`, color: t.accent, background: t.bgPanel, fontWeight: 500, border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: t.accent, cursor: 'pointer' }
                    : { display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, fontSize: 14, borderBottom: '2px solid transparent', color: t.text4, fontWeight: 500, background: 'transparent', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', cursor: 'pointer' }
                }
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ height: '70vh', overflowY: 'auto', padding: 20, background: t.bgPanel }}>
          {renderActiveTab()}
        </div>

        {/* ── Footer ── */}
        <div style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0, borderTop: `1px solid ${t.border}`, background: t.bgCard }}>
          <button
            onClick={onClose}
            style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, background: t.bgHover, color: t.text1, fontWeight: 500, border: 'none', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
