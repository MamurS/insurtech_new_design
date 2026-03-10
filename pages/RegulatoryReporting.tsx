import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, AlertCircle, Printer } from 'lucide-react';
import { useAnalyticsSummary } from '../hooks/useAnalytics';
import { DB } from '../services/db';
import { exportToExcel } from '../services/excelExport';
import { useToast } from '../context/ToastContext';
import { usePageHeader } from '../context/PageHeaderContext';
import { useTheme } from '../theme/useTheme';

// ─── Helpers ────────────────────────────────────────────────────

const fmt = (value: number): string =>
  value < 0
    ? `(${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`
    : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtPct = (value: number): string => `${value.toFixed(1)}%`;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

type TabKey = 'form1' | 'form2' | 'form3' | 'form4';

interface SolvencyData {
  totalAssets: number;
  totalLiabilities: number;
  minCapitalRequirement: number;
}

interface ReinsuranceData {
  proportional: number;
  nonProportional: number;
  facultative: number;
  recoveries: number;
  contractCount: number;
  topReinsurers: string;
}

// ─── Main Component ─────────────────────────────────────────────

const RegulatoryReporting: React.FC = () => {
  const { t } = useTheme();
  const { data, loading, error, refetch } = useAnalyticsSummary();
  const { showToast } = useToast();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();

  const [activeTab, setActiveTab] = useState<TabKey>('form1');
  const [quarter, setQuarter] = useState<string>(QUARTERS[Math.floor((new Date().getMonth()) / 3)]);
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [exchangeRate, setExchangeRate] = useState<number>(12800);

  // IBNR + operating expenses from settings
  const [ibnrTotal, setIbnrTotal] = useState(0);
  const [ibnrByClass, setIbnrByClass] = useState<Record<string, number>>({});
  const [operatingExpenses, setOperatingExpenses] = useState(0);

  // Solvency manual inputs
  const [solvency, setSolvency] = useState<SolvencyData>({
    totalAssets: 0, totalLiabilities: 0, minCapitalRequirement: 0,
  });
  const [solvencySaving, setSolvencySaving] = useState(false);

  // Reinsurance manual inputs
  const [reinsurance, setReinsurance] = useState<ReinsuranceData>({
    proportional: 0, nonProportional: 0, facultative: 0,
    recoveries: 0, contractCount: 0, topReinsurers: '',
  });

  useEffect(() => {
    Promise.all([
      DB.getSetting('ibnr_estimates'),
      DB.getSetting('annual_operating_expenses'),
      DB.getSetting('solvency_data'),
      DB.getSetting('reinsurance_report_data'),
    ]).then(([ibnrRaw, expRaw, solRaw, reinsRaw]) => {
      if (ibnrRaw) {
        try {
          const parsed = JSON.parse(ibnrRaw) as Record<string, number>;
          setIbnrByClass(parsed);
          setIbnrTotal(Object.values(parsed).reduce((s, v) => s + (Number(v) || 0), 0));
        } catch { /* ignore */ }
      }
      if (expRaw) setOperatingExpenses(Number(expRaw) || 0);
      if (solRaw) {
        try { setSolvency(JSON.parse(solRaw)); } catch { /* ignore */ }
      }
      if (reinsRaw) {
        try { setReinsurance(JSON.parse(reinsRaw)); } catch { /* ignore */ }
      }
    });
  }, []);

  // Save solvency data
  const saveSolvency = async () => {
    setSolvencySaving(true);
    try {
      await DB.setSetting('solvency_data', JSON.stringify(solvency));
      showToast('Solvency data saved', 'success');
    } catch { showToast('Failed to save', 'error'); }
    setSolvencySaving(false);
  };

  // Save reinsurance data
  const saveReinsurance = async () => {
    try {
      await DB.setSetting('reinsurance_report_data', JSON.stringify(reinsurance));
      showToast('Reinsurance data saved', 'success');
    } catch { showToast('Failed to save', 'error'); }
  };

  // Currency conversion helpers
  const toUZS = (usd: number) => usd * exchangeRate;

  // ── Extract data from analytics ──
  const total = data?.total;
  const claims = data?.claims;
  const outward = data?.channels.find(c => c.channel === 'outward');
  const direct = data?.channels.find(c => c.channel === 'direct');
  const inwardForeign = data?.channels.find(c => c.channel === 'inward-foreign');
  const inwardDomestic = data?.channels.find(c => c.channel === 'inward-domestic');

  const gwp = total?.grossWrittenPremium || 0;
  const directGwp = direct?.grossWrittenPremium || 0;
  const inwardForeignGwp = inwardForeign?.grossWrittenPremium || 0;
  const inwardDomesticGwp = inwardDomestic?.grossWrittenPremium || 0;
  const ceded = outward?.grossWrittenPremium || 0;
  const nwp = total?.netWrittenPremium || 0;
  const upr = total?.unearnedPremiumReserve || 0;
  const npe = total?.netPremiumEarned || 0;

  const claimsPaid = claims?.totalPaid || 0;
  const directClaimsPaid = claimsPaid; // approximation (all claims for now)
  const claimsReserve = claims?.totalReserve || 0;
  const totalClaimsIncurred = claimsPaid + claimsReserve + ibnrTotal;

  const commission = total?.commission || 0;
  const commissionRatio = total?.commissionRatio || 0;
  const lossRatio = claims?.lossRatio || 0;
  const expenseRatio = data?.expenseRatio || 0;
  const combinedRatio = lossRatio + commissionRatio + expenseRatio;
  const retentionRatio = gwp > 0 ? (nwp / gwp) * 100 : 0;

  const underwritingResult = npe - totalClaimsIncurred - commission + 0 /* commIncome placeholder */ - operatingExpenses;

  // Form 1 rows
  const form1Rows = [
    { row: '1', label: 'Gross Written Premium - Total / Начисленная страховая премия — Итого', usd: gwp, isTotal: true },
    { row: '1.1', label: '— Direct Insurance / Прямое страхование', usd: directGwp, indent: true },
    { row: '1.2', label: '— Inward Reinsurance (Foreign) / Входящее перестрахование (зарубежное)', usd: inwardForeignGwp, indent: true },
    { row: '1.3', label: '— Inward Reinsurance (Domestic) / Входящее перестрахование (внутреннее)', usd: inwardDomesticGwp, indent: true },
    { row: '2', label: 'Reinsurance Premium Ceded / Премия, переданная в перестрахование', usd: ceded },
    { row: '3', label: 'Net Written Premium (row 1 - row 2) / Чистая начисленная премия', usd: nwp, isTotal: true },
    { row: '4', label: 'Change in Unearned Premium Reserve / Изменение резерва незаработанной премии', usd: -upr },
    { row: '5', label: 'Net Premium Earned / Чистая заработанная премия', usd: npe, isTotal: true },
    { row: '6', label: 'Claims Paid - Total / Выплаты по убыткам — Итого', usd: -claimsPaid, isTotal: true },
    { row: '6.1', label: '— Direct Insurance / Прямое страхование', usd: -directClaimsPaid, indent: true },
    { row: '6.2', label: '— Inward Reinsurance / Входящее перестрахование', usd: 0, indent: true },
    { row: '7', label: 'Claims Reserved (Outstanding) / Резервы заявленных убытков', usd: -claimsReserve },
    { row: '8', label: 'IBNR Reserve / Резерв РПНУ (IBNR)', usd: -ibnrTotal },
    { row: '9', label: 'Total Claims Incurred (6+7+8) / Понесённые убытки — Итого', usd: -totalClaimsIncurred, isTotal: true },
    { row: '10', label: 'Commission Income / Комиссионный доход', usd: 0 },
    { row: '11', label: 'Commission Expense / Комиссионный расход', usd: -commission },
    { row: '12', label: 'Operating Expenses / Операционные расходы', usd: -operatingExpenses },
    { row: '13', label: 'UNDERWRITING RESULT (5-9-11+10-12) / РЕЗУЛЬТАТ СТРАХОВОЙ ДЕЯТЕЛЬНОСТИ', usd: underwritingResult, isTotal: true, isGrandTotal: true },
  ];

  // Solvency calculations
  const netAssets = solvency.totalAssets - solvency.totalLiabilities;
  const solvencyMargin = netAssets - solvency.minCapitalRequirement;
  const solvencyRatio = solvency.minCapitalRequirement > 0 ? (netAssets / solvency.minCapitalRequirement) * 100 : 0;

  const getSolvencyBadge = () => {
    if (solvencyRatio <= 0 || solvency.minCapitalRequirement === 0) return { label: 'NO DATA', bg: t.bgCard, color: t.text2 };
    if (solvencyRatio >= 120) return { label: 'SOLVENT', bg: t.successBg, color: t.success };
    if (solvencyRatio >= 100) return { label: 'WARNING', bg: t.warningBg, color: t.warning };
    return { label: 'INSUFFICIENT', bg: t.dangerBg, color: t.danger };
  };

  // Reserves by class
  const reservesByClass = (data?.lossRatioByClass || []).map(cls => {
    const classIbnr = ibnrByClass[cls.class] || 0;
    return {
      class: cls.class,
      upr: 0, // would need per-class UPR - approximation
      outstandingClaims: cls.incurredLosses,
      ibnr: classIbnr,
      totalReserves: cls.incurredLosses + classIbnr,
    };
  });

  // Reinsurance calculations
  const totalCeded = reinsurance.proportional + reinsurance.nonProportional + reinsurance.facultative;
  const netReinsPosition = totalCeded - reinsurance.recoveries;
  const cessionRatio = gwp > 0 ? (ceded / gwp) * 100 : 0;

  // ── Export handlers ──
  const handleExportForm1 = () => {
    const rows = form1Rows.map(r => ({
      'Row': r.row,
      'Indicator': r.label,
      'Amount (USD)': r.usd,
      'Amount (UZS)': toUZS(r.usd),
    }));
    rows.push({ 'Row': '', 'Indicator': '', 'Amount (USD)': 0, 'Amount (UZS)': 0 });
    rows.push({ 'Row': '', 'Indicator': 'KEY RATIOS', 'Amount (USD)': 0, 'Amount (UZS)': 0 });
    rows.push({ 'Row': '', 'Indicator': `Loss Ratio: ${fmtPct(lossRatio)}`, 'Amount (USD)': 0, 'Amount (UZS)': 0 });
    rows.push({ 'Row': '', 'Indicator': `Commission Ratio: ${fmtPct(commissionRatio)}`, 'Amount (USD)': 0, 'Amount (UZS)': 0 });
    rows.push({ 'Row': '', 'Indicator': `Expense Ratio: ${fmtPct(expenseRatio)}`, 'Amount (USD)': 0, 'Amount (UZS)': 0 });
    rows.push({ 'Row': '', 'Indicator': `Combined Ratio: ${fmtPct(combinedRatio)}`, 'Amount (USD)': 0, 'Amount (UZS)': 0 });
    rows.push({ 'Row': '', 'Indicator': `Retention Ratio: ${fmtPct(retentionRatio)}`, 'Amount (USD)': 0, 'Amount (UZS)': 0 });
    exportToExcel(rows, `NAPP_Form1_Business_Summary_${quarter}_${year}`, 'Business Summary');
  };

  const handleExportForm2 = () => {
    const rows = [
      { 'Row': '1', 'Indicator': 'Total Assets', 'Amount (UZS)': toUZS(solvency.totalAssets) },
      { 'Row': '2', 'Indicator': 'Total Liabilities', 'Amount (UZS)': toUZS(solvency.totalLiabilities) },
      { 'Row': '3', 'Indicator': 'Net Assets', 'Amount (UZS)': toUZS(netAssets) },
      { 'Row': '4', 'Indicator': 'Minimum Capital Requirement', 'Amount (UZS)': toUZS(solvency.minCapitalRequirement) },
      { 'Row': '5', 'Indicator': 'Solvency Margin', 'Amount (UZS)': toUZS(solvencyMargin) },
      { 'Row': '6', 'Indicator': 'Solvency Ratio', 'Amount (UZS)': `${fmtPct(solvencyRatio)}` },
      { 'Row': '7', 'Indicator': 'Technical Reserves - Total', 'Amount (UZS)': toUZS(upr + claimsReserve + ibnrTotal) },
      { 'Row': '7.1', 'Indicator': 'UPR', 'Amount (UZS)': toUZS(upr) },
      { 'Row': '7.2', 'Indicator': 'Outstanding Claims Reserve', 'Amount (UZS)': toUZS(claimsReserve) },
      { 'Row': '7.3', 'Indicator': 'IBNR Reserve', 'Amount (UZS)': toUZS(ibnrTotal) },
    ];
    exportToExcel(rows, `NAPP_Form2_Solvency_${quarter}_${year}`, 'Solvency');
  };

  const handleExportForm3 = () => {
    const rows = reservesByClass.map(r => ({
      'Class of Business': r.class,
      'UPR (USD)': r.upr,
      'Outstanding Claims (USD)': r.outstandingClaims,
      'IBNR (USD)': r.ibnr,
      'Total Reserves (USD)': r.totalReserves,
    }));
    exportToExcel(rows, `NAPP_Form3_Reserves_${quarter}_${year}`, 'Reserves');
  };

  const handleExportForm4 = () => {
    const rows = [
      { 'Row': '1', 'Indicator': 'Reinsurance Premium Ceded - Total', 'Amount (USD)': ceded },
      { 'Row': '1.1', 'Indicator': 'Proportional Treaties', 'Amount (USD)': reinsurance.proportional },
      { 'Row': '1.2', 'Indicator': 'Non-Proportional (XL)', 'Amount (USD)': reinsurance.nonProportional },
      { 'Row': '1.3', 'Indicator': 'Facultative', 'Amount (USD)': reinsurance.facultative },
      { 'Row': '2', 'Indicator': 'Reinsurance Recoveries', 'Amount (USD)': reinsurance.recoveries },
      { 'Row': '3', 'Indicator': 'Net Reinsurance Position', 'Amount (USD)': netReinsPosition },
      { 'Row': '4', 'Indicator': 'Cession Ratio', 'Amount (USD)': `${fmtPct(cessionRatio)}` },
      { 'Row': '5', 'Indicator': 'Number of Reinsurance Contracts', 'Amount (USD)': reinsurance.contractCount },
    ];
    exportToExcel(rows, `NAPP_Form4_Reinsurance_${quarter}_${year}`, 'Reinsurance');
  };

  const handleExport = () => {
    if (activeTab === 'form1') handleExportForm1();
    else if (activeTab === 'form2') handleExportForm2();
    else if (activeTab === 'form3') handleExportForm3();
    else handleExportForm4();
  };

  const handlePrint = () => window.print();

  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-2">
        <button onClick={handleExport} disabled={!data}
          style={{ background: t.success, color: '#fff', boxShadow: t.shadow }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg disabled:opacity-50">
          <Download size={14} /> Export
        </button>
        <button onClick={handlePrint}
          style={{ background: t.bgCard, color: t.text2 }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg">
          <Printer size={14} /> Print
        </button>
        <button onClick={refetch} disabled={loading}
          style={{ color: t.text3 }}
          className="p-2 rounded-lg disabled:opacity-50" title="Refresh">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={loading ? { color: t.accent } : undefined} />
        </button>
      </div>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [data, loading, setHeaderActions, setHeaderLeft]);

  // ── Error state ──
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: t.danger }} />
          <h3 className="text-lg font-semibold" style={{ color: t.text1 }}>Failed to load data</h3>
          <p className="mt-1" style={{ color: t.text3 }}>{error}</p>
          <button onClick={refetch}
            style={{ background: t.accent, color: '#fff' }}
            className="mt-4 px-4 py-2 rounded-lg">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Shared inline style helpers
  const selectStyle: React.CSSProperties = {
    background: t.bgInput,
    border: `1px solid ${t.borderL}`,
    color: t.text1,
  };

  const inputStyle: React.CSSProperties = {
    background: t.bgInput,
    border: `1px solid ${t.borderL}`,
    color: t.text1,
  };

  const manualInputStyle: React.CSSProperties = {
    background: t.warningBg,
    border: `1px solid ${t.warning}`,
    color: t.text1,
  };

  const thStyle: React.CSSProperties = {
    background: t.bgCard,
    color: t.text2,
    borderColor: t.border,
  };

  const borderRStyle: React.CSSProperties = {
    borderColor: t.border,
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Filter Bar */}
      <div className="sticky top-0 z-30 mb-6 sticky-filter-blur" style={{ background: t.bgApp }}>
        <div className="rounded-xl p-3" style={{ background: t.bgPanel, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
          <div className="flex flex-wrap items-center gap-3">
            <select value={activeTab} onChange={(e) => setActiveTab(e.target.value as TabKey)}
              style={selectStyle}
              className="px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium">
              <option value="form1">Form 1: Business Summary</option>
              <option value="form2">Form 2: Solvency</option>
              <option value="form3">Form 3: Reserves</option>
              <option value="form4">Form 4: Reinsurance</option>
            </select>
            <div className="w-px h-5" style={{ background: t.borderL }} />
            <select value={quarter} onChange={(e) => setQuarter(e.target.value)}
              style={selectStyle}
              className="px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
              {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              style={selectStyle}
              className="px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="w-px h-5" style={{ background: t.borderL }} />
            <div className="flex items-center gap-1 text-sm">
              <span style={{ color: t.text3 }}>UZS/USD:</span>
              <input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value) || 12800)}
                style={inputStyle}
                className="w-20 rounded-lg px-2 py-2 text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin" size={32} style={{ color: t.accent }} />
        </div>
      ) : data ? (
        <div className="print:shadow-none">
          {/* ═══════════════════════════════════════════════════════ */}
          {/* FORM 1: Business Summary                                */}
          {/* ═══════════════════════════════════════════════════════ */}
          {activeTab === 'form1' && (
            <div style={{ background: t.bgPanel, border: `1px solid ${t.borderL}`, boxShadow: t.shadow }} className="print:border-black">
              {/* Form header */}
              <div className="px-8 py-5 text-center" style={{ borderBottom: `1px solid ${t.borderL}` }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: t.text4 }}>Форма 1 / Form 1</p>
                <h2 className="text-base font-bold uppercase tracking-wide" style={{ color: t.text1 }}>
                  ОТЧЕТ О СТРАХОВОЙ ДЕЯТЕЛЬНОСТИ
                </h2>
                <p className="text-sm mt-0.5" style={{ color: t.text2 }}>Insurance Activity Report</p>
                <p className="text-xs mt-2" style={{ color: t.text4 }}>
                  Period: {quarter} {year} &nbsp;|&nbsp; Company: Mosaic Insurance Group JIC &nbsp;|&nbsp; Currency: USD / UZS
                </p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: t.bgCard, borderBottom: `1px solid ${t.borderL}` }}>
                      <th className="text-left px-4 py-2.5 font-semibold w-12" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>Row</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>Indicator / Показатель</th>
                      <th className="text-right px-4 py-2.5 font-semibold w-40" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>Amount (USD)</th>
                      <th className="text-right px-4 py-2.5 font-semibold w-48" style={{ color: t.text2 }}>Amount (UZS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form1Rows.map((r, i) => (
                      <tr
                        key={r.row}
                        style={{
                          borderBottom: `1px solid ${t.border}`,
                          background: r.isGrandTotal ? t.bgHover : r.isTotal ? t.bgCard : undefined,
                          ...(r.isGrandTotal ? { borderTop: `2px solid ${t.text4}` } : {}),
                        }}
                      >
                        <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>{r.row}</td>
                        <td className={`px-4 py-2 ${r.indent ? 'pl-10' : ''} ${r.isTotal || r.isGrandTotal ? 'font-semibold' : ''}`}
                          style={{ color: r.isTotal || r.isGrandTotal ? t.text1 : t.text2, borderRight: `1px solid ${t.border}` }}>
                          {r.label}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono ${r.isGrandTotal ? 'font-bold text-base' : r.isTotal ? 'font-semibold' : ''}`}
                          style={{ color: r.usd < 0 ? t.danger : t.text1, borderRight: `1px solid ${t.border}` }}>
                          {fmt(r.usd)}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono ${r.isGrandTotal ? 'font-bold text-base' : r.isTotal ? 'font-semibold' : ''}`}
                          style={{ color: r.usd < 0 ? t.danger : t.text1 }}>
                          {fmt(toUZS(r.usd))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Key Ratios */}
              <div className="px-8 py-5" style={{ borderTop: `1px solid ${t.borderL}` }}>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: t.text4 }}>
                  Key Ratios / Ключевые коэффициенты
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
                  {[
                    ['Loss Ratio / Убыточность', lossRatio],
                    ['Commission Ratio / Коэффициент комиссии', commissionRatio],
                    ['Expense Ratio / Коэффициент расходов', expenseRatio],
                    ['Combined Ratio / Комбинированный коэффициент', combinedRatio],
                    ['Retention Ratio / Коэффициент удержания', retentionRatio],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${t.borderS}` }}>
                      <span className="text-sm" style={{ color: t.text2 }}>{label as string}</span>
                      <span className="font-mono text-sm font-medium" style={{
                        color: (label as string).includes('Combined') && (value as number) >= 100
                          ? t.danger
                          : (label as string).includes('Combined') && (value as number) < 100
                            ? t.success
                            : t.text1
                      }}>
                        {fmtPct(value as number)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* FORM 2: Solvency Report                                 */}
          {/* ═══════════════════════════════════════════════════════ */}
          {activeTab === 'form2' && (
            <div style={{ background: t.bgPanel, border: `1px solid ${t.borderL}`, boxShadow: t.shadow }}>
              <div className="px-8 py-5 text-center" style={{ borderBottom: `1px solid ${t.borderL}` }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: t.text4 }}>Форма 2 / Form 2</p>
                <h2 className="text-base font-bold uppercase tracking-wide" style={{ color: t.text1 }}>
                  ОТЧЕТ О ПЛАТЕЖЕСПОСОБНОСТИ
                </h2>
                <p className="text-sm mt-0.5" style={{ color: t.text2 }}>Solvency Report</p>
                <p className="text-xs mt-2" style={{ color: t.text4 }}>
                  Period: {quarter} {year} &nbsp;|&nbsp; Company: Mosaic Insurance Group JIC &nbsp;|&nbsp; Currency: USD
                </p>
                <div className="mt-3">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ background: getSolvencyBadge().bg, color: getSolvencyBadge().color }}>
                    {getSolvencyBadge().label} {solvencyRatio > 0 ? `(${fmtPct(solvencyRatio)})` : ''}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: t.bgCard, borderBottom: `1px solid ${t.borderL}` }}>
                      <th className="text-left px-4 py-2.5 font-semibold w-12" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>Row</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>Indicator / Показатель</th>
                      <th className="text-right px-4 py-2.5 font-semibold w-48" style={{ color: t.text2 }}>Amount (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1 - Total Assets (manual) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>1</td>
                      <td className="px-4 py-2" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Total Assets / Итого активы
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={solvency.totalAssets || ''}
                          onChange={(e) => setSolvency({ ...solvency, totalAssets: Number(e.target.value) || 0 })}
                          style={manualInputStyle}
                          className="w-40 text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 focus:ring-amber-400 outline-none"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    {/* Row 2 - Total Liabilities (manual) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>2</td>
                      <td className="px-4 py-2" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Total Liabilities / Итого обязательства
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={solvency.totalLiabilities || ''}
                          onChange={(e) => setSolvency({ ...solvency, totalLiabilities: Number(e.target.value) || 0 })}
                          style={manualInputStyle}
                          className="w-40 text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 focus:ring-amber-400 outline-none"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    {/* Row 3 - Net Assets (auto) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.bgCard }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>3</td>
                      <td className="px-4 py-2 font-semibold" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>
                        Net Assets (1-2) / Чистые активы
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: netAssets < 0 ? t.danger : t.text1 }}>
                        {fmt(netAssets)}
                      </td>
                    </tr>
                    {/* Row 4 - MCR (manual) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>4</td>
                      <td className="px-4 py-2" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Minimum Capital Requirement / Минимальный размер уставного капитала
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={solvency.minCapitalRequirement || ''}
                          onChange={(e) => setSolvency({ ...solvency, minCapitalRequirement: Number(e.target.value) || 0 })}
                          style={manualInputStyle}
                          className="w-40 text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 focus:ring-amber-400 outline-none"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    {/* Row 5 - Solvency Margin (auto) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.bgCard }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>5</td>
                      <td className="px-4 py-2 font-semibold" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>
                        Solvency Margin (3-4) / Маржа платежеспособности
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: solvencyMargin < 0 ? t.danger : t.text1 }}>
                        {fmt(solvencyMargin)}
                      </td>
                    </tr>
                    {/* Row 6 - Solvency Ratio (auto) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.bgHover, borderTop: `2px solid ${t.text4}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>6</td>
                      <td className="px-4 py-2 font-bold" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>
                        Solvency Ratio (3/4 × 100%) / Коэффициент платежеспособности
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-base" style={{
                        color: solvencyRatio >= 120 ? t.success :
                          solvencyRatio >= 100 ? t.warning : t.danger
                      }}>
                        {solvencyRatio > 0 ? fmtPct(solvencyRatio) : '—'}
                      </td>
                    </tr>

                    {/* Separator */}
                    <tr style={{ borderBottom: `1px solid ${t.borderL}` }}>
                      <td colSpan={3} className="px-4 py-3 text-xs font-semibold uppercase tracking-widest" style={{ background: t.bgCard, color: t.text4 }}>
                        Technical Reserves / Страховые резервы
                      </td>
                    </tr>

                    {/* Row 7 - Total Tech Reserves */}
                    <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.bgCard }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>7</td>
                      <td className="px-4 py-2 font-semibold" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>
                        Technical Reserves - Total / Страховые резервы — Итого
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: t.text1 }}>
                        {fmt(upr + claimsReserve + ibnrTotal)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>7.1</td>
                      <td className="px-4 py-2 pl-10" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Unearned Premium Reserve (UPR) / Резерв незаработанной премии
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: t.text1 }}>
                        {fmt(upr)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>7.2</td>
                      <td className="px-4 py-2 pl-10" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Outstanding Claims Reserve / Резерв заявленных убытков
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: t.text1 }}>
                        {fmt(claimsReserve)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>7.3</td>
                      <td className="px-4 py-2 pl-10" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        IBNR Reserve / Резерв РПНУ (IBNR)
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: t.text1 }}>
                        {fmt(ibnrTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Save button */}
              <div className="px-8 py-4 flex justify-end" style={{ borderTop: `1px solid ${t.borderL}` }}>
                <button
                  onClick={saveSolvency}
                  disabled={solvencySaving}
                  style={{ background: t.accent, color: '#fff' }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                  {solvencySaving ? 'Saving...' : 'Save Solvency Data'}
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* FORM 3: Reserves Report                                 */}
          {/* ═══════════════════════════════════════════════════════ */}
          {activeTab === 'form3' && (
            <div style={{ background: t.bgPanel, border: `1px solid ${t.borderL}`, boxShadow: t.shadow }}>
              <div className="px-8 py-5 text-center" style={{ borderBottom: `1px solid ${t.borderL}` }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: t.text4 }}>Форма 3 / Form 3</p>
                <h2 className="text-base font-bold uppercase tracking-wide" style={{ color: t.text1 }}>
                  ОТЧЕТ О СТРАХОВЫХ РЕЗЕРВАХ
                </h2>
                <p className="text-sm mt-0.5" style={{ color: t.text2 }}>Insurance Reserves Report</p>
                <p className="text-xs mt-2" style={{ color: t.text4 }}>
                  Period: {quarter} {year} &nbsp;|&nbsp; Company: Mosaic Insurance Group JIC &nbsp;|&nbsp; Currency: USD
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: t.bgCard, borderBottom: `1px solid ${t.borderL}` }}>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>Class of Business / Вид страхования</th>
                      <th className="text-right px-4 py-2.5 font-semibold w-36" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>UPR (USD)</th>
                      <th className="text-right px-4 py-2.5 font-semibold w-44" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>Outstanding Claims</th>
                      <th className="text-right px-4 py-2.5 font-semibold w-36" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>IBNR (USD)</th>
                      <th className="text-right px-4 py-2.5 font-semibold w-44" style={{ color: t.text2 }}>Total Reserves</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservesByClass.length > 0 ? reservesByClass.map((r, i) => (
                      <tr key={r.class} style={{ borderBottom: `1px solid ${t.border}`, background: i % 2 !== 0 ? t.bgRowAlt : undefined }}>
                        <td className="px-4 py-2" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>{r.class}</td>
                        <td className="px-4 py-2 text-right font-mono" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>{fmt(r.upr)}</td>
                        <td className="px-4 py-2 text-right font-mono" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>{fmt(r.outstandingClaims)}</td>
                        <td className="px-4 py-2 text-right font-mono" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>{fmt(r.ibnr)}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: t.text1 }}>{fmt(r.totalReserves)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center italic" style={{ color: t.text4 }}>
                          No class data available. Configure IBNR estimates and ensure claims data is loaded.
                        </td>
                      </tr>
                    )}
                    {/* Total row */}
                    {reservesByClass.length > 0 && (
                      <tr className="font-semibold" style={{ background: t.bgHover, borderTop: `2px solid ${t.text4}` }}>
                        <td className="px-4 py-2.5" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>TOTAL / ИТОГО</td>
                        <td className="px-4 py-2.5 text-right font-mono" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>
                          {fmt(reservesByClass.reduce((s, r) => s + r.upr, 0))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>
                          {fmt(reservesByClass.reduce((s, r) => s + r.outstandingClaims, 0))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>
                          {fmt(reservesByClass.reduce((s, r) => s + r.ibnr, 0))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold" style={{ color: t.text1 }}>
                          {fmt(reservesByClass.reduce((s, r) => s + r.totalReserves, 0))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Additional totals summary */}
              <div className="px-8 py-5" style={{ borderTop: `1px solid ${t.borderL}` }}>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: t.text4 }}>
                  Aggregate Reserves Summary / Сводка резервов
                </h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  {[
                    ['Unearned Premium Reserve (UPR)', upr],
                    ['Outstanding Claims Reserve', claimsReserve],
                    ['IBNR Reserve', ibnrTotal],
                    ['Total Technical Reserves', upr + claimsReserve + ibnrTotal],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${t.borderS}` }}>
                      <span className="text-sm" style={{ color: t.text2 }}>{label as string}</span>
                      <span className="font-mono text-sm font-medium" style={{ color: t.text1 }}>${fmt(value as number)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* FORM 4: Reinsurance Report                              */}
          {/* ═══════════════════════════════════════════════════════ */}
          {activeTab === 'form4' && (
            <div style={{ background: t.bgPanel, border: `1px solid ${t.borderL}`, boxShadow: t.shadow }}>
              <div className="px-8 py-5 text-center" style={{ borderBottom: `1px solid ${t.borderL}` }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: t.text4 }}>Форма 4 / Form 4</p>
                <h2 className="text-base font-bold uppercase tracking-wide" style={{ color: t.text1 }}>
                  ОТЧЕТ О ПЕРЕСТРАХОВАНИИ
                </h2>
                <p className="text-sm mt-0.5" style={{ color: t.text2 }}>Reinsurance Report</p>
                <p className="text-xs mt-2" style={{ color: t.text4 }}>
                  Period: {quarter} {year} &nbsp;|&nbsp; Company: Mosaic Insurance Group JIC &nbsp;|&nbsp; Currency: USD
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: t.bgCard, borderBottom: `1px solid ${t.borderL}` }}>
                      <th className="text-left px-4 py-2.5 font-semibold w-12" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>Row</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>Indicator / Показатель</th>
                      <th className="text-right px-4 py-2.5 font-semibold w-48" style={{ color: t.text2 }}>Amount (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1 - Ceded Total (from analytics) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.bgCard }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>1</td>
                      <td className="px-4 py-2 font-semibold" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>
                        Reinsurance Premium Ceded - Total / Перестраховочная премия — Итого
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: t.text1 }}>
                        {fmt(ceded)}
                      </td>
                    </tr>
                    {/* Row 1.1 - Proportional (manual) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>1.1</td>
                      <td className="px-4 py-2 pl-10" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Proportional Treaties / Пропорциональное перестрахование
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={reinsurance.proportional || ''}
                          onChange={(e) => setReinsurance({ ...reinsurance, proportional: Number(e.target.value) || 0 })}
                          style={manualInputStyle}
                          className="w-40 text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 focus:ring-amber-400 outline-none"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    {/* Row 1.2 - Non-Proportional (manual) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>1.2</td>
                      <td className="px-4 py-2 pl-10" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Non-Proportional (XL) / Непропорциональное перестрахование
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={reinsurance.nonProportional || ''}
                          onChange={(e) => setReinsurance({ ...reinsurance, nonProportional: Number(e.target.value) || 0 })}
                          style={manualInputStyle}
                          className="w-40 text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 focus:ring-amber-400 outline-none"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    {/* Row 1.3 - Facultative (manual) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>1.3</td>
                      <td className="px-4 py-2 pl-10" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Facultative / Факультативное перестрахование
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={reinsurance.facultative || ''}
                          onChange={(e) => setReinsurance({ ...reinsurance, facultative: Number(e.target.value) || 0 })}
                          style={manualInputStyle}
                          className="w-40 text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 focus:ring-amber-400 outline-none"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    {/* Row 2 - Recoveries (manual) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>2</td>
                      <td className="px-4 py-2" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Reinsurance Recoveries / Возмещение по перестрахованию
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={reinsurance.recoveries || ''}
                          onChange={(e) => setReinsurance({ ...reinsurance, recoveries: Number(e.target.value) || 0 })}
                          style={manualInputStyle}
                          className="w-40 text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 focus:ring-amber-400 outline-none"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    {/* Row 3 - Net position (auto) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.bgCard }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>3</td>
                      <td className="px-4 py-2 font-semibold" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>
                        Net Reinsurance Position (1-2) / Чистая перестраховочная позиция
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: t.text1 }}>
                        {fmt(netReinsPosition)}
                      </td>
                    </tr>
                    {/* Row 4 - Cession Ratio (auto) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.bgHover, borderTop: `2px solid ${t.text4}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>4</td>
                      <td className="px-4 py-2 font-bold" style={{ color: t.text1, borderRight: `1px solid ${t.border}` }}>
                        Cession Ratio (1 / GWP × 100%) / Коэффициент цессии
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold" style={{ color: t.text1 }}>
                        {fmtPct(cessionRatio)}
                      </td>
                    </tr>
                    {/* Row 5 - Contract count (manual) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>5</td>
                      <td className="px-4 py-2" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Number of Reinsurance Contracts / Количество договоров перестрахования
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={reinsurance.contractCount || ''}
                          onChange={(e) => setReinsurance({ ...reinsurance, contractCount: Number(e.target.value) || 0 })}
                          style={manualInputStyle}
                          className="w-40 text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 focus:ring-amber-400 outline-none"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    {/* Row 6 - Top Reinsurers (manual text) */}
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: t.text3, borderRight: `1px solid ${t.border}` }}>6</td>
                      <td className="px-4 py-2" style={{ color: t.text2, borderRight: `1px solid ${t.border}` }}>
                        Top 5 Reinsurers / Топ-5 перестраховщиков
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="text"
                          value={reinsurance.topReinsurers}
                          onChange={(e) => setReinsurance({ ...reinsurance, topReinsurers: e.target.value })}
                          style={manualInputStyle}
                          className="w-full text-right text-sm rounded px-2 py-1 focus:ring-2 focus:ring-amber-400 outline-none"
                          placeholder="e.g. Swiss Re, Munich Re, ..."
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Outward channel summary from analytics */}
              {outward && outward.topCedants.length > 0 && (
                <div className="px-8 py-5" style={{ borderTop: `1px solid ${t.borderL}` }}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: t.text4 }}>
                    Top Reinsurers (from data) / Перестраховщики (из данных)
                  </h3>
                  <div className="space-y-1">
                    {outward.topCedants.slice(0, 5).map((r, i) => (
                      <div key={r.name} className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${t.borderS}` }}>
                        <span className="text-sm" style={{ color: t.text2 }}>{i + 1}. {r.name}</span>
                        <span className="font-mono text-sm" style={{ color: t.text1 }}>${fmt(r.premium)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save button */}
              <div className="px-8 py-4 flex justify-end" style={{ borderTop: `1px solid ${t.borderL}` }}>
                <button
                  onClick={saveReinsurance}
                  style={{ background: t.accent, color: '#fff' }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg"
                >
                  Save Reinsurance Data
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default RegulatoryReporting;
