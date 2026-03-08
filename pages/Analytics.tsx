import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, FileText, AlertTriangle,
  PieChart as PieChartIcon, BarChart3, Activity, RefreshCw, Download,
  Building2, Globe, Home, FileCheck, Users, Percent, Shield, AlertCircle,
  FileSignature
} from 'lucide-react';
import { useAnalyticsSummary, ChannelType, ChannelMetrics, MGAMetrics } from '../hooks/useAnalytics';
import { exportToExcel } from '../services/excelExport';
import { usePageHeader } from '../context/PageHeaderContext';

// =============================================
// HELPER FUNCTIONS
// =============================================

const formatCurrency = (value: number): string => {
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(2)}B`;
  } else if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
};

const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// Chart colors
const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

const CHANNEL_ICONS: Record<ChannelType, React.ReactNode> = {
  'direct': <Building2 size={20} />,
  'inward-foreign': <Globe size={20} />,
  'inward-domestic': <Home size={20} />,
  'outward': <FileCheck size={20} />,
  'total': <BarChart3 size={20} />,
};

// =============================================
// COMPONENTS
// =============================================

// Channel Card Component
interface ChannelCardProps {
  channel: ChannelMetrics;
  isSelected: boolean;
  onClick: () => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`p-4 rounded-xl border-2 text-left transition-all w-full ${
      isSelected
        ? 'border-blue-500 bg-blue-50 shadow-md'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
    }`}
  >
    <div className="flex items-center justify-between mb-2">
      <div
        className={`p-2 rounded-lg ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}
        style={{ backgroundColor: isSelected ? channel.color : undefined }}
      >
        {CHANNEL_ICONS[channel.channel]}
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
        isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
      }`}>
        {channel.recordCount} records
      </span>
    </div>
    <h3 className="font-semibold text-slate-800 text-sm">{channel.label}</h3>
    <p className="text-lg font-bold mt-1" style={{ color: channel.color }}>
      {formatCurrency(channel.grossWrittenPremium)}
    </p>
    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        {channel.activeCount} active
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        {channel.pendingCount} pending
      </span>
    </div>
  </button>
);

// KPI Card Component
interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: { value: number; isPositive: boolean };
}

const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, icon, color, trend }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-sm ${trend.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);

// Small Stat Card
interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color = 'text-slate-800' }) => (
  <div className="text-center p-3 bg-slate-50 rounded-lg">
    <p className={`text-xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
  </div>
);

// Chart Card Wrapper
interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, children, loading, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
    <div className="px-5 py-4 border-b border-slate-100">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-5">
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

// =============================================
// MAIN COMPONENT
// =============================================

const Analytics: React.FC = () => {
  const { data, loading, error, refetch } = useAnalyticsSummary();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('total');

  // Get the currently selected channel's metrics
  const currentMetrics = selectedChannel === 'total'
    ? data?.total
    : data?.channels.find(c => c.channel === selectedChannel);

  // Prepare channel comparison data for bar chart
  // Use concise but distinct labels for each channel
  const getChartLabel = (channel: ChannelType): string => {
    switch (channel) {
      case 'direct': return 'Direct';
      case 'inward-foreign': return 'Inward Foreign';
      case 'inward-domestic': return 'Inward Domestic';
      case 'outward': return 'Outward Ceded';
      default: return 'Total';
    }
  };

  const channelComparisonBase = data?.channels.map(ch => ({
    name: getChartLabel(ch.channel),
    gwp: ch.grossWrittenPremium,
    nwp: ch.netWrittenPremium,
    records: ch.recordCount,
    fill: ch.color,
  })) || [];

  // Append MGA bars if there are active agreements
  const channelComparisonData = data?.mga && data.mga.agreementCount > 0
    ? [
        ...channelComparisonBase,
        { name: 'MGA (Actual)', gwp: data.mga.actualGwp, nwp: data.mga.actualGwp, records: data.mga.agreementCount, fill: '#4f46e5' },
        { name: 'MGA (EPI)', gwp: data.mga.totalEpi, nwp: data.mga.totalEpi, records: data.mga.agreementCount, fill: '#a5b4fc' },
      ]
    : channelComparisonBase;

  // Prepare class breakdown data for pie chart
  const classBreakdownData = currentMetrics
    ? Object.entries(currentMetrics.classBreakdown)
        .map(([cls, data]) => ({
          name: cls.replace(/^\d+\s*-\s*/, '').substring(0, 20),
          value: data.premium,
          count: data.count,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    : [];

  // Prepare premium waterfall data
  const outwardChannel = data?.channels.find(c => c.channel === 'outward');
  const waterfallData = data ? [
    { name: 'GWP', value: data.total.grossWrittenPremium, fill: '#3b82f6' },
    { name: 'Ceded', value: -(outwardChannel?.grossWrittenPremium || 0), fill: '#ef4444' },
    { name: 'NWP', value: data.total.netWrittenPremium, fill: '#10b981' },
    { name: 'UPR', value: -data.total.unearnedPremiumReserve, fill: '#f59e0b' },
    { name: 'NPE', value: data.total.netPremiumEarned, fill: '#06b6d4' },
  ] : [];

  // Prepare currency breakdown
  const currencyBreakdownData = currentMetrics
    ? Object.entries(currentMetrics.currencyBreakdown)
        .map(([currency, data]) => ({
          name: currency,
          value: data.premium,
          count: data.count,
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const handleExport = () => {
    if (!data) return;
    const rows: any[] = [];
    // Channel summary rows
    data.channels.forEach(ch => {
      rows.push({
        'Channel': ch.label,
        'Records': ch.recordCount,
        'Active': ch.activeCount,
        'Pending': ch.pendingCount,
        'GWP': ch.grossWrittenPremium,
        'NWP': ch.netWrittenPremium,
        'Commission': ch.commission,
        'Avg Premium': ch.avgPremium,
        'Avg Share %': ch.avgOurShare,
        'Total Limit': ch.totalLimit,
      });
    });
    // Total row
    rows.push({
      'Channel': 'TOTAL',
      'Records': data.total.recordCount,
      'Active': data.total.activeCount,
      'Pending': data.total.pendingCount,
      'GWP': data.total.grossWrittenPremium,
      'NWP': data.total.netWrittenPremium,
      'Commission': data.total.commission,
      'Avg Premium': data.total.avgPremium,
      'Avg Share %': data.total.avgOurShare,
      'Total Limit': data.total.totalLimit,
    });
    exportToExcel(rows, `Analytics_Summary_${new Date().toISOString().split('T')[0]}`, 'Analytics');
  };

  // Header actions
  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          disabled={!data}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          Export
        </button>
        <button
          onClick={refetch}
          disabled={loading}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
        </button>
      </div>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [data, loading, setHeaderActions, setHeaderLeft]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800">Failed to load analytics</h3>
          <p className="text-slate-500 mt-1">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Channel Selector Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {data && (
          <>
            <ChannelCard
              channel={data.total}
              isSelected={selectedChannel === 'total'}
              onClick={() => setSelectedChannel('total')}
            />
            {data.channels.map(ch => (
              <ChannelCard
                key={ch.channel}
                channel={ch}
                isSelected={selectedChannel === ch.channel}
                onClick={() => setSelectedChannel(ch.channel)}
              />
            ))}
          </>
        )}
        {loading && !data && (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white animate-pulse">
              <div className="h-20 bg-slate-100 rounded"></div>
            </div>
          ))
        )}
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Gross Written Premium"
          value={currentMetrics ? formatCurrency(currentMetrics.grossWrittenPremium) : '-'}
          subtitle={selectedChannel === 'total' ? 'Total portfolio' : currentMetrics?.label}
          icon={<DollarSign className="w-5 h-5 text-white" />}
          color="bg-blue-500"
        />
        <KPICard
          title="Net Written Premium"
          value={currentMetrics ? formatCurrency(currentMetrics.netWrittenPremium) : '-'}
          subtitle="After cessions"
          icon={<Activity className="w-5 h-5 text-white" />}
          color="bg-emerald-500"
        />
        <KPICard
          title="Loss Ratio"
          value={data ? formatPercent(data.claims.lossRatio) : '-'}
          subtitle={`${data?.claims.openClaims || 0} open claims`}
          icon={<PieChartIcon className="w-5 h-5 text-white" />}
          color={data && data.claims.lossRatio > 70 ? 'bg-red-500' : 'bg-amber-500'}
        />
        <KPICard
          title="Total Records"
          value={currentMetrics ? formatNumber(currentMetrics.recordCount) : '-'}
          subtitle={`${currentMetrics?.activeCount || 0} active`}
          icon={<FileText className="w-5 h-5 text-white" />}
          color="bg-violet-500"
        />
      </div>

      {/* Earned Premium KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Gross Premium Earned"
          value={currentMetrics ? formatCurrency(currentMetrics.grossPremiumEarned) : '-'}
          subtitle="Pro-rata earned"
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          color="bg-teal-500"
        />
        <KPICard
          title="Net Premium Earned"
          value={currentMetrics ? formatCurrency(currentMetrics.netPremiumEarned) : '-'}
          subtitle="Earned after cessions"
          icon={<Activity className="w-5 h-5 text-white" />}
          color="bg-cyan-500"
        />
        <KPICard
          title="Unearned Premium Reserve"
          value={currentMetrics ? formatCurrency(currentMetrics.unearnedPremiumReserve) : '-'}
          subtitle="UPR (liability)"
          icon={<Shield className="w-5 h-5 text-white" />}
          color="bg-orange-500"
        />
        <KPICard
          title="Combined Ratio"
          value={data ? formatPercent(data.expenseRatio > 0 ? data.fullCombinedRatio : data.claims.lossRatio + (currentMetrics?.commissionRatio || 0)) : '-'}
          subtitle={data
            ? data.expenseRatio > 0
              ? `L: ${formatPercent(data.claims.lossRatio)} + C: ${formatPercent(currentMetrics?.commissionRatio || 0)} + E: ${formatPercent(data.expenseRatio)}`
              : (data.claims.lossRatio + (currentMetrics?.commissionRatio || 0)) < 100
                ? 'Underwriting profit' : 'Underwriting loss'
            : undefined}
          icon={<Percent className="w-5 h-5 text-white" />}
          color={data && (data.expenseRatio > 0 ? data.fullCombinedRatio : data.claims.lossRatio + (currentMetrics?.commissionRatio || 0)) < 100
            ? 'bg-green-500' : 'bg-red-500'}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
        <StatCard
          label="Commission"
          value={currentMetrics ? formatCurrency(currentMetrics.commission) : '-'}
          color="text-blue-600"
        />
        <StatCard
          label="Avg Premium"
          value={currentMetrics ? formatCurrency(currentMetrics.avgPremium) : '-'}
          color="text-emerald-600"
        />
        <StatCard
          label="Avg Share %"
          value={currentMetrics ? formatPercent(currentMetrics.avgOurShare) : '-'}
          color="text-violet-600"
        />
        <StatCard
          label="Total Limit"
          value={currentMetrics ? formatCurrency(currentMetrics.totalLimit) : '-'}
          color="text-amber-600"
        />
        <StatCard
          label="Active"
          value={currentMetrics ? currentMetrics.activeCount.toLocaleString() : '-'}
          color="text-green-600"
        />
        <StatCard
          label="Comm. Ratio"
          value={currentMetrics ? formatPercent(currentMetrics.commissionRatio) : '-'}
          color="text-orange-600"
        />
        <StatCard
          label="Expense Ratio"
          value={data?.expenseRatio ? formatPercent(data.expenseRatio) : 'N/A'}
          color="text-purple-600"
        />
      </div>

      {/* MGA / Binding Authority Section */}
      {data?.mga && data.mga.agreementCount > 0 && (
        <div className="bg-white rounded-xl border-2 border-indigo-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileSignature size={18} className="text-indigo-600" />
            <h3 className="font-semibold text-indigo-900">MGA / Binding Authority</h3>
            <span className="text-xs text-indigo-500 ml-auto">{data.mga.agreementCount} active agreements</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="EPI (Forecast)" value={formatCurrency(data.mga.totalEpi)} color="text-indigo-400" />
            <StatCard label="Actual GWP" value={formatCurrency(data.mga.actualGwp)} color="text-indigo-700" />
            <StatCard
              label="Utilization"
              value={formatPercent(data.mga.utilizationPercent)}
              color={data.mga.utilizationPercent > 80 ? 'text-green-600' : data.mga.utilizationPercent > 50 ? 'text-amber-600' : 'text-red-600'}
            />
            <StatCard label="Remaining EPI" value={formatCurrency(data.mga.totalEpi - data.mga.actualGwp)} color="text-slate-500" />
          </div>
        </div>
      )}

      {/* Charts Row 1: Trend and Channel Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Premium Trend Chart */}
        <ChartCard
          title="Premium Trend"
          subtitle={`Monthly GWP and NWP - ${currentMetrics?.label || 'Total'}`}
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={currentMetrics?.monthlyTrend || []}>
              <defs>
                <linearGradient id="gwpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="nwpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), '']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="gwp"
                stroke="#3b82f6"
                fill="url(#gwpGradient)"
                strokeWidth={2}
                name="GWP"
              />
              <Area
                type="monotone"
                dataKey="nwp"
                stroke="#10b981"
                fill="url(#nwpGradient)"
                strokeWidth={2}
                name="NWP"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Written vs Earned Premium */}
        <ChartCard
          title="Written vs Earned Premium"
          subtitle="Monthly GWP vs GPE comparison"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={currentMetrics?.monthlyTrend || []}>
              <defs>
                <linearGradient id="gwpAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gpeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const gwp = Number(payload.find(p => p.dataKey === 'gwp')?.value) || 0;
                  const gpe = Number(payload.find(p => p.dataKey === 'gpe')?.value) || 0;
                  const upr = gwp - gpe;
                  const earningPct = gwp > 0 ? (gpe / gwp) * 100 : 0;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
                      <p className="font-semibold text-slate-800 mb-1.5">{label}</p>
                      <p className="text-blue-600">GWP: {formatCurrency(gwp)}</p>
                      <p className="text-teal-600">GPE: {formatCurrency(gpe)}</p>
                      <p className="text-amber-600">UPR: {formatCurrency(upr)}</p>
                      <p className="text-slate-500 mt-1">Earning: {formatPercent(earningPct)}</p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="gwp"
                stroke="#3b82f6"
                fill="url(#gwpAreaGradient)"
                strokeWidth={2}
                name="GWP"
              />
              <Area
                type="monotone"
                dataKey="gpe"
                stroke="#14b8a6"
                fill="url(#gpeAreaGradient)"
                strokeWidth={2}
                name="GPE"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Channel Comparison */}
      <div className="grid grid-cols-1 gap-6">
        {/* Channel Comparison */}
        <ChartCard
          title="Channel Comparison"
          subtitle="GWP by business channel"
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={channelComparisonData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
                width={110}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), '']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="gwp" name="GWP" radius={[0, 4, 4, 0]}>
                {channelComparisonData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Premium Waterfall */}
      <ChartCard
        title="Premium Waterfall"
        subtitle="Written → Ceded → Net → Earned"
        loading={loading}
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} stroke="#94a3b8" />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#94a3b8"
              tickFormatter={(v) => `$${(Math.abs(v) / 1000000).toFixed(1)}M`}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(Math.abs(value)), value < 0 ? 'Deduction' : 'Amount']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {waterfallData.map((entry, index) => (
                <Cell key={`wf-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Charts Row 2: Class Breakdown and Loss Ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Breakdown Pie */}
        <ChartCard
          title="Premium by Class"
          subtitle={`Distribution - ${currentMetrics?.label || 'Total'}`}
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={classBreakdownData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {classBreakdownData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Premium']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-1 mt-2 max-h-24 overflow-y-auto">
            {classBreakdownData.slice(0, 6).map((item, i) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                <span className="text-slate-600 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Loss Ratio by Class */}
        <ChartCard
          title="Loss Ratio by Class"
          subtitle="Premium vs Incurred Losses"
          loading={loading}
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.lossRatioByClass || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="class"
                tick={{ fontSize: 10 }}
                stroke="#94a3b8"
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                stroke="#f59e0b"
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'lossRatio' ? `${value}%` : formatCurrency(value),
                  name === 'lossRatio' ? 'Loss Ratio' : name === 'earnedPremium' ? 'Premium' : 'Losses'
                ]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="earnedPremium" fill="#3b82f6" name="Premium" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="incurredLosses" fill="#ef4444" name="Losses" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="lossRatio" stroke="#f59e0b" strokeWidth={2} name="Loss Ratio %" dot={{ fill: '#f59e0b' }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tables Row: Top Cedants and Claims */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Cedants */}
        <ChartCard
          title="Top Clients by Premium"
          subtitle={`${currentMetrics?.label || 'Total Portfolio'}`}
          loading={loading}
        >
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {(currentMetrics?.topCedants || []).slice(0, 10).map((cedant, index) => (
              <div key={cedant.name} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-700' : 'bg-slate-300'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate max-w-48">{cedant.name}</p>
                    <p className="text-xs text-slate-500">{cedant.count} contracts</p>
                  </div>
                </div>
                <span className="font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(cedant.premium)}</span>
              </div>
            ))}
            {(!currentMetrics?.topCedants || currentMetrics.topCedants.length === 0) && (
              <div className="text-center py-8 text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2" />
                <p>No client data available</p>
              </div>
            )}
          </div>
        </ChartCard>

        {/* Claims Overview */}
        <ChartCard
          title="Claims Overview"
          subtitle="Portfolio-wide claims metrics"
          loading={loading}
        >
          {data?.claims ? (
            <div className="space-y-4">
              {/* Claims Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-slate-500">Open Claims</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">{data.claims.openClaims}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-slate-500">Closed Claims</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{data.claims.closedClaims}</p>
                </div>
              </div>

              {/* Financial Metrics */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-sm text-slate-600">Total Incurred</span>
                  <span className="font-bold text-red-600">{formatCurrency(data.claims.totalIncurred)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-slate-600">Total Paid</span>
                  <span className="font-bold text-blue-600">{formatCurrency(data.claims.totalPaid)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                  <span className="text-sm text-slate-600">Outstanding Reserve</span>
                  <span className="font-bold text-amber-600">{formatCurrency(data.claims.totalReserve)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg">
                  <span className="text-sm text-slate-600">Average Claim Size</span>
                  <span className="font-bold text-violet-600">{formatCurrency(data.claims.avgClaimSize)}</span>
                </div>
              </div>

              {/* Loss Ratio Indicator */}
              <div className="mt-4 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Loss Ratio</span>
                  <span className={`text-lg font-bold ${
                    data.claims.lossRatio > 80 ? 'text-red-600' :
                    data.claims.lossRatio > 60 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {formatPercent(data.claims.lossRatio)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      data.claims.lossRatio > 80 ? 'bg-red-500' :
                      data.claims.lossRatio > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(data.claims.lossRatio, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              <p>No claims data available</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Currency Breakdown */}
      <ChartCard
        title="Currency Distribution"
        subtitle={`Premium by currency - ${currentMetrics?.label || 'Total'}`}
        loading={loading}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {currencyBreakdownData.map((item, index) => (
            <div key={item.name} className="p-4 bg-slate-50 rounded-lg text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mx-auto mb-2"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              >
                {item.name}
              </div>
              <p className="font-semibold text-slate-800">{formatCurrency(item.value)}</p>
              <p className="text-xs text-slate-500">{item.count} contracts</p>
            </div>
          ))}
          {currencyBreakdownData.length === 0 && (
            <div className="col-span-full text-center py-8 text-slate-400">
              <Percent className="w-8 h-8 mx-auto mb-2" />
              <p>No currency data available</p>
            </div>
          )}
        </div>
      </ChartCard>

      {/* Quick Stats Footer */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <h3 className="font-semibold mb-4">Portfolio Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-slate-400 text-xs">Total Records</p>
            <p className="text-2xl font-bold">{data?.total.recordCount.toLocaleString() || '-'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Total GWP</p>
            <p className="text-2xl font-bold">{data ? formatCurrency(data.total.grossWrittenPremium) : '-'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Total NWP</p>
            <p className="text-2xl font-bold">{data ? formatCurrency(data.total.netWrittenPremium) : '-'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Total Claims</p>
            <p className="text-2xl font-bold">{data?.claims.totalClaims.toLocaleString() || '-'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Classes Written</p>
            <p className="text-2xl font-bold">{data ? Object.keys(data.total.classBreakdown).length : '-'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Currencies</p>
            <p className="text-2xl font-bold">{data ? Object.keys(data.total.currencyBreakdown).length : '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
