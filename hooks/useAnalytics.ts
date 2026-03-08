import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { DB } from '../services/db';

// =============================================
// TYPES
// =============================================

export type ChannelType = 'direct' | 'inward-foreign' | 'inward-domestic' | 'outward' | 'total';

export interface ChannelMetrics {
  channel: ChannelType;
  label: string;
  color: string;
  recordCount: number;
  activeCount: number;
  pendingCount: number;
  cancelledCount: number;
  grossWrittenPremium: number;
  netWrittenPremium: number;
  grossPremiumEarned: number;
  netPremiumEarned: number;
  unearnedPremiumReserve: number;
  commission: number;
  commissionRatio: number;
  avgPremium: number;
  avgOurShare: number;
  totalLimit: number;
  currencyBreakdown: Record<string, { count: number; premium: number }>;
  classBreakdown: Record<string, { count: number; premium: number }>;
  monthlyTrend: { month: string; gwp: number; nwp: number; gpe: number; npe: number; count: number }[];
  topCedants: { name: string; premium: number; count: number }[];
}

export interface MGAMetrics {
  agreementCount: number;
  totalEpi: number;
  actualGwp: number;
  utilizationPercent: number;
}

export interface AnalyticsSummary {
  channels: ChannelMetrics[];
  total: ChannelMetrics;
  claims: ClaimsMetrics;
  mga: MGAMetrics;
  lossRatioByClass: LossRatioData[];
  recentActivity: ActivityItem[];
  operatingExpenses: number;
  expenseRatio: number;
  fullCombinedRatio: number;
}

export interface ClaimsMetrics {
  totalClaims: number;
  openClaims: number;
  closedClaims: number;
  totalIncurred: number;
  totalPaid: number;
  totalReserve: number;
  avgClaimSize: number;
  lossRatio: number;
}

export interface LossRatioData {
  class: string;
  earnedPremium: number;
  incurredLosses: number;
  lossRatio: number;
  claimCount: number;
}

export interface ActivityItem {
  id: string;
  type: 'policy' | 'inward' | 'claim' | 'slip';
  action: string;
  description: string;
  date: string;
  amount?: number;
}

// Channel configuration
const CHANNEL_CONFIG: Record<ChannelType, { label: string; color: string }> = {
  'direct': { label: 'Direct Insurance', color: '#3b82f6' },
  'inward-foreign': { label: 'Inward Foreign', color: '#8b5cf6' },
  'inward-domestic': { label: 'Inward Domestic', color: '#10b981' },
  'outward': { label: 'Outward Cessions', color: '#f59e0b' },
  'total': { label: 'Total Portfolio', color: '#1e293b' },
};

// =============================================
// HELPER FUNCTIONS
// =============================================

const getMonthKey = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (key: string): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, month] = key.split('-');
  return months[parseInt(month) - 1] || key;
};

const normalizeStatus = (status: string): 'active' | 'pending' | 'cancelled' => {
  const s = status?.toUpperCase() || '';
  if (s.includes('ACTIVE') || s === 'BOUND' || s === 'SIGNED') return 'active';
  if (s.includes('PENDING') || s.includes('DRAFT') || s === 'QUOTED' || s === 'SENT') return 'pending';
  return 'cancelled';
};

/**
 * Convert an amount to USD based on currency and exchange rate.
 * Exchange rate is assumed to be local-currency-per-1-USD.
 */
const convertToUSD = (amount: number, currency: string, exchangeRate: number): number => {
  if (!amount || amount === 0) return 0;

  if (currency === 'USD') {
    return amount;
  } else if (currency === 'UZS') {
    // UZS amounts need to be divided by exchange rate
    return exchangeRate > 1 ? amount / exchangeRate : 0;
  } else {
    // EUR, GBP, etc. - use the amount as-is (close enough for reporting)
    return amount;
  }
};

/**
 * Normalize ourShare to percentage format.
 * Some records store as decimal (0.05 = 5%), others as percentage (5 = 5%).
 */
const normalizeOurShare = (ourShare: number): number => {
  if (ourShare > 0 && ourShare < 1) {
    // Looks like a decimal fraction, convert to percentage
    return ourShare * 100;
  }
  return ourShare;
};

/**
 * Calculate the fraction of premium that has been "earned" based on policy duration.
 * Uses straight-line pro-rata: elapsed days / total days.
 */
function calculateEarnedFraction(inceptionDate: string, expiryDate: string): number {
  if (!inceptionDate || !expiryDate) return 1; // No dates = assume fully earned

  const inception = new Date(inceptionDate);
  const expiry = new Date(expiryDate);
  const today = new Date();

  // Validate dates
  if (isNaN(inception.getTime()) || isNaN(expiry.getTime())) return 1;

  const totalDays = (expiry.getTime() - inception.getTime()) / (1000 * 60 * 60 * 24);
  if (totalDays <= 0) return 1; // Same day or invalid = fully earned

  if (today >= expiry) return 1.0;       // Policy expired = fully earned
  if (today <= inception) return 0.0;    // Not yet started = nothing earned

  const elapsedDays = (today.getTime() - inception.getTime()) / (1000 * 60 * 60 * 24);
  return Math.min(1, Math.max(0, elapsedDays / totalDays));
}

const createEmptyChannelMetrics = (channel: ChannelType): ChannelMetrics => ({
  channel,
  label: CHANNEL_CONFIG[channel].label,
  color: CHANNEL_CONFIG[channel].color,
  recordCount: 0,
  activeCount: 0,
  pendingCount: 0,
  cancelledCount: 0,
  grossWrittenPremium: 0,
  netWrittenPremium: 0,
  grossPremiumEarned: 0,
  netPremiumEarned: 0,
  unearnedPremiumReserve: 0,
  commission: 0,
  commissionRatio: 0,
  avgPremium: 0,
  avgOurShare: 0,
  totalLimit: 0,
  currencyBreakdown: {},
  classBreakdown: {},
  monthlyTrend: [],
  topCedants: [],
});

// =============================================
// MAIN ANALYTICS HOOK
// =============================================

export const useAnalyticsSummary = () => {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      // Fetch all data sources in parallel
      // Use RPC for claims to get properly calculated totals
      const [policiesRes, inwardRes, claimsRes, mgaMetrics, expenseSetting] = await Promise.all([
        supabase.from('policies').select('*').eq('isDeleted', false),
        supabase.from('inward_reinsurance').select('*').eq('is_deleted', false),
        supabase.rpc('get_claims_with_totals'),
        processMGAData(),
        DB.getSetting('annual_operating_expenses'),
      ]);

      // Handle potential errors gracefully
      const allPolicies = policiesRes.data || [];
      const inwardContracts = inwardRes.data || [];
      const claims = claimsRes.data || [];

      // Separate Direct from Outward policies using recordType (preserved from DB)
      const directPolicies = allPolicies.filter((p: any) => p.recordType === 'Direct');
      const outwardPolicies = allPolicies.filter((p: any) => p.recordType && p.recordType !== 'Direct');

      // Process each channel
      // Direct: Mosaic issues policies to clients (REVENUE)
      const directMetrics = processDirectPolicies(directPolicies);

      // Inward: Mosaic accepts risks from other insurers (REVENUE)
      const inwardForeignMetrics = processInwardReinsurance(
        inwardContracts.filter((c: any) => c.origin === 'FOREIGN'),
        'inward-foreign'
      );
      const inwardDomesticMetrics = processInwardReinsurance(
        inwardContracts.filter((c: any) => c.origin === 'DOMESTIC'),
        'inward-domestic'
      );

      // Outward: Mosaic cedes risks to reinsurers (COST)
      const outwardMetrics = processOutwardPolicies(outwardPolicies);

      // Calculate totals with correct NWP (Revenue - Cost)
      const channels = [directMetrics, inwardForeignMetrics, inwardDomesticMetrics, outwardMetrics];
      const totalMetrics = calculateTotalMetrics(channels, outwardMetrics);

      // Process claims using RPC data (already has Mosaic's share calculated)
      const claimsMetrics = processClaimsMetrics(claims, totalMetrics.netWrittenPremium, totalMetrics.grossPremiumEarned);

      // Loss ratio by class (from all policies + claims)
      const lossRatioByClass = calculateLossRatioByClass(allPolicies, claims);

      // Calculate expense ratio from operating expenses setting
      const operatingExpenses = Number(expenseSetting) || 0;
      const expenseRatio = totalMetrics.netPremiumEarned > 0
        ? (operatingExpenses / totalMetrics.netPremiumEarned) * 100 : 0;
      const fullCombinedRatio = claimsMetrics.lossRatio + totalMetrics.commissionRatio + expenseRatio;

      setData({
        channels,
        total: totalMetrics,
        claims: claimsMetrics,
        mga: mgaMetrics,
        lossRatioByClass,
        recentActivity: [],
        operatingExpenses,
        expenseRatio,
        fullCombinedRatio,
      });
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, error, refetch: fetchAnalytics };
};

// =============================================
// DATA PROCESSORS
// =============================================

/**
 * Process Direct Insurance policies.
 * Multiple rows per policyNumber = premium INSTALLMENTS → SUM premiums.
 * sumInsured, ourShare = same value repeated → take ONCE per policyNumber.
 */
function processDirectPolicies(policies: any[]): ChannelMetrics {
  const metrics = createEmptyChannelMetrics('direct');
  const monthlyData: Record<string, { gwp: number; nwp: number; gpe: number; npe: number; count: number }> = {};
  const cedantData: Record<string, { premium: number; count: number }> = {};

  // Group by policyNumber first (multiple rows = installments)
  const policyGroups = new Map<string, any[]>();
  policies.forEach(p => {
    const key = p.policyNumber || p.id;
    if (!policyGroups.has(key)) policyGroups.set(key, []);
    policyGroups.get(key)!.push(p);
  });

  metrics.recordCount = policyGroups.size; // Count UNIQUE policies, not rows

  policyGroups.forEach((installments, _policyNumber) => {
    const first = installments[0]; // Use first row for non-additive fields

    // Status from first row
    const status = normalizeStatus(first.status);
    if (status === 'active') metrics.activeCount++;
    else if (status === 'pending') metrics.pendingCount++;
    else metrics.cancelledCount++;

    // Currency info from first row
    const currency = first.currency || 'USD';
    const exchangeRate = Number(first.exchangeRate) || Number(first.exchange_rate) || 0;
    // Normalize commission: if stored as decimal (0.30 = 30%), convert to percentage
    const rawCommission = Number(first.commissionPercent) || Number(first.commission_percent) || 0;
    const commissionPct = rawCommission <= 1 ? rawCommission * 100 : rawCommission;

    // Currency conversion helper - ONLY convert based on actual currency field
    // Note: exchangeRate stores UZS/USD rate for ALL records regardless of currency
    const toUSD = (amount: number): number => {
      if (!amount || amount === 0) return 0;
      if (currency === 'UZS') {
        return exchangeRate > 0 ? amount / exchangeRate : amount / 12800;
      } else if (currency?.startsWith('EUR')) {
        return amount * 1.08;
      } else if (currency === 'RUB') {
        return amount / 90;
      } else if (currency === 'KZT') {
        return amount / 470;
      } else if (currency === 'TWD') {
        return amount / 32;
      } else if (currency === 'PGK') {
        return amount / 3.8;
      }
      return amount; // USD and others
    };

    // SUM premiums across installments (each row is a payment)
    const totalGWP = installments.reduce((sum, p) =>
      sum + (Number(p.grossPremium) || Number(p.gross_premium_original) || 0), 0);
    const gwpUSD = toUSD(totalGWP);
    const nwpUSD = gwpUSD * (1 - commissionPct / 100);

    // Take ONCE: sum insured, ourShare (from first row)
    const limitOriginal = Number(first.limitForeignCurrency) || Number(first.limit_foreign_currency) || Number(first.sumInsured) || 0;
    const limitUSD = toUSD(limitOriginal);

    // Normalize ourShare (some records store as decimal, e.g., 0.05 = 5%)
    let ourShare = Number(first.ourShare) || Number(first.our_share) || 100;
    ourShare = normalizeOurShare(ourShare);

    const classOfIns = first.classOfInsurance || first.class_of_insurance || 'Other';
    const insuredName = first.insuredName || first.insured_name || 'Unknown';
    const inceptionDate = first.inceptionDate || first.inception_date;
    const expiryDate = first.expiryDate || first.expiry_date;

    // Earned premium calculation
    const earnedFraction = calculateEarnedFraction(inceptionDate, expiryDate);

    // Use USD-converted amounts for aggregate totals
    metrics.grossWrittenPremium += gwpUSD;
    metrics.netWrittenPremium += nwpUSD;
    metrics.grossPremiumEarned += gwpUSD * earnedFraction;
    metrics.netPremiumEarned += nwpUSD * earnedFraction;
    metrics.unearnedPremiumReserve += gwpUSD * (1 - earnedFraction);
    metrics.commission += (gwpUSD * commissionPct / 100);
    metrics.totalLimit += limitUSD;
    metrics.avgOurShare += ourShare;

    // Currency breakdown - store USD amounts for consistency
    if (!metrics.currencyBreakdown[currency]) {
      metrics.currencyBreakdown[currency] = { count: 0, premium: 0 };
    }
    metrics.currencyBreakdown[currency].count++;
    metrics.currencyBreakdown[currency].premium += gwpUSD;

    // Class breakdown - use USD for consistency
    if (!metrics.classBreakdown[classOfIns]) {
      metrics.classBreakdown[classOfIns] = { count: 0, premium: 0 };
    }
    metrics.classBreakdown[classOfIns].count++;
    metrics.classBreakdown[classOfIns].premium += gwpUSD;

    // Monthly trend - use USD
    const monthKey = getMonthKey(inceptionDate);
    if (monthKey) {
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { gwp: 0, nwp: 0, gpe: 0, npe: 0, count: 0 };
      }
      monthlyData[monthKey].gwp += gwpUSD;
      monthlyData[monthKey].nwp += nwpUSD;
      monthlyData[monthKey].gpe += gwpUSD * earnedFraction;
      monthlyData[monthKey].npe += nwpUSD * earnedFraction;
      monthlyData[monthKey].count++;
    }

    // Top cedants/insureds - use USD
    if (!cedantData[insuredName]) {
      cedantData[insuredName] = { premium: 0, count: 0 };
    }
    cedantData[insuredName].premium += gwpUSD;
    cedantData[insuredName].count++;
  });

  // Finalize metrics
  if (metrics.recordCount > 0) {
    metrics.avgPremium = metrics.grossWrittenPremium / metrics.recordCount;
    metrics.avgOurShare = metrics.avgOurShare / metrics.recordCount;
  }
  metrics.commissionRatio = metrics.grossWrittenPremium > 0
    ? (metrics.commission / metrics.grossWrittenPremium) * 100 : 0;

  // Convert monthly data to array
  metrics.monthlyTrend = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, val]) => ({ month: getMonthLabel(key), ...val }));

  // Top cedants
  metrics.topCedants = Object.entries(cedantData)
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.premium - a.premium)
    .slice(0, 10);

  return metrics;
}

/**
 * Process Inward Reinsurance contracts.
 * Multiple rows per contract_number = premium INSTALLMENTS → SUM premiums.
 * limit_of_liability, our_share = same value repeated → take ONCE per contract.
 * our_share is DECIMAL (0.005 = 0.5%).
 */
function processInwardReinsurance(contracts: any[], channel: 'inward-foreign' | 'inward-domestic'): ChannelMetrics {
  const metrics = createEmptyChannelMetrics(channel);
  const monthlyData: Record<string, { gwp: number; nwp: number; gpe: number; npe: number; count: number }> = {};
  const cedantData: Record<string, { premium: number; count: number }> = {};

  // Group by contract_number first (multiple rows = installments)
  const contractGroups = new Map<string, any[]>();
  contracts.forEach(c => {
    const key = c.contract_number || c.id;
    if (!contractGroups.has(key)) contractGroups.set(key, []);
    contractGroups.get(key)!.push(c);
  });

  metrics.recordCount = contractGroups.size; // Count UNIQUE contracts, not rows

  contractGroups.forEach((installments, _contractNumber) => {
    const first = installments[0]; // Use first row for non-additive fields

    const status = normalizeStatus(first.status);
    if (status === 'active') metrics.activeCount++;
    else if (status === 'pending') metrics.pendingCount++;
    else metrics.cancelledCount++;

    const currency = first.currency || 'USD';
    const exchangeRate = Number(first.exchange_rate) || 1;
    // commission_percent stored as decimal: 0.30 = 30%, 0.25 = 25%
    const rawCommission = Number(first.commission_percent) || 0;
    const commissionPct = rawCommission <= 1 ? rawCommission * 100 : rawCommission;

    // Currency conversion helper - ONLY convert based on actual currency field
    const toUSD = (amount: number): number => {
      if (!amount || amount === 0) return 0;
      if (currency === 'UZS') {
        return exchangeRate > 1 ? amount / exchangeRate : amount / 12800;
      } else if (currency?.startsWith('EUR')) {
        return amount * 1.08;
      } else if (currency === 'RUB') {
        return amount / 90;
      } else if (currency === 'KZT') {
        return amount / 470;
      } else if (currency === 'TWD') {
        return amount / 32;
      } else if (currency === 'PGK') {
        return amount / 3.8;
      }
      return amount; // USD and others
    };

    // SUM premiums across installments
    const totalGWP = installments.reduce((sum, c) =>
      sum + (Number(c.gross_premium) || 0), 0);
    const gwpUSD = toUSD(totalGWP);
    const nwpUSD = gwpUSD * (1 - commissionPct / 100);

    // our_share: DECIMAL (0.005 = 0.5%). Take from first row.
    let ourShare = Number(first.our_share) || 0;
    // Convert to percentage for display
    let ourSharePct = ourShare <= 1 ? ourShare * 100 : ourShare;

    // Take ONCE: limit of liability
    const limit = Number(first.limit_of_liability) || 0;
    const limitUSD = toUSD(limit);
    const classOfCover = first.class_of_cover || 'Other';
    const cedantName = first.cedant_name || 'Unknown';
    const inceptionDate = first.inception_date;
    const expiryDate = first.expiry_date;

    // Earned premium calculation
    const earnedFraction = calculateEarnedFraction(inceptionDate, expiryDate);

    // Use USD-converted amounts for aggregate totals
    metrics.grossWrittenPremium += gwpUSD;
    metrics.netWrittenPremium += nwpUSD;
    metrics.grossPremiumEarned += gwpUSD * earnedFraction;
    metrics.netPremiumEarned += nwpUSD * earnedFraction;
    metrics.unearnedPremiumReserve += gwpUSD * (1 - earnedFraction);
    metrics.commission += (gwpUSD * commissionPct / 100);
    metrics.totalLimit += limitUSD;
    metrics.avgOurShare += ourSharePct;

    // Currency breakdown - store USD amounts for consistency
    if (!metrics.currencyBreakdown[currency]) {
      metrics.currencyBreakdown[currency] = { count: 0, premium: 0 };
    }
    metrics.currencyBreakdown[currency].count++;
    metrics.currencyBreakdown[currency].premium += gwpUSD;

    // Class breakdown - use USD for consistency
    if (!metrics.classBreakdown[classOfCover]) {
      metrics.classBreakdown[classOfCover] = { count: 0, premium: 0 };
    }
    metrics.classBreakdown[classOfCover].count++;
    metrics.classBreakdown[classOfCover].premium += gwpUSD;

    // Monthly trend - use USD
    const monthKey = getMonthKey(inceptionDate);
    if (monthKey) {
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { gwp: 0, nwp: 0, gpe: 0, npe: 0, count: 0 };
      }
      monthlyData[monthKey].gwp += gwpUSD;
      monthlyData[monthKey].nwp += nwpUSD;
      monthlyData[monthKey].gpe += gwpUSD * earnedFraction;
      monthlyData[monthKey].npe += nwpUSD * earnedFraction;
      monthlyData[monthKey].count++;
    }

    // Top cedants - use USD
    if (!cedantData[cedantName]) {
      cedantData[cedantName] = { premium: 0, count: 0 };
    }
    cedantData[cedantName].premium += gwpUSD;
    cedantData[cedantName].count++;
  });

  // Finalize metrics
  if (metrics.recordCount > 0) {
    metrics.avgPremium = metrics.grossWrittenPremium / metrics.recordCount;
    metrics.avgOurShare = metrics.avgOurShare / metrics.recordCount;
  }
  metrics.commissionRatio = metrics.grossWrittenPremium > 0
    ? (metrics.commission / metrics.grossWrittenPremium) * 100 : 0;

  // Convert monthly data to array
  metrics.monthlyTrend = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, val]) => ({ month: getMonthLabel(key), ...val }));

  // Top cedants
  metrics.topCedants = Object.entries(cedantData)
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.premium - a.premium)
    .slice(0, 10);

  return metrics;
}

/**
 * Process Outward Reinsurance policies (Mosaic cedes risks to reinsurers).
 * Multiple rows per policyNumber = DIFFERENT REINSURERS (not installments).
 * Each row has a different reinsurerName and slipNumber.
 * grossPremium = SAME original premium repeated → take ONCE per policyNumber.
 * cededPremiumForeign = what EACH reinsurer receives → SUM these (total ceded).
 * cededShare = each reinsurer's share → SUM per policyNumber = total % ceded.
 */
function processOutwardPolicies(policies: any[]): ChannelMetrics {
  const metrics = createEmptyChannelMetrics('outward');
  const monthlyData: Record<string, { gwp: number; nwp: number; gpe: number; npe: number; count: number }> = {};
  const reinsurerData: Record<string, { premium: number; count: number }> = {};

  // Group by policyNumber (each row is a different reinsurer, not installment)
  const policyGroups = new Map<string, any[]>();
  policies.forEach(p => {
    const key = p.policyNumber || p.id;
    if (!policyGroups.has(key)) policyGroups.set(key, []);
    policyGroups.get(key)!.push(p);
  });

  metrics.recordCount = policyGroups.size; // Unique policies, not rows

  policyGroups.forEach((reinsurers, _policyNumber) => {
    const first = reinsurers[0];

    const status = normalizeStatus(first.status);
    if (status === 'active') metrics.activeCount++;
    else if (status === 'pending') metrics.pendingCount++;
    else metrics.cancelledCount++;

    const currency = first.currency || 'USD';
    const exchangeRate = Number(first.exchangeRate) || Number(first.exchange_rate) || 0;

    // Currency conversion helper - ONLY convert based on actual currency field
    const toUSD = (amount: number): number => {
      if (!amount || amount === 0) return 0;
      if (currency === 'UZS') {
        return exchangeRate > 0 ? amount / exchangeRate : amount / 12800;
      } else if (currency?.startsWith('EUR')) {
        return amount * 1.08;
      } else if (currency === 'RUB') {
        return amount / 90;
      }
      return amount; // USD and others
    };

    // SUM cededPremiumForeign across all reinsurers (each gets their share)
    const totalCeded = reinsurers.reduce((sum, p) =>
      sum + (Number(p.cededPremiumForeign) || Number(p.ceded_premium_foreign) || 0), 0);
    const cededUSD = toUSD(totalCeded);

    // grossPremium = original premium, take ONCE (for reference, not for GWP calculation)
    // For outward, GWP represents ceded premium
    const _originalGWP = toUSD(Number(first.grossPremium) || 0);

    // Sum insured take ONCE
    const sumInsured = toUSD(Number(first.sumInsured) || Number(first.limitForeignCurrency) || 0);

    // Total ceded share = sum of individual reinsurer shares
    const totalCededShare = reinsurers.reduce((sum, p) =>
      sum + (Number(p.cededShare) || Number(p.ceded_share) || 0), 0);
    const mosaicRetention = Math.max(0, 1 - totalCededShare) * 100; // as percentage

    const classOfIns = first.classOfInsurance || first.class_of_insurance || 'Other';
    const insuredName = first.insuredName || first.insured_name || 'Unknown';
    const inceptionDate = first.inceptionDate || first.inception_date;
    const expiryDate = first.expiryDate || first.expiry_date;

    // Earned premium calculation
    const earnedFraction = calculateEarnedFraction(inceptionDate, expiryDate);

    // For outward, GWP = what's ceded (this is the cost)
    metrics.grossWrittenPremium += cededUSD;
    metrics.netWrittenPremium += cededUSD; // Same for outward since it's all ceded
    metrics.grossPremiumEarned += cededUSD * earnedFraction;
    metrics.netPremiumEarned += cededUSD * earnedFraction;
    metrics.unearnedPremiumReserve += cededUSD * (1 - earnedFraction);
    metrics.totalLimit += sumInsured;
    metrics.avgOurShare += mosaicRetention;

    // Currency breakdown - store USD amounts
    if (!metrics.currencyBreakdown[currency]) {
      metrics.currencyBreakdown[currency] = { count: 0, premium: 0 };
    }
    metrics.currencyBreakdown[currency].count++;
    metrics.currencyBreakdown[currency].premium += cededUSD;

    // Class breakdown - use USD for consistency
    if (!metrics.classBreakdown[classOfIns]) {
      metrics.classBreakdown[classOfIns] = { count: 0, premium: 0 };
    }
    metrics.classBreakdown[classOfIns].count++;
    metrics.classBreakdown[classOfIns].premium += cededUSD;

    // Monthly trend - use USD
    const monthKey = getMonthKey(inceptionDate);
    if (monthKey) {
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { gwp: 0, nwp: 0, gpe: 0, npe: 0, count: 0 };
      }
      monthlyData[monthKey].gwp += cededUSD;
      monthlyData[monthKey].nwp += cededUSD;
      monthlyData[monthKey].gpe += cededUSD * earnedFraction;
      monthlyData[monthKey].npe += cededUSD * earnedFraction;
      monthlyData[monthKey].count++;
    }

    // Track by reinsurer (top cedants = top reinsurers for outward)
    reinsurers.forEach(r => {
      const name = r.reinsurerName || r.reinsurer_name || 'Unknown';
      if (name && name !== 'Unknown') {
        if (!reinsurerData[name]) {
          reinsurerData[name] = { premium: 0, count: 0 };
        }
        const reinsuredAmount = toUSD(Number(r.cededPremiumForeign) || Number(r.ceded_premium_foreign) || 0);
        reinsurerData[name].premium += reinsuredAmount;
        reinsurerData[name].count++;
      }
    });

    // Also track the insured name at policy level
    if (insuredName && insuredName !== 'Unknown') {
      if (!reinsurerData[insuredName]) {
        reinsurerData[insuredName] = { premium: 0, count: 0 };
      }
    }
  });

  // Finalize metrics
  if (metrics.recordCount > 0) {
    metrics.avgPremium = metrics.grossWrittenPremium / metrics.recordCount;
    metrics.avgOurShare = metrics.avgOurShare / metrics.recordCount;
  }
  metrics.commissionRatio = metrics.grossWrittenPremium > 0
    ? (metrics.commission / metrics.grossWrittenPremium) * 100 : 0;

  // Convert monthly data to array
  metrics.monthlyTrend = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, val]) => ({ month: getMonthLabel(key), ...val }));

  // Top reinsurers (displayed as "top cedants" but these are actually reinsurers)
  metrics.topCedants = Object.entries(reinsurerData)
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.premium - a.premium)
    .slice(0, 10);

  return metrics;
}

/**
 * Calculate total metrics across all channels.
 * NWP = Revenue (Direct + Inward) - Cost (Outward cessions)
 * GWP = Sum of all revenue channels (Direct + Inward), Outward shown separately
 */
function calculateTotalMetrics(channels: ChannelMetrics[], outwardMetrics?: ChannelMetrics): ChannelMetrics {
  const total = createEmptyChannelMetrics('total');
  const allMonthlyData: Record<string, { gwp: number; nwp: number; gpe: number; npe: number; count: number }> = {};
  const allCedantData: Record<string, { premium: number; count: number }> = {};

  // Separate revenue channels from cost channel
  const revenueChannels = channels.filter(ch => ch.channel !== 'outward');
  const cededAmount = outwardMetrics?.grossWrittenPremium || 0;

  // Aggregate revenue channels (Direct + Inward)
  revenueChannels.forEach(ch => {
    total.recordCount += ch.recordCount;
    total.activeCount += ch.activeCount;
    total.pendingCount += ch.pendingCount;
    total.cancelledCount += ch.cancelledCount;
    total.grossWrittenPremium += ch.grossWrittenPremium;
    total.grossPremiumEarned += ch.grossPremiumEarned;
    total.netPremiumEarned += ch.netPremiumEarned;
    total.unearnedPremiumReserve += ch.unearnedPremiumReserve;
    total.commission += ch.commission;
    total.totalLimit += ch.totalLimit;

    // Merge currency breakdown
    Object.entries(ch.currencyBreakdown).forEach(([curr, data]) => {
      if (!total.currencyBreakdown[curr]) {
        total.currencyBreakdown[curr] = { count: 0, premium: 0 };
      }
      total.currencyBreakdown[curr].count += data.count;
      total.currencyBreakdown[curr].premium += data.premium;
    });

    // Merge class breakdown
    Object.entries(ch.classBreakdown).forEach(([cls, data]) => {
      if (!total.classBreakdown[cls]) {
        total.classBreakdown[cls] = { count: 0, premium: 0 };
      }
      total.classBreakdown[cls].count += data.count;
      total.classBreakdown[cls].premium += data.premium;
    });

    // Merge monthly trend
    ch.monthlyTrend.forEach(m => {
      if (!allMonthlyData[m.month]) {
        allMonthlyData[m.month] = { gwp: 0, nwp: 0, gpe: 0, npe: 0, count: 0 };
      }
      allMonthlyData[m.month].gwp += m.gwp;
      allMonthlyData[m.month].nwp += m.nwp;
      allMonthlyData[m.month].gpe += m.gpe;
      allMonthlyData[m.month].npe += m.npe;
      allMonthlyData[m.month].count += m.count;
    });

    // Merge top cedants
    ch.topCedants.forEach(c => {
      if (!allCedantData[c.name]) {
        allCedantData[c.name] = { premium: 0, count: 0 };
      }
      allCedantData[c.name].premium += c.premium;
      allCedantData[c.name].count += c.count;
    });
  });

  // NWP = Revenue (GWP from Direct + Inward) - Cost (Ceded to reinsurers)
  total.netWrittenPremium = total.grossWrittenPremium - cededAmount;

  // Calculate averages
  if (total.recordCount > 0) {
    total.avgPremium = total.grossWrittenPremium / total.recordCount;
    const totalOurShare = revenueChannels.reduce((sum, ch) => sum + (ch.avgOurShare * ch.recordCount), 0);
    total.avgOurShare = totalOurShare / total.recordCount;
  }
  total.commissionRatio = total.grossWrittenPremium > 0
    ? (total.commission / total.grossWrittenPremium) * 100 : 0;

  // Convert monthly data
  total.monthlyTrend = Object.entries(allMonthlyData)
    .map(([month, val]) => ({ month, ...val }))
    .slice(-12);

  // Top cedants
  total.topCedants = Object.entries(allCedantData)
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.premium - a.premium)
    .slice(0, 10);

  return total;
}

/**
 * Process claims metrics using RPC data.
 * RPC returns total_incurred_our_share and total_paid_our_share which are
 * already calculated as Mosaic's share. Still need currency conversion.
 */
function processClaimsMetrics(claims: any[], totalNWP: number, totalGPE: number = 0): ClaimsMetrics {
  const metrics: ClaimsMetrics = {
    totalClaims: claims.length,
    openClaims: 0,
    closedClaims: 0,
    totalIncurred: 0,
    totalPaid: 0,
    totalReserve: 0,
    avgClaimSize: 0,
    lossRatio: 0,
  };

  claims.forEach(c => {
    const status = c.status?.toLowerCase() || '';
    if (status === 'open' || status === 'notified') {
      metrics.openClaims++;
    } else if (status === 'closed' || status === 'settled') {
      metrics.closedClaims++;
    }

    // RPC returns total_incurred_our_share and total_paid_our_share
    // These are already Mosaic's share, but may need currency conversion
    const incurred = Number(c.total_incurred_our_share) || Number(c.imported_total_incurred) || 0;
    const paid = Number(c.total_paid_our_share) || Number(c.imported_total_paid) || 0;
    const currency = c.currency || 'USD';

    // Convert to USD
    let incurredUSD = incurred;
    let paidUSD = paid;
    if (currency === 'UZS') {
      incurredUSD = incurred / 12800;  // approximate UZS/USD rate
      paidUSD = paid / 12800;
    } else if (currency === 'EUR') {
      incurredUSD = incurred * 1.08;  // approximate EUR/USD rate
      paidUSD = paid * 1.08;
    }

    metrics.totalIncurred += incurredUSD;
    metrics.totalPaid += paidUSD;
  });

  metrics.totalReserve = metrics.totalIncurred - metrics.totalPaid;
  metrics.avgClaimSize = metrics.totalClaims > 0 ? metrics.totalIncurred / metrics.totalClaims : 0;
  // Use Gross Premium Earned for loss ratio; fall back to NWP if GPE not available
  const lossRatioDenominator = totalGPE > 0 ? totalGPE : totalNWP;
  metrics.lossRatio = lossRatioDenominator > 0 ? (metrics.totalIncurred / lossRatioDenominator) * 100 : 0;

  return metrics;
}

function calculateLossRatioByClass(policies: any[], claims: any[]): LossRatioData[] {
  const classData: Record<string, { premium: number; losses: number; claimCount: number }> = {};

  // Aggregate premium by class (converting to USD for consistency)
  policies.forEach(p => {
    const cls = p.classOfInsurance || p.class_of_insurance || 'Other';
    const currency = p.currency || 'USD';
    const exchangeRate = Number(p.exchangeRate) || Number(p.exchange_rate) || 1;
    // Normalize commission: if stored as decimal (0.30 = 30%), convert to percentage
    const rawCommission = Number(p.commissionPercent) || Number(p.commission_percent) || 0;
    const commissionPct = rawCommission <= 1 ? rawCommission * 100 : rawCommission;

    // Get NWP or derive from GWP and commission
    const gwpOriginal = Number(p.grossPremium) || Number(p.gross_premium_original) || 0;
    const nwpOriginal = Number(p.netPremium) || Number(p.net_premium_original);
    const gwpUSD = convertToUSD(gwpOriginal, currency, exchangeRate);
    const nwpUSD = nwpOriginal
      ? convertToUSD(nwpOriginal, currency, exchangeRate)
      : gwpUSD * (1 - commissionPct / 100);

    if (!classData[cls]) {
      classData[cls] = { premium: 0, losses: 0, claimCount: 0 };
    }
    classData[cls].premium += nwpUSD;
  });

  // Aggregate claims by class (via policy_id lookup)
  const policyMap = new Map(policies.map(p => [p.id, p]));
  claims.forEach(c => {
    const policy = policyMap.get(c.policy_id);
    if (policy) {
      const cls = policy.classOfInsurance || policy.class_of_insurance || 'Other';
      if (classData[cls]) {
        // Use RPC fields (total_incurred_our_share) or fallback to imported_total_incurred
        const incurred = Number(c.total_incurred_our_share) || Number(c.imported_total_incurred) || 0;
        const currency = c.currency || 'USD';

        // Convert to USD
        let incurredUSD = incurred;
        if (currency === 'UZS') {
          incurredUSD = incurred / 12800;  // approximate UZS/USD rate
        } else if (currency === 'EUR') {
          incurredUSD = incurred * 1.08;  // approximate EUR/USD rate
        }

        classData[cls].losses += incurredUSD;
        classData[cls].claimCount++;
      }
    }
  });

  return Object.entries(classData)
    .map(([cls, data]) => ({
      class: cls.replace(/^\d+\s*-\s*/, ''),
      earnedPremium: Math.round(data.premium),
      incurredLosses: Math.round(data.losses),
      lossRatio: data.premium > 0 ? Math.round((data.losses / data.premium) * 100) : 0,
      claimCount: data.claimCount,
    }))
    .filter(d => d.earnedPremium > 0)
    .sort((a, b) => b.earnedPremium - a.earnedPremium)
    .slice(0, 10);
}

// =============================================
// MGA / BINDING AUTHORITY PROCESSOR
// =============================================

async function processMGAData(): Promise<MGAMetrics> {
  const empty: MGAMetrics = { agreementCount: 0, totalEpi: 0, actualGwp: 0, utilizationPercent: 0 };

  if (!supabase) return empty;

  try {
    const [agreementsRes, bordereauxRes] = await Promise.all([
      supabase.from('binding_agreements').select('*').eq('is_deleted', false),
      supabase.from('bordereaux_entries').select('agreement_id, total_gwp').eq('is_deleted', false).eq('status', 'ACCEPTED'),
    ]);

    const agreements = agreementsRes.data || [];
    const bordereaux = bordereauxRes.data || [];

    // Only count active agreements for EPI and agreement count
    const activeAgreements = agreements.filter((a: any) => a.status === 'ACTIVE');
    const agreementCount = activeAgreements.length;
    const totalEpi = activeAgreements.reduce((sum: number, a: any) => sum + (Number(a.epi) || 0), 0);

    // Sum GWP from all accepted bordereaux (across all agreements)
    const actualGwp = bordereaux.reduce((sum: number, b: any) => sum + (Number(b.total_gwp) || 0), 0);

    const utilizationPercent = totalEpi > 0 ? (actualGwp / totalEpi) * 100 : 0;

    return { agreementCount, totalEpi, actualGwp, utilizationPercent };
  } catch (err) {
    console.error('Failed to process MGA data:', err);
    return empty;
  }
}

// =============================================
// LEGACY HOOKS (for backwards compatibility)
// =============================================

export interface KPIData {
  grossWrittenPremium: number;
  netWrittenPremium: number;
  activePolicies: number;
  openClaims: number;
  lossRatio: number;
  avgPremium: number;
}

export interface PremiumTrendData {
  month: string;
  gwp: number;
  nwp: number;
}

export interface LossRatioByClassData {
  class: string;
  earnedPremium: number;
  incurredLosses: number;
  lossRatio: number;
}

export interface TopCedantData {
  name: string;
  premium: number;
  policies: number;
}

export interface RecentClaimData {
  id: string;
  claimNumber: string;
  insuredName: string;
  lossDate: string;
  incurred: number;
  status: string;
}

export const useKPISummary = () => {
  const { data, loading, error } = useAnalyticsSummary();

  const kpiData: KPIData | null = data ? {
    grossWrittenPremium: data.total.grossWrittenPremium,
    netWrittenPremium: data.total.netWrittenPremium,
    activePolicies: data.total.activeCount,
    openClaims: data.claims.openClaims,
    lossRatio: Math.round(data.claims.lossRatio * 10) / 10,
    avgPremium: Math.round(data.total.avgPremium),
  } : null;

  return { data: kpiData, loading, error };
};

export const usePremiumTrend = () => {
  const { data, loading } = useAnalyticsSummary();
  const trendData: PremiumTrendData[] = data?.total.monthlyTrend.map(m => ({
    month: m.month,
    gwp: Math.round(m.gwp),
    nwp: Math.round(m.nwp),
  })) || [];
  return { data: trendData, loading };
};

export const useLossRatioByClass = () => {
  const { data, loading } = useAnalyticsSummary();
  return { data: data?.lossRatioByClass || [], loading };
};

export const useTopCedants = (limit: number = 10) => {
  const { data, loading } = useAnalyticsSummary();
  const topData: TopCedantData[] = data?.total.topCedants.slice(0, limit).map(c => ({
    name: c.name,
    premium: c.premium,
    policies: c.count,
  })) || [];
  return { data: topData, loading };
};

export const useRecentClaims = (limit: number = 10) => {
  const [data, setData] = useState<RecentClaimData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!supabase) {
          setData([]);
          setLoading(false);
          return;
        }

        const { data: claims } = await supabase
          .from('claims')
          .select('id, claim_number, claimant_name, loss_date, imported_total_incurred, status')
          .order('imported_total_incurred', { ascending: false, nullsFirst: false })
          .limit(limit);

        const result = claims?.map(c => ({
          id: c.id,
          claimNumber: c.claim_number,
          insuredName: c.claimant_name || 'Unknown',
          lossDate: c.loss_date,
          incurred: c.imported_total_incurred || 0,
          status: c.status,
        })) || [];

        setData(result);
      } catch (err) {
        console.error('Failed to fetch recent claims:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [limit]);

  return { data, loading };
};
