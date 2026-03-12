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
import { useTheme } from '../theme/useTheme';
import Button from '../components/ui/Button';

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

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, isSelected, onClick }) => {
  const { t } = useTheme();
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-xl text-left transition-all w-full"
      style={{
        border: isSelected ? `2px solid ${t.accent}` : `2px solid ${t.border}`,
        background: isSelected ? t.accentMuted : t.bgPanel,
        boxShadow: isSelected ? t.shadowLg : 'none',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className="p-2 rounded-lg"
          style={{
            backgroundColor: isSelected ? channel.color : t.bgInput,
            color: isSelected ? '#fff' : t.text3,
          }}
        >
          {CHANNEL_ICONS[channel.channel]}
        </div>
        <span
          className="text-xs font-medium px-2 py-1 rounded-full"
          style={{
            background: isSelected ? t.accentMuted : t.bgInput,
            color: isSelected ? t.accent : t.text4,
          }}
        >
          {channel.recordCount} records
        </span>
      </div>
      <h3 className="font-semibold text-sm" style={{ color: t.text1 }}>{channel.label}</h3>
      <p className="mt-1" style={{ color: channel.color, fontSize: 15, fontWeight: 700 }}>
        {formatCurrency(channel.grossWrittenPremium)}
      </p>
      <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: t.text4 }}>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: t.success }}></span>
          {channel.activeCount} active
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: t.warning }}></span>
          {channel.pendingCount} pending
        </span>
      </div>
    </button>
  );
};

// KPI Card Component
interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: { value: number; isPositive: boolean };
}

const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, icon, color, trend }) => {
  const { t } = useTheme();
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: t.text4 }}>{title}</p>
          <p className="mt-1" style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>{value}</p>
          {subtitle && <p className="text-xs mt-1 truncate" style={{ color: t.text5 }}>{subtitle}</p>}
          {trend && (
            <div
              className="flex items-center gap-1 mt-2 text-sm"
              style={{ color: trend.isPositive ? t.success : t.danger }}
            >
              {trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: color }}>
          {icon}
        </div>
      </div>
    </div>
  );
};

// Small Stat Card
interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => {
  const { t } = useTheme();
  return (
    <div className="text-center p-3 rounded-lg" style={{ background: t.bgCard }}>
      <p style={{ color: color || t.text1, fontSize: 24, fontWeight: 700 }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: t.text4 }}>{label}</p>
    </div>
  );
};

// Chart Card Wrapper
interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, children, loading, className = '' }) => {
  const { t } = useTheme();
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}
    >
      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.borderS}` }}>
        <h3 className="font-semibold" style={{ color: t.text1 }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: t.text4 }}>{subtitle}</p>}
      </div>
      <div className="p-5">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: t.text5 }} />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

// =============================================
// MAIN COMPONENT
// =============================================

const Analytics: React.FC = () => {
  const { data, loading, error, refetch } = useAnalyticsSummary();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('total');
  const { t } = useTheme();

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
        <Button variant="primary" size="sm" icon={<Download size={14} />} onClick={handleExport} disabled={!data} style={{ background: t.success, opacity: !data ? 0.5 : 1 }}>
          Export
        </Button>
        <Button variant="ghost" size="sm" onClick={refetch} disabled={loading} style={{ padding: 8, border: 'none', opacity: loading ? 0.5 : 1 }}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={loading ? { color: t.accent } : { color: t.text4 }} />
        </Button>
      </div>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [data, loading, setHeaderActions, setHeaderLeft, t]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: t.danger }} />
          <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 600 }}>Failed to load analytics</h3>
          <p className="mt-1" style={{ color: t.text4 }}>{error}</p>
          <Button variant="primary" onClick={refetch} style={{ marginTop: 16 }}>
            Retry
          </Button>
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
            <div
              key={i}
              className="p-4 rounded-xl animate-pulse"
              style={{ border: `1px solid ${t.border}`, background: t.bgPanel }}
            >
              <div className="h-20 rounded" style={{ background: t.bgInput }}></div>
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
          icon={<DollarSign className="w-5 h-5" style={{ color: '#fff' }} />}
          color="#3b82f6"
        />
        <KPICard
          title="Net Written Premium"
          value={currentMetrics ? formatCurrency(currentMetrics.netWrittenPremium) : '-'}
          subtitle="After cessions"
          icon={<Activity className="w-5 h-5" style={{ color: '#fff' }} />}
          color="#10b981"
        />
        <KPICard
          title="Loss Ratio"
          value={data ? formatPercent(data.claims.lossRatio) : '-'}
          subtitle={`${data?.claims.openClaims || 0} open claims`}
          icon={<PieChartIcon className="w-5 h-5" style={{ color: '#fff' }} />}
          color={data && data.claims.lossRatio > 70 ? '#ef4444' : '#f59e0b'}
        />
        <KPICard
          title="Total Records"
          value={currentMetrics ? formatNumber(currentMetrics.recordCount) : '-'}
          subtitle={`${currentMetrics?.activeCount || 0} active`}
          icon={<FileText className="w-5 h-5" style={{ color: '#fff' }} />}
          color="#8b5cf6"
        />
      </div>

      {/* Earned Premium KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Gross Premium Earned"
          value={currentMetrics ? formatCurrency(currentMetrics.grossPremiumEarned) : '-'}
          subtitle="Pro-rata earned"
          icon={<TrendingUp className="w-5 h-5" style={{ color: '#fff' }} />}
          color="#14b8a6"
        />
        <KPICard
          title="Net Premium Earned"
          value={currentMetrics ? formatCurrency(currentMetrics.netPremiumEarned) : '-'}
          subtitle="Earned after cessions"
          icon={<Activity className="w-5 h-5" style={{ color: '#fff' }} />}
          color="#06b6d4"
        />
        <KPICard
          title="Unearned Premium Reserve"
          value={currentMetrics ? formatCurrency(currentMetrics.unearnedPremiumReserve) : '-'}
          subtitle="UPR (liability)"
          icon={<Shield className="w-5 h-5" style={{ color: '#fff' }} />}
          color="#f97316"
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
          icon={<Percent className="w-5 h-5" style={{ color: '#fff' }} />}
          color={data && (data.expenseRatio > 0 ? data.fullCombinedRatio : data.claims.lossRatio + (currentMetrics?.commissionRatio || 0)) < 100
            ? '#22c55e' : '#ef4444'}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
        <StatCard
          label="Commission"
          value={currentMetrics ? formatCurrency(currentMetrics.commission) : '-'}
          color={t.accent}
        />
        <StatCard
          label="Avg Premium"
          value={currentMetrics ? formatCurrency(currentMetrics.avgPremium) : '-'}
          color={t.success}
        />
        <StatCard
          label="Avg Share %"
          value={currentMetrics ? formatPercent(currentMetrics.avgOurShare) : '-'}
          color="#8b5cf6"
        />
        <StatCard
          label="Total Limit"
          value={currentMetrics ? formatCurrency(currentMetrics.totalLimit) : '-'}
          color={t.warning}
        />
        <StatCard
          label="Active"
          value={currentMetrics ? currentMetrics.activeCount.toLocaleString() : '-'}
          color={t.success}
        />
        <StatCard
          label="Comm. Ratio"
          value={currentMetrics ? formatPercent(currentMetrics.commissionRatio) : '-'}
          color="#f97316"
        />
        <StatCard
          label="Expense Ratio"
          value={data?.expenseRatio ? formatPercent(data.expenseRatio) : 'N/A'}
          color="#a855f7"
        />
      </div>

      {/* MGA / Binding Authority Section */}
      {data?.mga && data.mga.agreementCount > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: t.bgPanel, border: `2px solid ${t.accent}` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <FileSignature size={18} style={{ color: t.accent }} />
            <h3 className="font-semibold" style={{ color: t.text1 }}>MGA / Binding Authority</h3>
            <span className="text-xs ml-auto" style={{ color: t.text4 }}>{data.mga.agreementCount} active agreements</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="EPI (Forecast)" value={formatCurrency(data.mga.totalEpi)} color={t.text4} />
            <StatCard label="Actual GWP" value={formatCurrency(data.mga.actualGwp)} color={t.accent} />
            <StatCard
              label="Utilization"
              value={formatPercent(data.mga.utilizationPercent)}
              color={data.mga.utilizationPercent > 80 ? t.success : data.mga.utilizationPercent > 50 ? t.warning : t.danger}
            />
            <StatCard label="Remaining EPI" value={formatCurrency(data.mga.totalEpi - data.mga.actualGwp)} color={t.text4} />
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
                  <stop offset="5%" stopColor={t.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={t.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="nwpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={t.success} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={t.success} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke={t.text4} />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke={t.text4}
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), '']}
                contentStyle={{ borderRadius: '8px', border: `1px solid ${t.border}`, background: t.bgPanel, color: t.text1 }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="gwp"
                stroke={t.accent}
                fill="url(#gwpGradient)"
                strokeWidth={2}
                name="GWP"
              />
              <Area
                type="monotone"
                dataKey="nwp"
                stroke={t.success}
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
                  <stop offset="5%" stopColor={t.accent} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={t.accent} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gpeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke={t.text4} />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke={t.text4}
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
                    <div className="rounded-lg p-3 text-sm" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadowLg }}>
                      <p className="font-semibold mb-1.5" style={{ color: t.text1 }}>{label}</p>
                      <p style={{ color: t.accent }}>GWP: {formatCurrency(gwp)}</p>
                      <p style={{ color: '#14b8a6' }}>GPE: {formatCurrency(gpe)}</p>
                      <p style={{ color: t.warning }}>UPR: {formatCurrency(upr)}</p>
                      <p className="mt-1" style={{ color: t.text4 }}>Earning: {formatPercent(earningPct)}</p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="gwp"
                stroke={t.accent}
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
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                stroke={t.text4}
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                stroke={t.text4}
                width={110}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), '']}
                contentStyle={{ borderRadius: '8px', border: `1px solid ${t.border}`, background: t.bgPanel, color: t.text1 }}
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
            <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} stroke={t.text4} />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke={t.text4}
              tickFormatter={(v) => `$${(Math.abs(v) / 1000000).toFixed(1)}M`}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(Math.abs(value)), value < 0 ? 'Deduction' : 'Amount']}
              contentStyle={{ borderRadius: '8px', border: `1px solid ${t.border}`, background: t.bgPanel, color: t.text1 }}
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
                contentStyle={{ borderRadius: '8px', border: `1px solid ${t.border}`, background: t.bgPanel, color: t.text1 }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-1 mt-2 max-h-24 overflow-y-auto">
            {classBreakdownData.slice(0, 6).map((item, i) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                <span className="truncate" style={{ color: t.text3 }}>{item.name}</span>
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
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis
                dataKey="class"
                tick={{ fontSize: 10 }}
                stroke={t.text4}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                stroke={t.text4}
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                stroke={t.warning}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'lossRatio' ? `${value}%` : formatCurrency(value),
                  name === 'lossRatio' ? 'Loss Ratio' : name === 'earnedPremium' ? 'Premium' : 'Losses'
                ]}
                contentStyle={{ borderRadius: '8px', border: `1px solid ${t.border}`, background: t.bgPanel, color: t.text1 }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="earnedPremium" fill={t.accent} name="Premium" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="incurredLosses" fill={t.danger} name="Losses" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="lossRatio" stroke={t.warning} strokeWidth={2} name="Loss Ratio %" dot={{ fill: t.warning }} />
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
              <div key={cedant.name} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: `1px solid ${t.borderS}` }}>
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      color: '#fff',
                      backgroundColor: index === 0 ? '#f59e0b' : index === 1 ? t.text4 : index === 2 ? '#92400e' : t.text5,
                    }}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate max-w-48" style={{ color: t.text1 }}>{cedant.name}</p>
                    <p className="text-xs" style={{ color: t.text4 }}>{cedant.count} contracts</p>
                  </div>
                </div>
                <span className="font-semibold whitespace-nowrap" style={{ color: t.text1 }}>{formatCurrency(cedant.premium)}</span>
              </div>
            ))}
            {(!currentMetrics?.topCedants || currentMetrics.topCedants.length === 0) && (
              <div className="text-center py-8" style={{ color: t.text5 }}>
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
                <div className="p-4 rounded-lg" style={{ background: t.bgCard }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" style={{ color: t.warning }} />
                    <span className="text-xs" style={{ color: t.text4 }}>Open Claims</span>
                  </div>
                  <p style={{ color: t.warning, fontSize: 24, fontWeight: 700 }}>{data.claims.openClaims}</p>
                </div>
                <div className="p-4 rounded-lg" style={{ background: t.bgCard }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4" style={{ color: t.success }} />
                    <span className="text-xs" style={{ color: t.text4 }}>Closed Claims</span>
                  </div>
                  <p style={{ color: t.success, fontSize: 24, fontWeight: 700 }}>{data.claims.closedClaims}</p>
                </div>
              </div>

              {/* Financial Metrics */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: t.dangerBg }}>
                  <span className="text-sm" style={{ color: t.text3 }}>Total Incurred</span>
                  <span className="font-bold" style={{ color: t.danger }}>{formatCurrency(data.claims.totalIncurred)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: t.accentMuted }}>
                  <span className="text-sm" style={{ color: t.text3 }}>Total Paid</span>
                  <span className="font-bold" style={{ color: t.accent }}>{formatCurrency(data.claims.totalPaid)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: t.warningBg }}>
                  <span className="text-sm" style={{ color: t.text3 }}>Outstanding Reserve</span>
                  <span className="font-bold" style={{ color: t.warning }}>{formatCurrency(data.claims.totalReserve)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: t.bgCard }}>
                  <span className="text-sm" style={{ color: t.text3 }}>Average Claim Size</span>
                  <span className="font-bold" style={{ color: '#8b5cf6' }}>{formatCurrency(data.claims.avgClaimSize)}</span>
                </div>
              </div>

              {/* Loss Ratio Indicator */}
              <div className="mt-4 p-4 rounded-lg" style={{ border: `1px solid ${t.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: t.text3 }}>Loss Ratio</span>
                  <span
                    style={{
                      color: data.claims.lossRatio > 80 ? t.danger :
                             data.claims.lossRatio > 60 ? t.warning : t.success,
                      fontSize: 15, fontWeight: 700,
                    }}
                  >
                    {formatPercent(data.claims.lossRatio)}
                  </span>
                </div>
                <div className="w-full rounded-full h-2.5" style={{ background: t.border }}>
                  <div
                    className="h-2.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(data.claims.lossRatio, 100)}%`,
                      background: data.claims.lossRatio > 80 ? t.danger :
                                  data.claims.lossRatio > 60 ? t.warning : t.success,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: t.text5 }}>
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
            <div key={item.name} className="p-4 rounded-lg text-center" style={{ background: t.bgCard }}>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mx-auto mb-2"
                style={{ backgroundColor: COLORS[index % COLORS.length], color: '#fff' }}
              >
                {item.name}
              </div>
              <p className="font-semibold" style={{ color: t.text1 }}>{formatCurrency(item.value)}</p>
              <p className="text-xs" style={{ color: t.text4 }}>{item.count} contracts</p>
            </div>
          ))}
          {currencyBreakdownData.length === 0 && (
            <div className="col-span-full text-center py-8" style={{ color: t.text5 }}>
              <Percent className="w-8 h-8 mx-auto mb-2" />
              <p>No currency data available</p>
            </div>
          )}
        </div>
      </ChartCard>

      {/* Quick Stats Footer */}
      <div className="rounded-xl p-6" style={{ background: t.bgSidebar, border: `1px solid ${t.border}`, boxShadow: t.shadowLg }}>
        <h3 className="font-semibold mb-4" style={{ color: t.text1 }}>Portfolio Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-xs" style={{ color: t.text4 }}>Total Records</p>
            <p style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>{data?.total.recordCount.toLocaleString() || '-'}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: t.text4 }}>Total GWP</p>
            <p style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>{data ? formatCurrency(data.total.grossWrittenPremium) : '-'}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: t.text4 }}>Total NWP</p>
            <p style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>{data ? formatCurrency(data.total.netWrittenPremium) : '-'}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: t.text4 }}>Total Claims</p>
            <p style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>{data?.claims.totalClaims.toLocaleString() || '-'}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: t.text4 }}>Classes Written</p>
            <p style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>{data ? Object.keys(data.total.classBreakdown).length : '-'}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: t.text4 }}>Currencies</p>
            <p style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>{data ? Object.keys(data.total.currencyBreakdown).length : '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
