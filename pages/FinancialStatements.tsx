import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, AlertCircle } from 'lucide-react';
import { useAnalyticsSummary } from '../hooks/useAnalytics';
import { DB } from '../services/db';
import { exportToExcel } from '../services/excelExport';
import { usePageHeader } from '../context/PageHeaderContext';
import { useTheme } from '../theme/useTheme';

// ─── Helpers ────────────────────────────────────────────────────

const fmt = (value: number): string =>
  value < 0
    ? `($${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`
    : `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtPct = (value: number): string => `${value.toFixed(1)}%`;

// ─── Sub-components ─────────────────────────────────────────────

interface LineItemProps {
  label: string;
  amount?: number;
  ratio?: number;
  indent?: boolean;
  bold?: boolean;
  subtotal?: boolean;
  grandTotal?: boolean;
  negative?: boolean;
}

const LineItem: React.FC<LineItemProps> = ({
  label, amount, ratio, indent, bold, subtotal, grandTotal, negative,
}) => {
  const { t } = useTheme();
  const isNeg = negative || (amount !== undefined && amount < 0);
  return (
    <div
      className={`flex items-baseline justify-between py-1.5 ${
        subtotal ? 'mt-1 pt-2' : ''
      }${grandTotal ? 'mt-2 pt-3 pb-1' : ''}`}
      style={{
        ...(subtotal ? { borderTop: `1px solid ${t.borderL}` } : {}),
        ...(grandTotal ? { borderTop: `4px double ${t.text1}` } : {}),
      }}
    >
      <span
        className={`text-sm ${indent ? 'pl-6' : ''} ${bold || grandTotal ? 'font-semibold' : ''}`}
        style={{ color: bold || grandTotal ? t.text1 : t.text2 }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-8">
        {amount !== undefined && (
          <span
            className={`font-mono text-sm text-right min-w-[140px] ${
              grandTotal ? 'text-base font-bold' : bold ? 'font-semibold' : ''
            }`}
            style={{ color: isNeg ? t.danger : t.text1 }}
          >
            {fmt(amount)}
          </span>
        )}
        {ratio !== undefined && (
          <span
            className="font-mono text-xs text-right min-w-[60px]"
            style={{ color: t.text3 }}
          >
            {fmtPct(ratio)}
          </span>
        )}
        {amount === undefined && ratio === undefined && (
          <span className="min-w-[140px]" />
        )}
      </div>
    </div>
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => {
  const { t } = useTheme();
  return (
    <div className="mt-6 pt-4 mb-1" style={{ borderTop: `1px solid ${t.border}` }}>
      <h4 className="text-xs font-semibold uppercase tracking-widest" style={{ color: t.text4 }}>{title}</h4>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────

const FinancialStatements: React.FC = () => {
  const { t } = useTheme();
  const { data, loading, error, refetch } = useAnalyticsSummary();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const [period, setPeriod] = useState('all');
  const [ibnrTotal, setIbnrTotal] = useState(0);

  useEffect(() => {
    DB.getSetting('ibnr_estimates').then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Record<string, number>;
          setIbnrTotal(Object.values(parsed).reduce((s, v) => s + (Number(v) || 0), 0));
        } catch { /* ignore */ }
      }
    });
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: t.danger }} />
          <h3 className="text-lg font-semibold" style={{ color: t.text1 }}>Failed to load data</h3>
          <p className="mt-1" style={{ color: t.text3 }}>{error}</p>
          <button
            onClick={refetch}
            className="mt-4 px-4 py-2 text-white rounded-lg"
            style={{ background: t.accent }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Extract figures from analytics data
  const total = data?.total;
  const claims = data?.claims;
  const outward = data?.channels.find(c => c.channel === 'outward');

  const gwp = total?.grossWrittenPremium || 0;
  const upr = total?.unearnedPremiumReserve || 0;
  const gpe = total?.grossPremiumEarned || 0;
  const ceded = outward?.grossWrittenPremium || 0;
  const npe = total?.netPremiumEarned || 0;
  const nwp = total?.netWrittenPremium || 0;
  const commission = total?.commission || 0;
  const commissionRatio = total?.commissionRatio || 0;
  const netEarnedRevenue = npe - commission;

  const claimsPaid = claims?.totalPaid || 0;
  const claimsReserveChange = claims?.totalReserve || 0;
  const netClaimsIncurred = claims?.totalIncurred || 0;
  const lossRatio = claims?.lossRatio || 0;

  const operatingExpenses = data?.operatingExpenses || 0;
  const expenseRatio = data?.expenseRatio || 0;

  const underwritingResult = netEarnedRevenue - netClaimsIncurred - ibnrTotal - operatingExpenses;
  const combinedRatio = lossRatio + commissionRatio + expenseRatio;
  const retentionRatio = gwp > 0 ? (nwp / gwp) * 100 : 0;
  const earningRatio = gwp > 0 ? (gpe / gwp) * 100 : 0;

  const handleExport = () => {
    if (!data) return;
    const rows = [
      { 'Line Item': 'INCOME', 'Amount (USD)': '', 'Ratio (%)': '' },
      { 'Line Item': '  Gross Written Premium (GWP)', 'Amount (USD)': gwp, 'Ratio (%)': '' },
      { 'Line Item': '  Change in Unearned Premium Reserve', 'Amount (USD)': -upr, 'Ratio (%)': '' },
      { 'Line Item': '  Gross Premium Earned (GPE)', 'Amount (USD)': gpe, 'Ratio (%)': '' },
      { 'Line Item': '  Less: Reinsurance Ceded', 'Amount (USD)': -ceded, 'Ratio (%)': '' },
      { 'Line Item': '  Net Premium Earned (NPE)', 'Amount (USD)': npe, 'Ratio (%)': '' },
      { 'Line Item': '', 'Amount (USD)': '', 'Ratio (%)': '' },
      { 'Line Item': 'COMMISSIONS', 'Amount (USD)': '', 'Ratio (%)': '' },
      { 'Line Item': '  Gross Commission', 'Amount (USD)': -commission, 'Ratio (%)': commissionRatio },
      { 'Line Item': '  Net Earned Revenue', 'Amount (USD)': netEarnedRevenue, 'Ratio (%)': '' },
      { 'Line Item': '', 'Amount (USD)': '', 'Ratio (%)': '' },
      { 'Line Item': 'CLAIMS', 'Amount (USD)': '', 'Ratio (%)': '' },
      { 'Line Item': '  Claims Paid', 'Amount (USD)': -claimsPaid, 'Ratio (%)': '' },
      { 'Line Item': '  Change in Claims Reserves', 'Amount (USD)': -claimsReserveChange, 'Ratio (%)': '' },
      { 'Line Item': '  Net Claims Incurred', 'Amount (USD)': -netClaimsIncurred, 'Ratio (%)': lossRatio },
      { 'Line Item': '  IBNR Reserve', 'Amount (USD)': -ibnrTotal, 'Ratio (%)': '' },
      { 'Line Item': '', 'Amount (USD)': '', 'Ratio (%)': '' },
      { 'Line Item': 'OPERATING EXPENSES', 'Amount (USD)': '', 'Ratio (%)': '' },
      { 'Line Item': '  Operating Expenses', 'Amount (USD)': -operatingExpenses, 'Ratio (%)': expenseRatio },
      { 'Line Item': '', 'Amount (USD)': '', 'Ratio (%)': '' },
      { 'Line Item': 'UNDERWRITING RESULT', 'Amount (USD)': underwritingResult, 'Ratio (%)': '' },
      { 'Line Item': '', 'Amount (USD)': '', 'Ratio (%)': '' },
      { 'Line Item': 'KEY RATIOS', 'Amount (USD)': '', 'Ratio (%)': '' },
      { 'Line Item': '  Loss Ratio', 'Amount (USD)': '', 'Ratio (%)': lossRatio },
      { 'Line Item': '  Commission Ratio', 'Amount (USD)': '', 'Ratio (%)': commissionRatio },
      { 'Line Item': '  Expense Ratio', 'Amount (USD)': '', 'Ratio (%)': expenseRatio },
      { 'Line Item': '  Combined Ratio', 'Amount (USD)': '', 'Ratio (%)': combinedRatio },
      { 'Line Item': '  Retention Ratio', 'Amount (USD)': '', 'Ratio (%)': retentionRatio },
      { 'Line Item': '  Earning Ratio', 'Amount (USD)': '', 'Ratio (%)': earningRatio },
    ];
    exportToExcel(rows, `Technical_Account_PL_${new Date().toISOString().split('T')[0]}`, 'Technical Account');
  };

  // Period selector + Export + Refresh in page header
  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-2">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          style={{ border: `1px solid ${t.border}`, background: t.bgPanel, color: t.text1 }}
        >
          <option value="current_year">Current Year</option>
          <option value="last_12">Last 12 Months</option>
          <option value="all">All Time</option>
        </select>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="p-2 rounded-lg disabled:opacity-50"
          style={{ color: t.text3 }}
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={loading ? { color: t.accent } : undefined} />
        </button>
        <button
          onClick={handleExport}
          disabled={!data}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: t.shadow }}
        >
          <Download size={16} /> Export
        </button>
      </div>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [data, loading, period, setHeaderActions, setHeaderLeft, t]);

  return (
    <div className="max-w-3xl mx-auto">

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin" size={32} style={{ color: t.accent }} />
        </div>
      ) : data ? (
        <div className="rounded-xl" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          {/* Statement Header */}
          <div className="px-8 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: t.text1 }}>
              Technical Account — Profit & Loss
            </h2>
            <p className="text-xs mt-1" style={{ color: t.text4 }}>
              Period: {period === 'current_year' ? 'Current Year' : period === 'last_12' ? 'Last 12 Months' : 'All Time'} &nbsp;|&nbsp; Currency: USD
            </p>
          </div>

          {/* Statement Body */}
          <div className="px-8 py-6">

            {/* INCOME */}
            <SectionHeader title="Income" />
            <LineItem label="Gross Written Premium (GWP)" amount={gwp} />
            <LineItem label="Change in Unearned Premium Reserve" amount={-upr} indent negative />
            <LineItem label="Gross Premium Earned (GPE)" amount={gpe} subtotal bold />

            <div className="mt-3" />
            <LineItem label="Less: Reinsurance Ceded" amount={-ceded} indent negative />
            <LineItem label="Net Premium Earned (NPE)" amount={npe} subtotal bold />

            {/* COMMISSIONS */}
            <SectionHeader title="Commissions" />
            <LineItem label="Gross Commission" amount={-commission} negative />
            <LineItem label="Commission Ratio" ratio={commissionRatio} indent />
            <LineItem label="Net Earned Revenue" amount={netEarnedRevenue} subtotal bold />

            {/* CLAIMS */}
            <SectionHeader title="Claims" />
            <LineItem label="Claims Paid" amount={-claimsPaid} negative />
            <LineItem label="Change in Claims Reserves" amount={-claimsReserveChange} indent negative />
            <LineItem label="Net Claims Incurred" amount={-netClaimsIncurred} subtotal negative bold />
            <LineItem
              label={ibnrTotal > 0 ? 'IBNR Reserve' : 'IBNR Reserve (not estimated)'}
              amount={-ibnrTotal}
              indent
              negative={ibnrTotal > 0}
            />
            <LineItem label="Loss Ratio" ratio={lossRatio} indent />

            {/* OPERATING EXPENSES */}
            <SectionHeader title="Operating Expenses" />
            <LineItem
              label={operatingExpenses > 0 ? 'Operating Expenses' : 'Operating Expenses (not configured)'}
              amount={-operatingExpenses}
              negative={operatingExpenses > 0}
            />
            {operatingExpenses > 0 && (
              <LineItem label="Expense Ratio" ratio={expenseRatio} indent />
            )}

            {/* UNDERWRITING RESULT */}
            <LineItem
              label="Underwriting Result"
              amount={underwritingResult}
              grandTotal
              negative={underwritingResult < 0}
            />

            <div className="mt-2 text-right">
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={combinedRatio < 100
                  ? { background: t.successBg, color: t.success }
                  : { background: t.dangerBg, color: t.danger }
                }
              >
                Combined Ratio: {fmtPct(combinedRatio)}
              </span>
            </div>

            {/* KEY RATIOS */}
            <SectionHeader title="Key Ratios" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-2">
              {[
                ['Loss Ratio (Claims / GPE)', lossRatio],
                ['Commission Ratio (Comm / GWP)', commissionRatio],
                ['Expense Ratio (OpEx / NPE)', expenseRatio],
                ['Combined Ratio', combinedRatio],
                ['Retention Ratio (NWP / GWP)', retentionRatio],
                ['Earning Ratio (GPE / GWP)', earningRatio],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="flex justify-between py-1.5"
                  style={{ borderBottom: `1px solid ${t.borderS}` }}
                >
                  <span className="text-sm" style={{ color: t.text2 }}>{label as string}</span>
                  <span
                    className="font-mono text-sm font-medium"
                    style={{
                      color: (label as string).includes('Combined') && (value as number) >= 100
                        ? t.danger
                        : (label as string).includes('Combined') && (value as number) < 100
                          ? t.success
                          : t.text1,
                    }}
                  >
                    {fmtPct(value as number)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FinancialStatements;
