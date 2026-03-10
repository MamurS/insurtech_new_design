import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, Download, AlertCircle, Save, Calculator } from 'lucide-react';
import { useAnalyticsSummary, LossRatioData } from '../hooks/useAnalytics';
import { DB } from '../services/db';
import { useToast } from '../context/ToastContext';
import { exportToExcel } from '../services/excelExport';
import { usePageHeader } from '../context/PageHeaderContext';
import { useTheme } from '../theme/useTheme';

// ─── Types ──────────────────────────────────────────────────────

type TabKey = 'manual' | 'bf';

interface ManualRow {
  class: string;
  earnedPremium: number;
  reportedClaims: number;
  reportedLossRatio: number;
  ibnrEstimate: number;
  totalIncurred: number;
  ultimateLossRatio: number;
}

interface BFRow {
  class: string;
  earnedPremium: number;
  elr: number;
  expectedUltimateLoss: number;
  devFactor: number;
  reportedClaims: number;
  bfIbnr: number;
  ultimateIncurred: number;
}

// ─── Helpers ────────────────────────────────────────────────────

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

// ─── Main Component ─────────────────────────────────────────────

const IBNREstimation: React.FC = () => {
  const { data, loading, error, refetch } = useAnalyticsSummary();
  const toast = useToast();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const location = useLocation();
  const { t } = useTheme();

  const activeTab: TabKey = location.pathname.includes('/bf-method') ? 'bf' : 'manual';
  const [ibnrValues, setIbnrValues] = useState<Record<string, number>>({});
  const [bfParams, setBfParams] = useState<Record<string, { elr: number; devFactor: number }>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Load saved estimates from DB
  useEffect(() => {
    const loadSaved = async () => {
      const [ibnrRaw, bfRaw, savedDate] = await Promise.all([
        DB.getSetting('ibnr_estimates'),
        DB.getSetting('ibnr_bf_params'),
        DB.getSetting('ibnr_last_saved'),
      ]);
      if (ibnrRaw) {
        try { setIbnrValues(JSON.parse(ibnrRaw)); } catch { /* ignore */ }
      }
      if (bfRaw) {
        try { setBfParams(JSON.parse(bfRaw)); } catch { /* ignore */ }
      }
      if (savedDate) setLastSaved(savedDate);
    };
    loadSaved();
  }, []);

  // ── Build row data from analytics ────────────────────────────

  const classData: LossRatioData[] = data?.lossRatioByClass || [];

  const buildManualRows = useCallback((): ManualRow[] => {
    return classData.map(c => {
      const ibnr = ibnrValues[c.class] || 0;
      const totalInc = c.incurredLosses + ibnr;
      return {
        class: c.class,
        earnedPremium: c.earnedPremium,
        reportedClaims: c.incurredLosses,
        reportedLossRatio: c.lossRatio,
        ibnrEstimate: ibnr,
        totalIncurred: totalInc,
        ultimateLossRatio: c.earnedPremium > 0 ? (totalInc / c.earnedPremium) * 100 : 0,
      };
    });
  }, [classData, ibnrValues]);

  const buildBFRows = useCallback((): BFRow[] => {
    return classData.map(c => {
      const params = bfParams[c.class] || { elr: 65, devFactor: 0.80 };
      const expectedUlt = c.earnedPremium * (params.elr / 100);
      const bfIbnr = c.earnedPremium * (params.elr / 100) * (1 - params.devFactor);
      return {
        class: c.class,
        earnedPremium: c.earnedPremium,
        elr: params.elr,
        expectedUltimateLoss: expectedUlt,
        devFactor: params.devFactor,
        reportedClaims: c.incurredLosses,
        bfIbnr: bfIbnr,
        ultimateIncurred: c.incurredLosses + bfIbnr,
      };
    });
  }, [classData, bfParams]);

  const manualRows = buildManualRows();
  const bfRows = buildBFRows();

  // Totals
  const totalIbnrManual = manualRows.reduce((s, r) => s + r.ibnrEstimate, 0);
  const totalIbnrBF = bfRows.reduce((s, r) => s + r.bfIbnr, 0);
  const totalIbnr = activeTab === 'manual' ? totalIbnrManual : totalIbnrBF;
  const totalReported = data?.claims.totalIncurred || 0;
  const totalGPE = data?.total.grossPremiumEarned || 0;
  const totalIncAll = totalReported + totalIbnr;
  const ultimateLossRatio = totalGPE > 0 ? (totalIncAll / totalGPE) * 100 : 0;

  // ── Save handlers ────────────────────────────────────────────

  const handleSaveManual = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await Promise.all([
        DB.setSetting('ibnr_estimates', JSON.stringify(ibnrValues)),
        DB.setSetting('ibnr_last_saved', now),
      ]);
      setLastSaved(now);
      toast.success('IBNR estimates saved');
    } catch {
      toast.error('Failed to save IBNR estimates');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBF = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await Promise.all([
        DB.setSetting('ibnr_bf_params', JSON.stringify(bfParams)),
        DB.setSetting('ibnr_last_saved', now),
      ]);
      setLastSaved(now);
      toast.success('BF parameters saved');
    } catch {
      toast.error('Failed to save BF parameters');
    } finally {
      setSaving(false);
    }
  };

  // ── Export ────────────────────────────────────────────────────

  const handleExport = () => {
    if (activeTab === 'manual') {
      const rows = manualRows.map(r => ({
        'Class': r.class,
        'Earned Premium': r.earnedPremium,
        'Reported Claims': r.reportedClaims,
        'Reported Loss Ratio %': r.reportedLossRatio,
        'IBNR Estimate': r.ibnrEstimate,
        'Total Incurred': r.totalIncurred,
        'Ultimate Loss Ratio %': Number(r.ultimateLossRatio.toFixed(1)),
      }));
      rows.push({
        'Class': 'TOTAL',
        'Earned Premium': manualRows.reduce((s, r) => s + r.earnedPremium, 0),
        'Reported Claims': manualRows.reduce((s, r) => s + r.reportedClaims, 0),
        'Reported Loss Ratio %': 0,
        'IBNR Estimate': totalIbnrManual,
        'Total Incurred': manualRows.reduce((s, r) => s + r.totalIncurred, 0),
        'Ultimate Loss Ratio %': Number(ultimateLossRatio.toFixed(1)),
      });
      exportToExcel(rows, `IBNR_Manual_${new Date().toISOString().split('T')[0]}`, 'IBNR Manual');
    } else {
      const rows = bfRows.map(r => ({
        'Class': r.class,
        'Earned Premium': r.earnedPremium,
        'ELR %': r.elr,
        'Expected Ultimate': r.expectedUltimateLoss,
        'Dev Factor': r.devFactor,
        'Reported Claims': r.reportedClaims,
        'BF IBNR': r.bfIbnr,
        'Ultimate Incurred': r.ultimateIncurred,
      }));
      rows.push({
        'Class': 'TOTAL',
        'Earned Premium': bfRows.reduce((s, r) => s + r.earnedPremium, 0),
        'ELR %': 0,
        'Expected Ultimate': bfRows.reduce((s, r) => s + r.expectedUltimateLoss, 0),
        'Dev Factor': 0,
        'Reported Claims': bfRows.reduce((s, r) => s + r.reportedClaims, 0),
        'BF IBNR': totalIbnrBF,
        'Ultimate Incurred': bfRows.reduce((s, r) => s + r.ultimateIncurred, 0),
      });
      exportToExcel(rows, `IBNR_BF_${new Date().toISOString().split('T')[0]}`, 'IBNR BF Method');
    }
  };

  // Stats badges in header left, Export button in header right
  useEffect(() => {
    const fmtCompact = (v: number): string => {
      if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
      if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
      if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
      return '$' + v.toFixed(0);
    };
    const lrBg = ultimateLossRatio > 80 ? t.dangerBg : ultimateLossRatio > 60 ? t.warningBg : t.successBg;
    const lrBorder = ultimateLossRatio > 80 ? t.danger : ultimateLossRatio > 60 ? t.warning : t.success;
    const lrColor = ultimateLossRatio > 80 ? t.danger : ultimateLossRatio > 60 ? t.warning : t.success;
    setHeaderLeft(
      <>
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: t.warningBg, border: `1px solid ${t.warning}40` }}>
          <span className="text-xs font-medium" style={{ color: t.warning }}>IBNR</span>
          <span className="text-sm font-bold" style={{ color: t.warning }}>{loading ? '…' : fmtCompact(totalIbnr)}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
          <span className="text-xs font-medium" style={{ color: t.text3 }}>Reported</span>
          <span className="text-sm font-bold" style={{ color: t.text1 }}>{loading ? '…' : fmtCompact(totalReported)}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: t.dangerBg, border: `1px solid ${t.danger}` }}>
          <span className="text-xs font-medium" style={{ color: t.danger }}>Incurred</span>
          <span className="text-sm font-bold" style={{ color: t.danger }}>{loading ? '…' : fmtCompact(totalIncAll)}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: lrBg, border: `1px solid ${lrBorder}` }}>
          <span className="text-xs font-medium" style={{ color: lrColor }}>Ult. LR</span>
          <span className="text-sm font-bold" style={{ color: lrColor }}>{loading ? '…' : formatPercent(ultimateLossRatio)}</span>
        </div>
      </>
    );
    setHeaderActions(
      <button
        onClick={() => handleExport()}
        disabled={!data}
        className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: t.success, boxShadow: t.shadow }}
      >
        <Download size={16} /> Export
      </button>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [data, loading, totalIbnr, totalReported, totalIncAll, ultimateLossRatio, setHeaderActions, setHeaderLeft, t]);

  // ── Error state ──────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Loading */}
      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin" size={32} style={{ color: t.accent }} />
        </div>
      ) : data && classData.length > 0 ? (
        <>
          {/* Manual Entry Tab */}
          {activeTab === 'manual' && (
            <div className="rounded-xl overflow-hidden" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.borderS}` }}>
                <h3 className="font-semibold" style={{ color: t.text1 }}>Manual IBNR Entry by Class</h3>
                <p className="text-xs mt-0.5" style={{ color: t.text3 }}>
                  Review reported claims and enter your professional judgment IBNR estimate per class
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10" style={{ background: t.bgCard }}>
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <th className="text-left py-3 px-4 font-semibold" style={{ color: t.text2 }}>Class of Business</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ color: t.text2 }}>Earned Premium</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ color: t.text2 }}>Reported Claims</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ color: t.text2 }}>Reported LR</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ background: t.warningBg, color: t.text2 }}>IBNR Estimate</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ color: t.text2 }}>Total Incurred</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ color: t.text2 }}>Ultimate LR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualRows.map((row) => (
                      <tr key={row.class} style={{ borderBottom: `1px solid ${t.borderS}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.bgHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                      >
                        <td className="py-2.5 px-4 font-medium" style={{ color: t.text1 }}>{row.class}</td>
                        <td className="py-2.5 px-4 text-right font-mono" style={{ color: t.text2 }}>{formatCurrency(row.earnedPremium)}</td>
                        <td className="py-2.5 px-4 text-right font-mono" style={{ color: t.text2 }}>{formatCurrency(row.reportedClaims)}</td>
                        <td className="py-2.5 px-4 text-right font-mono" style={{ color: t.text2 }}>{formatPercent(row.reportedLossRatio)}</td>
                        <td className="py-2 px-3" style={{ background: t.warningBg }}>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={ibnrValues[row.class] || ''}
                            onChange={(e) => setIbnrValues(prev => ({
                              ...prev,
                              [row.class]: Number(e.target.value) || 0,
                            }))}
                            placeholder="0"
                            className="w-full text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 outline-none"
                            style={{ background: t.bgInput, border: `1px solid ${t.warning}40`, color: t.text1 }}
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium" style={{ color: t.text1 }}>{formatCurrency(row.totalIncurred)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium" style={{
                          color: row.ultimateLossRatio > 80 ? t.danger : row.ultimateLossRatio > 60 ? t.warning : t.text2
                        }}>
                          {formatPercent(row.ultimateLossRatio)}
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="font-semibold" style={{ borderTop: `2px solid ${t.borderL}`, background: t.bgCard }}>
                      <td className="py-3 px-4" style={{ color: t.text1 }}>TOTAL</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.text1 }}>{formatCurrency(manualRows.reduce((s, r) => s + r.earnedPremium, 0))}</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.text1 }}>{formatCurrency(manualRows.reduce((s, r) => s + r.reportedClaims, 0))}</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.text2 }}>-</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.warning, background: t.warningBg }}>{formatCurrency(totalIbnrManual)}</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.text1 }}>{formatCurrency(manualRows.reduce((s, r) => s + r.totalIncurred, 0))}</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: ultimateLossRatio > 80 ? t.danger : t.text1 }}>
                        {formatPercent(ultimateLossRatio)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-4 flex items-center gap-4" style={{ borderTop: `1px solid ${t.borderS}` }}>
                <button
                  onClick={handleSaveManual}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 text-sm font-medium"
                  style={{ background: t.accent }}
                >
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Estimates
                </button>
                {lastSaved && (
                  <span className="text-xs" style={{ color: t.text4 }}>
                    Last saved: {new Date(lastSaved).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* BF Method Tab */}
          {activeTab === 'bf' && (
            <div className="rounded-xl overflow-hidden" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.borderS}` }}>
                <div className="flex items-center gap-2">
                  <Calculator size={18} style={{ color: t.accent }} />
                  <h3 className="font-semibold" style={{ color: t.text1 }}>Bornhuetter-Ferguson Method</h3>
                </div>
                <p className="text-xs mt-1" style={{ color: t.text3 }}>
                  IBNR = Earned Premium &times; ELR &times; (1 - Development Factor).
                  Adjust ELR and Development Factor per class.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10" style={{ background: t.bgCard }}>
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <th className="text-left py-3 px-4 font-semibold" style={{ color: t.text2 }}>Class</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ color: t.text2 }}>Earned Premium</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ background: t.warningBg, color: t.text2 }}>ELR %</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ color: t.text2 }}>Expected Ult. Loss</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ background: t.warningBg, color: t.text2 }}>Dev Factor</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ color: t.text2 }}>Reported Claims</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ color: t.text2 }}>BF IBNR</th>
                      <th className="text-right py-3 px-4 font-semibold" style={{ color: t.text2 }}>Ultimate Incurred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bfRows.map((row) => (
                      <tr key={row.class} style={{ borderBottom: `1px solid ${t.borderS}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.bgHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                      >
                        <td className="py-2.5 px-4 font-medium" style={{ color: t.text1 }}>{row.class}</td>
                        <td className="py-2.5 px-4 text-right font-mono" style={{ color: t.text2 }}>{formatCurrency(row.earnedPremium)}</td>
                        <td className="py-2 px-3" style={{ background: t.warningBg }}>
                          <input
                            type="number"
                            min="0"
                            max="200"
                            step="1"
                            value={bfParams[row.class]?.elr ?? 65}
                            onChange={(e) => setBfParams(prev => ({
                              ...prev,
                              [row.class]: {
                                elr: Number(e.target.value) || 0,
                                devFactor: prev[row.class]?.devFactor ?? 0.80,
                              },
                            }))}
                            className="w-20 text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 outline-none"
                            style={{ background: t.bgInput, border: `1px solid ${t.warning}40`, color: t.text1 }}
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono" style={{ color: t.text2 }}>{formatCurrency(row.expectedUltimateLoss)}</td>
                        <td className="py-2 px-3" style={{ background: t.warningBg }}>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.05"
                            value={bfParams[row.class]?.devFactor ?? 0.80}
                            onChange={(e) => setBfParams(prev => ({
                              ...prev,
                              [row.class]: {
                                elr: prev[row.class]?.elr ?? 65,
                                devFactor: Number(e.target.value) || 0,
                              },
                            }))}
                            className="w-20 text-right font-mono text-sm rounded px-2 py-1 focus:ring-2 outline-none"
                            style={{ background: t.bgInput, border: `1px solid ${t.warning}40`, color: t.text1 }}
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono" style={{ color: t.text2 }}>{formatCurrency(row.reportedClaims)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium" style={{ color: t.warning }}>{formatCurrency(row.bfIbnr)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium" style={{ color: t.text1 }}>{formatCurrency(row.ultimateIncurred)}</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="font-semibold" style={{ borderTop: `2px solid ${t.borderL}`, background: t.bgCard }}>
                      <td className="py-3 px-4" style={{ color: t.text1 }}>TOTAL</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.text1 }}>{formatCurrency(bfRows.reduce((s, r) => s + r.earnedPremium, 0))}</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.text2, background: t.warningBg }}>-</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.text1 }}>{formatCurrency(bfRows.reduce((s, r) => s + r.expectedUltimateLoss, 0))}</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.text2, background: t.warningBg }}>-</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.text1 }}>{formatCurrency(bfRows.reduce((s, r) => s + r.reportedClaims, 0))}</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.warning }}>{formatCurrency(totalIbnrBF)}</td>
                      <td className="py-3 px-4 text-right font-mono" style={{ color: t.text1 }}>{formatCurrency(bfRows.reduce((s, r) => s + r.ultimateIncurred, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-4 flex items-center gap-4" style={{ borderTop: `1px solid ${t.borderS}` }}>
                <button
                  onClick={handleSaveBF}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 text-sm font-medium"
                  style={{ background: t.accent }}
                >
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Parameters
                </button>
                {lastSaved && (
                  <span className="text-xs" style={{ color: t.text4 }}>
                    Last saved: {new Date(lastSaved).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      ) : data && classData.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: t.bgPanel, border: `1px solid ${t.border}` }}>
          <Calculator className="w-12 h-12 mx-auto mb-4" style={{ color: t.text4 }} />
          <h3 className="text-lg font-semibold" style={{ color: t.text2 }}>No class data available</h3>
          <p className="text-sm mt-1" style={{ color: t.text3 }}>IBNR estimation requires policy and claims data grouped by class of business.</p>
        </div>
      ) : null}
    </div>
  );
};

export default IBNREstimation;
