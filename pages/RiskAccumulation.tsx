import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer
} from 'recharts';
import {
  Shield, RefreshCw, Download, AlertTriangle, AlertCircle
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { exportToExcel } from '../services/excelExport';
import { usePageHeader } from '../context/PageHeaderContext';

// ─── Types ──────────────────────────────────────────────────────

interface PortfolioRow {
  id: string;
  reference_number: string;
  insured_name: string | null;
  cedant_name: string | null;
  class_of_business: string | null;
  territory: string | null;
  currency: string | null;
  limit: number | null;
  sum_insured_national: number | null;
  gross_premium: number | null;
  net_premium: number | null;
  our_share: number | null;
  status: string | null;
  source: string;
}

interface AggRow {
  name: string;
  count: number;
  totalLimit: number;
  totalGwp: number;
  pctOfPortfolio: number;
}

type TabKey = 'territory' | 'class' | 'cedant' | 'top-risks';

// ─── Helpers ────────────────────────────────────────────────────

const toUSD = (amount: number | null, currency: string | null): number => {
  if (!amount || amount === 0) return 0;
  const cur = currency || 'USD';
  if (cur === 'UZS') return amount / 12800;
  if (cur.startsWith('EUR')) return amount * 1.08;
  if (cur === 'RUB') return amount / 90;
  if (cur === 'KZT') return amount / 470;
  if (cur === 'TWD') return amount / 32;
  if (cur === 'PGK') return amount / 3.8;
  return amount; // USD and others
};

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

// ─── Main Component ─────────────────────────────────────────────

const RiskAccumulation: React.FC = () => {
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('territory');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error: err } = await supabase
        .from('v_portfolio')
        .select('id, reference_number, insured_name, cedant_name, class_of_business, territory, currency, sum_insured_national, gross_premium, net_premium, our_share, status, source')
        .in('status', ['ACTIVE', 'Active', 'PENDING', 'Pending']);
      if (err) throw err;
      setRows((data as PortfolioRow[]) || []);
    } catch (err: any) {
      console.error('Risk accumulation fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Aggregation ───────────────────────────────────────────────

  const totalExposure = rows.reduce((s, r) => s + toUSD(r.sum_insured_national, r.currency), 0);
  const largestSingleRisk = rows.reduce((m, r) => Math.max(m, toUSD(r.sum_insured_national, r.currency)), 0);
  const distinctTerritories = new Set(rows.map(r => r.territory || 'Unknown')).size;
  const distinctClasses = new Set(rows.map(r => r.class_of_business || 'Unknown')).size;

  const aggregate = (keyFn: (r: PortfolioRow) => string): AggRow[] => {
    const map: Record<string, { count: number; totalLimit: number; totalGwp: number }> = {};
    rows.forEach(r => {
      const key = keyFn(r) || 'Unknown';
      if (!map[key]) map[key] = { count: 0, totalLimit: 0, totalGwp: 0 };
      map[key].count++;
      map[key].totalLimit += toUSD(r.sum_insured_national, r.currency);
      map[key].totalGwp += toUSD(r.gross_premium, r.currency);
    });
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        count: v.count,
        totalLimit: v.totalLimit,
        totalGwp: v.totalGwp,
        pctOfPortfolio: totalExposure > 0 ? (v.totalLimit / totalExposure) * 100 : 0,
      }))
      .sort((a, b) => b.totalLimit - a.totalLimit);
  };

  const byTerritory = aggregate(r => r.territory || 'Unknown');
  const byClass = aggregate(r => {
    const c = r.class_of_business || 'Unknown';
    return c.replace(/^\d+\s*-\s*/, '');
  });
  const byCedant = aggregate(r => r.cedant_name || r.insured_name || 'Unknown');

  const topRisks = [...rows]
    .sort((a, b) => toUSD(b.sum_insured_national, b.currency) - toUSD(a.sum_insured_national, a.currency))
    .slice(0, 25);

  // ── Export ────────────────────────────────────────────────────

  const handleExport = () => {
    let exportRows: any[];
    if (activeTab === 'top-risks') {
      exportRows = topRisks.map((r, i) => ({
        'Rank': i + 1,
        'Ref #': r.reference_number,
        'Insured/Cedant': r.cedant_name || r.insured_name || '',
        'Class': r.class_of_business || '',
        'Territory': r.territory || '',
        'Limit (USD)': toUSD(r.sum_insured_national, r.currency),
        'GWP (USD)': toUSD(r.gross_premium, r.currency),
        'Our Share %': r.our_share || 0,
      }));
    } else {
      const dataMap = { territory: byTerritory, class: byClass, cedant: byCedant };
      const data = dataMap[activeTab as keyof typeof dataMap];
      exportRows = data.map(r => ({
        [activeTab === 'territory' ? 'Territory' : activeTab === 'class' ? 'Class' : 'Cedant']: r.name,
        'Policy Count': r.count,
        'Total Limit (USD)': r.totalLimit,
        'Total GWP (USD)': r.totalGwp,
        '% of Portfolio': r.pctOfPortfolio,
      }));
    }
    exportToExcel(exportRows, `Risk_Accumulation_${activeTab}_${new Date().toISOString().split('T')[0]}`, 'Risk Accumulation');
  };

  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-2">
        <button onClick={handleExport} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 shadow-sm disabled:opacity-50">
          <Download size={14} /> Export
        </button>
        <button onClick={fetchData} disabled={loading}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-50" title="Refresh">
          <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
        </button>
      </div>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [loading, setHeaderActions, setHeaderLeft]);

  // ── Tab Config ────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'territory', label: 'By Territory' },
    { key: 'class', label: 'By Class' },
    { key: 'cedant', label: 'By Cedant' },
    { key: 'top-risks', label: 'Top Risks' },
  ];

  const THRESHOLDS: Record<string, number> = {
    territory: 25,
    class: 30,
    cedant: 15,
  };

  // ── Render helpers ────────────────────────────────────────────

  const renderAggTable = (data: AggRow[], labelHeader: string, threshold: number) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 font-semibold text-slate-600">{labelHeader}</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600">Count</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600">Total Limit (USD)</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600">Total GWP (USD)</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600">% of Portfolio</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const overThreshold = row.pctOfPortfolio >= threshold;
            return (
              <tr key={row.name} className={`border-b border-slate-100 hover:bg-slate-50 ${overThreshold ? 'bg-red-50' : ''}`}>
                <td className="py-2.5 px-4 text-slate-800">
                  <span className="flex items-center gap-2">
                    {row.name}
                    {overThreshold && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                        <AlertTriangle size={12} />
                        {formatPercent(row.pctOfPortfolio)}
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right text-slate-700 font-mono">{row.count}</td>
                <td className="py-2.5 px-4 text-right text-slate-700 font-mono">{formatCurrency(row.totalLimit)}</td>
                <td className="py-2.5 px-4 text-right text-slate-700 font-mono">{formatCurrency(row.totalGwp)}</td>
                <td className={`py-2.5 px-4 text-right font-mono font-medium ${overThreshold ? 'text-red-600' : 'text-slate-700'}`}>
                  {formatPercent(row.pctOfPortfolio)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderChart = (data: AggRow[]) => {
    const chartData = data.slice(0, 10).map((r, i) => ({
      name: r.name.length > 25 ? r.name.substring(0, 22) + '...' : r.name,
      value: r.totalLimit,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
    return (
      <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            stroke="#94a3b8"
            tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            width={160}
          />
          <Tooltip
            formatter={((value: number) => [formatCurrency(value), 'Limit']) as any}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="value" name="Total Limit" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTopRisks = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 font-semibold text-slate-600 w-12">#</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-600">Ref #</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-600">Insured / Cedant</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-600">Class</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-600">Territory</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600">Limit (USD)</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600">GWP (USD)</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-600">Our Share</th>
          </tr>
        </thead>
        <tbody>
          {topRisks.map((r, i) => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-2.5 px-4 text-slate-400 font-mono">{i + 1}</td>
              <td className="py-2.5 px-4 text-blue-600 font-medium">{r.reference_number}</td>
              <td className="py-2.5 px-4 text-slate-800 max-w-[200px] truncate">{r.cedant_name || r.insured_name || '-'}</td>
              <td className="py-2.5 px-4 text-slate-600 max-w-[150px] truncate">{r.class_of_business || '-'}</td>
              <td className="py-2.5 px-4 text-slate-600">{r.territory || '-'}</td>
              <td className="py-2.5 px-4 text-right text-slate-800 font-mono font-medium">{formatCurrency(toUSD(r.sum_insured_national, r.currency))}</td>
              <td className="py-2.5 px-4 text-right text-slate-700 font-mono">{formatCurrency(toUSD(r.gross_premium, r.currency))}</td>
              <td className="py-2.5 px-4 text-right text-slate-700 font-mono">{r.our_share ? formatPercent(r.our_share) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── Error state ───────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800">Failed to load data</h3>
          <p className="text-slate-500 mt-1">{error}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Exposure</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '-' : formatCurrency(totalExposure)}</p>
          <p className="text-xs text-slate-400 mt-1">{rows.length} active policies</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Largest Single Risk</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '-' : formatCurrency(largestSingleRisk)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {totalExposure > 0 ? formatPercent((largestSingleRisk / totalExposure) * 100) : '0%'} of total
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Territory Count</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '-' : distinctTerritories}</p>
          <p className="text-xs text-slate-400 mt-1">Distinct territories</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Class Count</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '-' : distinctClasses}</p>
          <p className="text-xs text-slate-400 mt-1">Distinct classes</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-0 z-30 bg-gray-50 sticky-filter-blur">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
          <div className="flex items-center gap-3">
            <select value={activeTab} onChange={(e) => setActiveTab(e.target.value as TabKey)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white font-medium">
              {TABS.map((tab) => (
                <option key={tab.key} value={tab.key}>{tab.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <>
          {/* Territory Tab */}
          {activeTab === 'territory' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800">Exposure by Territory</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Territories exceeding 25% of total exposure are flagged
                  </p>
                </div>
                <div className="p-5">{renderChart(byTerritory)}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {renderAggTable(byTerritory, 'Territory', THRESHOLDS.territory)}
              </div>
            </div>
          )}

          {/* Class Tab */}
          {activeTab === 'class' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800">Exposure by Class</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Classes exceeding 30% of total exposure are flagged
                  </p>
                </div>
                <div className="p-5">{renderChart(byClass)}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {renderAggTable(byClass, 'Class of Business', THRESHOLDS.class)}
              </div>
            </div>
          )}

          {/* Cedant Tab */}
          {activeTab === 'cedant' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800">Exposure by Cedant / Insured</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cedants exceeding 15% of total exposure are flagged
                  </p>
                </div>
                <div className="p-5">{renderChart(byCedant)}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {renderAggTable(byCedant, 'Cedant / Insured', THRESHOLDS.cedant)}
              </div>
            </div>
          )}

          {/* Top Risks Tab */}
          {activeTab === 'top-risks' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Top 25 Risks by Limit</h3>
                <p className="text-xs text-slate-500 mt-0.5">Largest individual policies and contracts</p>
              </div>
              {renderTopRisks()}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RiskAccumulation;
