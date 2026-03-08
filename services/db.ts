import { Policy, Clause, ReinsuranceSlip, PolicyTemplate, User, DEFAULT_PERMISSIONS, LegalEntity, EntityLog, PolicyStatus, ExchangeRate, Currency, InwardReinsurance, BindingAgreement, BordereauxEntry } from '../types';
import { supabase } from './supabase';
import { AuthService } from './auth';

// Local storage keys (Fallback for when no API keys are provided)
const POLICIES_KEY = 'insurtech_policies_v2';
const CLAUSES_KEY = 'insurtech_clauses_v2';
const SLIPS_KEY = 'insurtech_slips_v2';
const TEMPLATES_KEY = 'insurtech_templates_v2';
const USERS_KEY = 'insurtech_users_v2';
const ENTITIES_KEY = 'insurtech_legal_entities_v1';
const ENTITY_LOGS_KEY = 'insurtech_entity_logs_v1';
const FX_RATES_KEY = 'insurtech_fx_rates_v1';
const APP_SETTINGS_KEY = 'insurtech_app_settings_db_v1';

// Helper to check connection status
const isSupabaseEnabled = () => {
  return !!supabase;
};

// ... [Existing adapters and helpers omitted for brevity, keeping file structure valid] ...

const toAppPolicy = (dbRecord: any): Policy => {
  // If the record already has 'channel', use it. Otherwise, derive from 'recordType'.
  const derivedChannel = dbRecord.channel || (dbRecord.recordType === 'Inward' ? 'Inward' : 'Direct');
  
  // Map broker info
  const derivedIntermediaryType = dbRecord.intermediaryType || (dbRecord.brokerName ? 'Broker' : 'Direct');
  const derivedIntermediaryName = dbRecord.intermediaryName || dbRecord.brokerName;

  // Handle Reinsurers JSONB
  let reinsurers = [];
  if (dbRecord.reinsurers) {
      reinsurers = typeof dbRecord.reinsurers === 'string' ? JSON.parse(dbRecord.reinsurers) : dbRecord.reinsurers;
  }

  return {
    ...dbRecord,
    channel: derivedChannel,
    intermediaryType: derivedIntermediaryType,
    intermediaryName: derivedIntermediaryName,
    reinsurers: reinsurers,
    
    // Ensure numeric values are numbers
    sumInsured: Number(dbRecord.sumInsured || 0),
    grossPremium: Number(dbRecord.grossPremium || 0),
    ourShare: Number(dbRecord.ourShare || 100),
    
    // Extended Financials
    sumInsuredNational: Number(dbRecord.sumInsuredNational || 0),
    limitForeignCurrency: Number(dbRecord.limitForeignCurrency || 0),
    limitNationalCurrency: Number(dbRecord.limitNationalCurrency || 0),
    excessForeignCurrency: Number(dbRecord.excessForeignCurrency || 0),
    prioritySum: Number(dbRecord.prioritySum || 0),
    
    premiumRate: Number(dbRecord.premiumRate || 0),
    premiumNationalCurrency: Number(dbRecord.premiumNationalCurrency || 0),
    exchangeRate: Number(dbRecord.exchangeRate || 1),
    equivalentUSD: Number(dbRecord.equivalentUSD || 0),
    
    // Reinsurance / Treaty
    cededShare: Number(dbRecord.cededShare || 0),
    cededPremiumForeign: Number(dbRecord.cededPremiumForeign || 0),
    reinsuranceCommission: Number(dbRecord.reinsuranceCommission || 0),
    netReinsurancePremium: Number(dbRecord.netReinsurancePremium || 0),
    
    sumReinsuredForeign: Number(dbRecord.sumReinsuredForeign || 0),
    sumReinsuredNational: Number(dbRecord.sumReinsuredNational || 0),
    receivedPremiumForeign: Number(dbRecord.receivedPremiumForeign || 0),
    receivedPremiumNational: Number(dbRecord.receivedPremiumNational || 0),
    
    treatyPremium: Number(dbRecord.treatyPremium || 0),
    aicCommission: Number(dbRecord.aicCommission || 0),
    aicRetention: Number(dbRecord.aicRetention || 0),
    aicPremium: Number(dbRecord.aicPremium || 0),
    maxRetentionPerRisk: Number(dbRecord.maxRetentionPerRisk || 0),

    netPremium: Number(dbRecord.netPremium || 0),
    commissionPercent: Number(dbRecord.commissionPercent || 0),
    taxPercent: Number(dbRecord.taxPercent || 0),

    warrantyPeriod: Number(dbRecord.warrantyPeriod || 0),
    numberOfSlips: Number(dbRecord.numberOfSlips || 0),

    // New Excel Portfolio Fields
    exchangeRateUSD: Number(dbRecord.exchangeRateUSD || 0),
    insuranceDays: Number(dbRecord.insuranceDays || 0),
    reinsuranceDays: Number(dbRecord.reinsuranceDays || 0),
    fullPremiumForeign: Number(dbRecord.fullPremiumForeign || 0),
    fullPremiumNational: Number(dbRecord.fullPremiumNational || 0),
    grossPremiumNational: Number(dbRecord.grossPremiumNational || 0),
    commissionNational: Number(dbRecord.commissionNational || 0),
    netPremiumNational: Number(dbRecord.netPremiumNational || 0),
    receivedPremiumExchangeRate: Number(dbRecord.receivedPremiumExchangeRate || 0),
    risksCount: Number(dbRecord.risksCount || 0),
    retroSumReinsured: Number(dbRecord.retroSumReinsured || 0),
    retroPremium: Number(dbRecord.retroPremium || 0),

  } as Policy;
};

// Map raw DB row to ReinsuranceSlip, handling both camelCase and snake_case column names.
// NOTE: Legacy CSV import has shifted columns (insuredName has numeric ID,
// brokerReinsurer has the actual insured name). The display layer handles the swap
// via isNumericValue() heuristic — this mapper preserves raw values as strings.
const toAppSlip = (row: any): ReinsuranceSlip => {
  const slipNum = row.slipNumber ?? row.slip_number ?? '';
  const insured = row.insuredName ?? row.insured_name ?? '';
  const broker = row.brokerReinsurer ?? row.broker_reinsurer ?? '';
  const limit = row.limitOfLiability ?? row.limit_of_liability ?? 0;
  const deleted = row.isDeleted ?? row.is_deleted ?? false;

  return {
    id: row.id,
    slipNumber: String(slipNum ?? ''),
    date: row.date || '',
    insuredName: String(insured ?? ''),
    brokerReinsurer: String(broker ?? ''),
    reinsurers: row.reinsurers || [],
    currency: row.currency,
    limitOfLiability: Number(limit || 0),
    status: row.status,
    isDeleted: Boolean(deleted),
  };
};

const toDbPolicy = (policy: Policy): any => {
  // 1. Create a clone to avoid mutating the app state
  const payload: any = { ...policy };

  // 2. Map new architecture fields to Legacy DB Schema columns
  payload.recordType = policy.channel; 
  payload.brokerName = policy.intermediaryName;

  // 3. Sanitize Payload
  delete payload.channel;
  delete payload.intermediaryType;
  delete payload.intermediaryName;

  // 4. Ensure numeric fields are safe
  const numericFields = [
      'sumInsured', 'grossPremium', 'ourShare', 'sumInsuredNational',
      'limitForeignCurrency', 'limitNationalCurrency', 'excessForeignCurrency', 'prioritySum',
      'premiumRate', 'premiumNationalCurrency', 'exchangeRate', 'equivalentUSD',
      'cededShare', 'cededPremiumForeign', 'reinsuranceCommission', 'netReinsurancePremium',
      'sumReinsuredForeign', 'sumReinsuredNational', 'receivedPremiumForeign', 'receivedPremiumNational',
      'treatyPremium', 'aicCommission', 'aicRetention', 'aicPremium', 'maxRetentionPerRisk',
      'netPremium', 'commissionPercent', 'taxPercent', 'warrantyPeriod', 'numberOfSlips',
      // New Excel Portfolio Fields
      'exchangeRateUSD', 'insuranceDays', 'reinsuranceDays',
      'fullPremiumForeign', 'fullPremiumNational', 'grossPremiumNational',
      'commissionNational', 'netPremiumNational', 'receivedPremiumExchangeRate',
      'risksCount', 'retroSumReinsured', 'retroPremium'
  ];

  numericFields.forEach(field => {
      payload[field] = policy[field as keyof Policy] || 0;
  });

  // 5. Explicitly map string fields for new Excel Portfolio columns
  const stringFields = [
      'accountingCode', 'referenceLink', 'reinsuranceType',
      'premiumPaymentDate', 'receivedPremiumCurrency', 'actualPaymentDate'
  ];
  stringFields.forEach(field => {
      payload[field] = policy[field as keyof Policy] || null;
  });

  return payload;
};

// Development seed users - credentials from environment variables only
export const SEED_USERS: User[] = (() => {
  // Only enable seed users in development with explicit env var
  if (import.meta.env.VITE_ENABLE_DEV_LOGIN !== 'true') {
    return [];
  }

  const devEmail = import.meta.env.VITE_DEV_ADMIN_EMAIL;
  const devPassword = import.meta.env.VITE_DEV_ADMIN_PASSWORD;

  if (!devEmail || !devPassword) {
    console.warn('Dev login enabled but credentials not set in environment');
    return [];
  }

  return [{
    id: 'dev_admin_001',
    email: devEmail,
    password: devPassword,
    name: 'Development Admin',
    role: 'Super Admin' as const,
    avatarUrl: 'DA',
    lastLogin: new Date().toISOString(),
    permissions: DEFAULT_PERMISSIONS['Super Admin']
  }];
})();

const getLocal = <T>(key: string, seed: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(stored);
};

// Helper for Logs
const createLog = async (entityId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', changes: any) => {
    const user = await AuthService.getSession();
    const log: EntityLog = {
        id: crypto.randomUUID(),
        entityId,
        userId: user?.id || 'system',
        userName: user?.name || 'System',
        action,
        changes: JSON.stringify(changes),
        timestamp: new Date().toISOString()
    };

    if (isSupabaseEnabled()) {
        await supabase!.from('entity_logs').insert(log);
    } else {
        const logs = getLocal<EntityLog[]>(ENTITY_LOGS_KEY, []);
        logs.push(log);
        localStorage.setItem(ENTITY_LOGS_KEY, JSON.stringify(logs));
    }
};

export const DB = {
  // --- Policies ---
  getPolicies: async (): Promise<Policy[]> => {
    if (isSupabaseEnabled()) {
      const { data, error } = await supabase!.from('policies').select('*').order('created_at', { ascending: false }).limit(10000);
      if (error) { console.error("Supabase Error:", error); return []; }
      return (data || []).map(toAppPolicy);
    }
    return getLocal(POLICIES_KEY, []);
  },

  getAllPolicies: async (): Promise<Policy[]> => {
    if (isSupabaseEnabled()) {
      const { data } = await supabase!.from('policies').select('*').limit(10000);
      return (data || []).map(toAppPolicy);
    }
    return getLocal(POLICIES_KEY, []);
  },

  getDirectPolicies: async (): Promise<Policy[]> => {
    if (isSupabaseEnabled()) {
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase!
          .from('policies')
          .select('*')
          .eq('recordType', 'Direct')
          .eq('isDeleted', false)
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);
        if (error) { console.error("Supabase Error:", error); break; }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return allData.map(toAppPolicy);
    }
    return getLocal(POLICIES_KEY, []);
  },

  getOutwardPolicies: async (): Promise<Policy[]> => {
    if (isSupabaseEnabled()) {
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase!
          .from('policies')
          .select('*')
          .neq('recordType', 'Direct')
          .eq('isDeleted', false)
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);
        if (error) { console.error("Supabase Error:", error); break; }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return allData.map(toAppPolicy);
    }
    return getLocal(POLICIES_KEY, []);
  },

  getPolicy: async (id: string): Promise<Policy | undefined> => {
    if (isSupabaseEnabled()) {
      const { data, error } = await supabase!.from('policies').select('*').eq('id', id).single();
      if (error || !data) return undefined;
      return toAppPolicy(data);
    }
    const policies = getLocal(POLICIES_KEY, []);
    return policies.find((p: Policy) => p.id === id);
  },

  savePolicy: async (policy: Policy): Promise<void> => {
    if (isSupabaseEnabled()) {
      const dbPayload = toDbPolicy(policy);
      const { error } = await supabase!.from('policies').upsert(dbPayload);
      if (error) {
          console.error("Save Policy Error", error);
          throw error;
      }
      return;
    }
    const policies = getLocal(POLICIES_KEY, [] as Policy[]);
    const index = policies.findIndex((p: Policy) => p.id === policy.id);
    if (index >= 0) policies[index] = policy;
    else policies.push(policy);
    localStorage.setItem(POLICIES_KEY, JSON.stringify(policies));
  },

  deletePolicy: async (id: string): Promise<void> => {
    if (isSupabaseEnabled()) {
      await supabase!.from('policies').update({ isDeleted: true }).eq('id', id);
      return;
    }
    const policies = getLocal(POLICIES_KEY, [] as Policy[]);
    const policy = policies.find((p: Policy) => p.id === id);
    if (policy) {
        policy.isDeleted = true;
        localStorage.setItem(POLICIES_KEY, JSON.stringify(policies));
    }
  },

  // --- Admin: Policy Management ---
  getDeletedPolicies: async (): Promise<Policy[]> => {
    if (isSupabaseEnabled()) {
      const { data } = await supabase!.from('policies').select('*').eq('isDeleted', true);
      return (data || []).map(toAppPolicy);
    }
    return getLocal(POLICIES_KEY, [] as Policy[]).filter((p: Policy) => p.isDeleted);
  },

  restorePolicy: async (id: string): Promise<void> => {
    if (isSupabaseEnabled()) {
      await supabase!.from('policies').update({ isDeleted: false }).eq('id', id);
      return;
    }
    const policies = getLocal(POLICIES_KEY, [] as Policy[]);
    const policy = policies.find((p: Policy) => p.id === id);
    if (policy) {
        policy.isDeleted = false;
        localStorage.setItem(POLICIES_KEY, JSON.stringify(policies));
    }
  },

  hardDeletePolicy: async (id: string): Promise<void> => {
     if (isSupabaseEnabled()) {
      await supabase!.from('policies').delete().eq('id', id);
      return;
    }
    let policies = getLocal(POLICIES_KEY, [] as Policy[]);
    policies = policies.filter((p: Policy) => p.id !== id);
    localStorage.setItem(POLICIES_KEY, JSON.stringify(policies));
  },

  // --- Clauses ---
  getClauses: async (): Promise<Clause[]> => {
    if (isSupabaseEnabled()) {
      const { data } = await supabase!.from('clauses').select('*');
      return (data as Clause[] || []);
    }
    return getLocal(CLAUSES_KEY, []);
  },

  getAllClauses: async (): Promise<Clause[]> => {
    if (isSupabaseEnabled()) {
      const { data } = await supabase!.from('clauses').select('*');
      return data as Clause[] || [];
    }
    return getLocal(CLAUSES_KEY, []);
  },

  saveClause: async (clause: Clause): Promise<void> => {
    if (isSupabaseEnabled()) {
       await supabase!.from('clauses').upsert(clause);
       return;
    }
    const clauses = getLocal(CLAUSES_KEY, [] as Clause[]);
    const index = clauses.findIndex((c: Clause) => c.id === clause.id);
    if (index >= 0) clauses[index] = clause;
    else clauses.push(clause);
    localStorage.setItem(CLAUSES_KEY, JSON.stringify(clauses));
  },

  deleteClause: async (id: string): Promise<void> => {
    if (isSupabaseEnabled()) {
      await supabase!.from('clauses').update({ isDeleted: true }).eq('id', id);
      return;
    }
    const clauses = getLocal(CLAUSES_KEY, [] as Clause[]);
    const clause = clauses.find((c: Clause) => c.id === id);
    if (clause) {
        clause.isDeleted = true;
        localStorage.setItem(CLAUSES_KEY, JSON.stringify(clauses));
    }
  },

  getDeletedClauses: async (): Promise<Clause[]> => {
    if (isSupabaseEnabled()) {
      const { data } = await supabase!.from('clauses').select('*').eq('isDeleted', true);
      return data as Clause[] || [];
    }
    return getLocal(CLAUSES_KEY, [] as Clause[]).filter((c: Clause) => c.isDeleted);
  },

  restoreClause: async (id: string): Promise<void> => {
    if (isSupabaseEnabled()) {
      await supabase!.from('clauses').update({ isDeleted: false }).eq('id', id);
      return;
    }
    const clauses = getLocal(CLAUSES_KEY, [] as Clause[]);
    const clause = clauses.find((c: Clause) => c.id === id);
    if (clause) {
        clause.isDeleted = false;
        localStorage.setItem(CLAUSES_KEY, JSON.stringify(clauses));
    }
  },

  hardDeleteClause: async (id: string): Promise<void> => {
    if (isSupabaseEnabled()) {
      await supabase!.from('clauses').delete().eq('id', id);
      return;
    }
    let clauses = getLocal(CLAUSES_KEY, [] as Clause[]);
    clauses = clauses.filter((c: Clause) => c.id !== id);
    localStorage.setItem(CLAUSES_KEY, JSON.stringify(clauses));
  },

  // --- Templates ---
  getTemplates: async (): Promise<PolicyTemplate[]> => {
    if (isSupabaseEnabled()) {
      const { data } = await supabase!.from('templates').select('*');
      return (data as PolicyTemplate[] || []);
    }
    return getLocal(TEMPLATES_KEY, []);
  },

  saveTemplate: async (template: PolicyTemplate): Promise<void> => {
    if (isSupabaseEnabled()) {
       await supabase!.from('templates').upsert(template);
       return;
    }
    const templates = getLocal(TEMPLATES_KEY, [] as PolicyTemplate[]);
    const index = templates.findIndex((t: PolicyTemplate) => t.id === template.id);
    if (index >= 0) templates[index] = template;
    else templates.push(template);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  },

  deleteTemplate: async (id: string): Promise<void> => {
    if (isSupabaseEnabled()) {
      await supabase!.from('templates').delete().eq('id', id);
      return;
    }
    let templates = getLocal(TEMPLATES_KEY, [] as PolicyTemplate[]);
    templates = templates.filter((t: PolicyTemplate) => t.id !== id);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  },

  // --- Slips ---
  getSlips: async (): Promise<ReinsuranceSlip[]> => {
    if (isSupabaseEnabled()) {
      const { data } = await supabase!.from('slips').select('*').order('created_at', { ascending: false });
      return (data || []).map(toAppSlip);
    }
    return getLocal(SLIPS_KEY, []);
  },

  getAllSlips: async (): Promise<ReinsuranceSlip[]> => {
    if (isSupabaseEnabled()) {
      const { data } = await supabase!.from('slips').select('*');
      return (data || []).map(toAppSlip);
    }
    return getLocal(SLIPS_KEY, []);
  },

  // --- INWARD REINSURANCE ---
  getAllInwardReinsurance: async (): Promise<InwardReinsurance[]> => {
    if (isSupabaseEnabled()) {
      try {
        const { data, error } = await supabase!
          .from('inward_reinsurance')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10000);

        if (error) {
          // Check if table doesn't exist (migration not run)
          if (error.code === 'PGRST205' || error.code === '42P01' ||
              error.message?.includes('does not exist')) {
            console.warn('Inward Reinsurance table not found - migration may not have been run');
            return [];
          }
          throw error;
        }

        // Map snake_case DB columns to camelCase
        return (data || []).map((row: any) => ({
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
      } catch (err) {
        console.error('Failed to fetch inward reinsurance:', err);
        return [];
      }
    }
    return []; // No localStorage fallback for inward reinsurance
  },

  getSlip: async (id: string): Promise<ReinsuranceSlip | undefined> => {
     if (isSupabaseEnabled()) {
      const { data } = await supabase!.from('slips').select('*').eq('id', id).single();
      return data ? toAppSlip(data) : undefined;
    }
    const slips = getLocal(SLIPS_KEY, [] as ReinsuranceSlip[]);
    return slips.find((s: ReinsuranceSlip) => s.id === id);
  },

  saveSlip: async (slip: ReinsuranceSlip): Promise<void> => {
    if (isSupabaseEnabled()) {
       await supabase!.from('slips').upsert(slip);
       return;
    }
    const slips = getLocal(SLIPS_KEY, [] as ReinsuranceSlip[]);
    const index = slips.findIndex((s: ReinsuranceSlip) => s.id === slip.id);
    if (index >= 0) slips[index] = slip;
    else slips.push(slip);
    localStorage.setItem(SLIPS_KEY, JSON.stringify(slips));
  },

  deleteSlip: async (id: string): Promise<void> => {
    if (isSupabaseEnabled()) {
      // Soft delete
      await supabase!.from('slips').update({ isDeleted: true }).eq('id', id);
      return;
    }
    const slips = getLocal(SLIPS_KEY, [] as ReinsuranceSlip[]);
    const slip = slips.find((s: ReinsuranceSlip) => s.id === id);
    if (slip) {
        slip.isDeleted = true;
        localStorage.setItem(SLIPS_KEY, JSON.stringify(slips));
    }
  },

  getDeletedSlips: async (): Promise<ReinsuranceSlip[]> => {
    if (isSupabaseEnabled()) {
       const { data } = await supabase!.from('slips').select('*').eq('isDeleted', true);
       return data as ReinsuranceSlip[] || [];
    }
    return getLocal(SLIPS_KEY, [] as ReinsuranceSlip[]).filter((s: ReinsuranceSlip) => s.isDeleted);
  },

  restoreSlip: async (id: string): Promise<void> => {
    if (isSupabaseEnabled()) {
       await supabase!.from('slips').update({ isDeleted: false }).eq('id', id);
       return;
    }
    const slips = getLocal(SLIPS_KEY, [] as ReinsuranceSlip[]);
    const slip = slips.find((s: ReinsuranceSlip) => s.id === id);
    if (slip) {
        slip.isDeleted = false;
        localStorage.setItem(SLIPS_KEY, JSON.stringify(slips));
    }
  },

  hardDeleteSlip: async (id: string): Promise<void> => {
    if (isSupabaseEnabled()) {
      await supabase!.from('slips').delete().eq('id', id);
      return;
    }
    let slips = getLocal(SLIPS_KEY, [] as ReinsuranceSlip[]);
    slips = slips.filter((s: ReinsuranceSlip) => s.id !== id);
    localStorage.setItem(SLIPS_KEY, JSON.stringify(slips));
  },

  // --- FX RATES ---

  getExchangeRates: async (): Promise<ExchangeRate[]> => {
      if (isSupabaseEnabled()) {
          const { data } = await supabase!.from('fx_rates').select('*').order('date', { ascending: false });
          return data as ExchangeRate[] || [];
      }
      return getLocal(FX_RATES_KEY, []);
  },

  getLatestExchangeRate: async (currency: string): Promise<number> => {
      if (currency === 'UZS') return 1; // Base
      if (isSupabaseEnabled()) {
          const { data } = await supabase!.from('fx_rates')
            .select('rate')
            .eq('currency', currency)
            .order('date', { ascending: false })
            .limit(1)
            .single();
          return data?.rate || 1;
      }
      const rates = getLocal<ExchangeRate[]>(FX_RATES_KEY, []);
      const rate = rates
        .filter(r => r.currency === currency)
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return rate?.rate || 1;
  },

  getExchangeRatesByDate: async (date: string): Promise<ExchangeRate[]> => {
      if (isSupabaseEnabled()) {
          const { data } = await supabase!.from('fx_rates').select('*').eq('date', date);
          // Map snake_case DB fields to camelCase
          return (data || []).map((r: any) => ({
              id: r.id,
              currency: r.currency,
              rate: r.rate,
              date: r.date,
              nominal: r.nominal,
              diff: r.diff,
              ccyNameEn: r.ccy_name_en,
              rawRate: r.raw_rate,
          }));
      }
      const rates = getLocal<ExchangeRate[]>(FX_RATES_KEY, []);
      return rates.filter(r => r.date === date);
  },

  // Get the most recent cached rates (for fallback when API is unavailable)
  getMostRecentExchangeRates: async (): Promise<{ rates: ExchangeRate[], date: string | null }> => {
      if (isSupabaseEnabled()) {
          // First get the most recent date that has rates
          const { data: dateData } = await supabase!.from('fx_rates')
              .select('date')
              .order('date', { ascending: false })
              .limit(1);

          if (!dateData || dateData.length === 0) {
              return { rates: [], date: null };
          }

          const mostRecentDate = dateData[0].date;

          // Then get all rates for that date
          const { data } = await supabase!.from('fx_rates').select('*').eq('date', mostRecentDate);
          const rates = (data || []).map((r: any) => ({
              id: r.id,
              currency: r.currency,
              rate: r.rate,
              date: r.date,
              nominal: r.nominal,
              diff: r.diff,
              ccyNameEn: r.ccy_name_en,
              rawRate: r.raw_rate,
          }));
          return { rates, date: mostRecentDate };
      }

      const rates = getLocal<ExchangeRate[]>(FX_RATES_KEY, []);
      if (rates.length === 0) {
          return { rates: [], date: null };
      }

      // Find the most recent date
      const sortedRates = [...rates].sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const mostRecentDate = sortedRates[0].date;

      return {
          rates: rates.filter(r => r.date === mostRecentDate),
          date: mostRecentDate
      };
  },

  saveExchangeRate: async (rate: ExchangeRate): Promise<void> => {
      if (isSupabaseEnabled()) {
          // Map camelCase to snake_case for Supabase
          // id is auto-generated UUID by the DB; upsert on (currency, date) unique constraint
          await supabase!.from('fx_rates').upsert({
              currency: rate.currency,
              rate: rate.rate,
              date: rate.date,
              nominal: rate.nominal || 1,
              diff: rate.diff || null,
              ccy_name_en: rate.ccyNameEn || null,
              raw_rate: rate.rawRate || rate.rate,
          }, {
              onConflict: 'currency,date'
          });
          return;
      }
      const rates = getLocal<ExchangeRate[]>(FX_RATES_KEY, []);
      const index = rates.findIndex(r => r.currency === rate.currency && r.date === rate.date);
      if (index >= 0) rates[index] = rate;
      else rates.push(rate);
      localStorage.setItem(FX_RATES_KEY, JSON.stringify(rates));
  },

  deleteExchangeRate: async (id: string): Promise<void> => {
      if (isSupabaseEnabled()) {
          await supabase!.from('fx_rates').delete().eq('id', id);
          return;
      }
      let rates = getLocal<ExchangeRate[]>(FX_RATES_KEY, []);
      rates = rates.filter(r => r.id !== id);
      localStorage.setItem(FX_RATES_KEY, JSON.stringify(rates));
  },

  // --- User Management ---
  getUsers: async (): Promise<User[]> => {
    if (isSupabaseEnabled()) {
      // Fetch from 'profiles'
      const { data } = await supabase!.from('profiles').select('*');
      return (data || []).map((p: any) => ({
          id: p.id,
          email: p.email,
          name: p.full_name,
          role: p.role,
          avatarUrl: p.avatar_url,
          lastLogin: null, // Keep null or add column if needed
          permissions: DEFAULT_PERMISSIONS[p.role]
      }));
    }
    return getLocal(USERS_KEY, SEED_USERS);
  },

  saveUser: async (user: User): Promise<void> => {
    if (isSupabaseEnabled()) {
       // Save to 'profiles'
       const { error } = await supabase!.from('profiles').upsert({
           id: user.id,
           email: user.email,
           full_name: user.name,
           role: user.role,
           avatar_url: user.avatarUrl,
           // permissions: user.permissions // Optional
       });
       if (error) throw error;
       return;
    }
    const users = getLocal(USERS_KEY, SEED_USERS);
    const index = users.findIndex((u: User) => u.id === user.id);
    if (index >= 0) users[index] = user;
    else users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  deleteUser: async (id: string): Promise<void> => {
    if (isSupabaseEnabled()) {
      // Delete from auth.users (cascades to profiles)
      // Note: Client SDK usually doesn't allow deleting auth users directly.
      // This is often done via RPC or Edge Function for safety.
      // For now, we try to delete from profiles, but proper way is Admin API.
      await supabase!.from('profiles').delete().eq('id', id);
      return;
    }
    let users = getLocal(USERS_KEY, SEED_USERS);
    users = users.filter((u: User) => u.id !== id);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  // ... [Legal Entities and Search code omitted, keeping file valid] ...
  
  getLegalEntities: async (): Promise<LegalEntity[]> => {
      if (isSupabaseEnabled()) {
          const { data } = await supabase!.from('legal_entities').select('*').order('fullName', { ascending: true });
          return data as LegalEntity[] || [];
      }
      const entities = getLocal<LegalEntity[]>(ENTITIES_KEY, []);
      return entities.filter(e => !e.isDeleted).sort((a,b) => a.fullName.localeCompare(b.fullName));
  },

  getLegalEntity: async (id: string): Promise<LegalEntity | undefined> => {
      if (isSupabaseEnabled()) {
          const { data } = await supabase!.from('legal_entities').select('*').eq('id', id).single();
          return data as LegalEntity;
      }
      const entities = getLocal<LegalEntity[]>(ENTITIES_KEY, []);
      return entities.find(e => e.id === id);
  },

  findLegalEntityByName: async (name: string): Promise<LegalEntity | undefined> => {
       if (isSupabaseEnabled()) {
          const { data } = await supabase!.from('legal_entities').select('*').ilike('fullName', name).single();
          return data as LegalEntity;
       }
       const entities = getLocal<LegalEntity[]>(ENTITIES_KEY, []);
       return entities.find(e => e.fullName.trim().toLowerCase() === name.trim().toLowerCase() && !e.isDeleted);
  },

  saveLegalEntity: async (entity: LegalEntity): Promise<void> => {
      let oldEntity: LegalEntity | undefined;
      if (isSupabaseEnabled()) {
          const { data } = await supabase!.from('legal_entities').select('*').eq('id', entity.id).single();
          oldEntity = data;
      } else {
          const entities = getLocal<LegalEntity[]>(ENTITIES_KEY, []);
          oldEntity = entities.find(e => e.id === entity.id);
      }

      const action = oldEntity ? 'UPDATE' : 'CREATE';
      let changes: any = { action: 'New Record Created' };
      
      if (oldEntity) {
          changes = {};
          (Object.keys(entity) as Array<keyof LegalEntity>).forEach(key => {
              if (JSON.stringify(entity[key]) !== JSON.stringify(oldEntity![key])) {
                  changes[key] = { from: oldEntity![key], to: entity[key] };
              }
          });
      }

      if (isSupabaseEnabled()) {
          await supabase!.from('legal_entities').upsert({
              ...entity,
              updatedAt: new Date().toISOString()
          });
      } else {
          const entities = getLocal<LegalEntity[]>(ENTITIES_KEY, []);
          const index = entities.findIndex(e => e.id === entity.id);
          const entityToSave = { ...entity, updatedAt: new Date().toISOString() };
          if (index >= 0) entities[index] = entityToSave;
          else entities.push(entityToSave);
          localStorage.setItem(ENTITIES_KEY, JSON.stringify(entities));
      }

      if (Object.keys(changes).length > 0) {
        await createLog(entity.id, action, changes);
      }
  },

  deleteLegalEntity: async (id: string): Promise<void> => {
      await createLog(id, 'DELETE', { status: 'Marked as Deleted' });

      if (isSupabaseEnabled()) {
          await supabase!.from('legal_entities').update({ isDeleted: true }).eq('id', id);
          return;
      }
      const entities = getLocal<LegalEntity[]>(ENTITIES_KEY, []);
      const entity = entities.find(e => e.id === id);
      if (entity) {
          entity.isDeleted = true;
          localStorage.setItem(ENTITIES_KEY, JSON.stringify(entities));
      }
  },

  getEntityLogs: async (entityId: string): Promise<EntityLog[]> => {
      if (isSupabaseEnabled()) {
          const { data } = await supabase!.from('entity_logs').select('*').eq('entityId', entityId).order('timestamp', { ascending: false });
          return data as EntityLog[] || [];
      }
      const logs = getLocal<EntityLog[]>(ENTITY_LOGS_KEY, []);
      return logs.filter(l => l.entityId === entityId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  // --- Portfolio View (Server-Side Pagination) ---
  getPortfolioPage: async (params: {
    page: number;           // 0-indexed
    pageSize: number;
    sourceFilter?: string;  // 'all' | 'direct' | 'inward-foreign' | 'inward-domestic' | 'inward'
    statusFilter?: string;  // 'All' | 'Active' | 'Pending' | 'Cancelled'
    searchTerm?: string;
    searchFilters?: { field: string; value: string }[];
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    dateField?: string;     // column name for date filter
    dateFrom?: string;      // YYYY-MM-DD
    dateTo?: string;        // YYYY-MM-DD
  }): Promise<{ rows: any[]; totalCount: number; totalSumInsured: number; totalGWP: number }> => {
    if (!isSupabaseEnabled()) return { rows: [], totalCount: 0, totalSumInsured: 0, totalGWP: 0 };

    const { page, pageSize, sourceFilter, statusFilter, searchTerm, searchFilters, sortField, sortDirection, dateField, dateFrom, dateTo } = params;

    // Helper: apply shared filters to a query
    const applyFilters = (q: any) => {
      // Source filter
      if (sourceFilter && sourceFilter !== 'all') {
        if (sourceFilter === 'inward') {
          q = q.in('source', ['inward-foreign', 'inward-domestic']);
        } else {
          q = q.eq('source', sourceFilter);
        }
      }

      // Status filter
      if (statusFilter && statusFilter !== 'All') {
        const today = new Date().toISOString().split('T')[0];
        if (statusFilter === 'Active') {
          q = q.ilike('status', 'Active');
          q = q.gte('expiry_date', today);
        } else if (statusFilter === 'Expired') {
          q = q.ilike('status', 'Active');
          q = q.lt('expiry_date', today);
        } else {
          q = q.ilike('status', statusFilter);
        }
      }

      // Search filters
      const broadColumns = [
        'reference_number', 'insured_name', 'broker_name', 'cedant_name',
        'class_of_business', 'territory', 'currency', 'status', 'source',
      ];

      if (searchFilters && searchFilters.length > 0) {
        for (const filter of searchFilters) {
          if (filter.field === '_any') {
            const orClause = broadColumns
              .map(col => `${col}.ilike.%${filter.value}%`)
              .join(',');
            q = q.or(orClause);
          } else {
            q = q.ilike(filter.field, `%${filter.value}%`);
          }
        }
      } else if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim();
        const orClause = broadColumns
          .map(col => `${col}.ilike.%${term}%`)
          .join(',');
        q = q.or(orClause);
      }

      // Date range filter
      if (dateField && (dateFrom || dateTo)) {
        const dateColumnMap: Record<string, string> = {
          'inceptionDate': 'inception_date',
          'expiryDate': 'expiry_date',
          'dateOfSlip': 'date_of_slip',
          'accountingDate': 'accounting_date',
          'reinsuranceInceptionDate': 'reinsurance_inception_date',
          'reinsuranceExpiryDate': 'reinsurance_expiry_date',
          'premiumPaymentDate': 'premium_payment_date',
          'actualPaymentDate': 'actual_payment_date',
        };
        const dbDateCol = dateColumnMap[dateField] || dateField;
        if (dateFrom) q = q.gte(dbDateCol, dateFrom);
        if (dateTo) q = q.lte(dbDateCol, dateTo);
      }

      return q;
    };

    // Main query: filtered, sorted, paginated
    let query = supabase!
      .from('v_portfolio')
      .select('*', { count: 'exact' });
    query = applyFilters(query);

    // Sort
    const sortMap: Record<string, string> = {
      'referenceNumber': 'reference_number',
      'insuredName': 'insured_name',
      'brokerName': 'broker_name',
      'classOfBusiness': 'class_of_business',
      'territory': 'territory',
      'grossPremium': 'gross_premium',
      'netPremium': 'net_premium',
      'ourShare': 'our_share',
      'inceptionDate': 'inception_date',
      'expiryDate': 'expiry_date',
      'source': 'source',
      'status': 'status',
      'sumInsuredNational': 'sum_insured_national',
      'installmentCount': 'installment_count',
      'currency': 'currency',
    };
    const dbSortField = sortMap[sortField || 'inceptionDate'] || 'inception_date';
    query = query.order(dbSortField, { ascending: sortDirection === 'asc' });

    // Paginate
    const from = page * pageSize;
    query = query.range(from, from + pageSize - 1);

    // Aggregation query: same filters, only USD-converted columns, no sort/pagination
    let aggQuery = supabase!
      .from('v_portfolio')
      .select('sum_insured_usd, gross_premium_usd');
    aggQuery = applyFilters(aggQuery);

    // Run both in parallel
    const [mainResult, aggResult] = await Promise.all([query, aggQuery]);

    if (mainResult.error) {
      console.error('Portfolio query error:', mainResult.error);
      return { rows: [], totalCount: 0, totalSumInsured: 0, totalGWP: 0 };
    }

    // Sum aggregation results
    let totalSumInsured = 0;
    let totalGWP = 0;
    if (aggResult.data) {
      for (const r of aggResult.data) {
        totalSumInsured += Number(r.sum_insured_usd || 0);
        totalGWP += Number(r.gross_premium_usd || 0);
      }
    }

    return {
      rows: mainResult.data || [],
      totalCount: mainResult.count || 0,
      totalSumInsured,
      totalGWP,
    };
  },

  // --- Installments (lazy-load for detail modal) ---
  getInstallmentsByRef: async (referenceNumber: string, source: string): Promise<Policy[]> => {
    if (!isSupabaseEnabled()) return [];

    if (source === 'direct') {
      const { data, error } = await supabase!
        .from('policies')
        .select('*')
        .eq('policyNumber', referenceNumber)
        .eq('recordType', 'Direct');
      if (error) { console.error('Installments query error:', error); return []; }
      return (data || []).map(toAppPolicy);
    }

    // For inward, query inward_reinsurance by contract_number
    if (source === 'inward-foreign' || source === 'inward-domestic') {
      const { data, error } = await supabase!
        .from('inward_reinsurance')
        .select('*')
        .eq('contract_number', referenceNumber);
      if (error) { console.error('Installments query error:', error); return []; }
      return (data || []).map((row: any) => ({
        id: row.id,
        contractNumber: row.contract_number,
        origin: row.origin,
        type: row.type,
        structure: row.structure,
        status: row.status,
        cedantName: row.cedant_name,
        brokerName: row.broker_name,
        inceptionDate: row.inception_date,
        expiryDate: row.expiry_date,
        currency: row.currency,
        limitOfLiability: row.limit_of_liability,
        ourShare: row.our_share,
        grossPremium: row.gross_premium,
        netPremium: row.net_premium,
        commissionPercent: row.commission_percent,
        classOfCover: row.class_of_cover,
        typeOfCover: row.type_of_cover,
        territory: row.territory,
        isDeleted: row.is_deleted,
        dateOfSlip: row.date_of_slip,
        accountingDate: row.accounting_date,
        reinsuranceInceptionDate: row.reinsurance_inception_date,
        reinsuranceExpiryDate: row.reinsurance_expiry_date,
        premiumPaymentDate: row.premium_payment_date,
        actualPaymentDate: row.actual_payment_date,
        insuranceDays: row.insurance_days,
        reinsuranceDays: row.reinsurance_days,
        originalInsuredName: row.original_insured_name,
      })) as any[];
    }

    return [];
  },

  // --- Direct Policies View (Server-Side Pagination) ---
  getDirectPoliciesPage: async (params: {
    page: number;           // 0-indexed
    pageSize: number;
    countryFilter?: string; // 'all' | 'uzbekistan' | 'foreign'
    statusFilter?: string;  // 'all' | 'Draft' | 'Active' | 'Expired' | 'Cancelled'
    searchTerm?: string;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    dateField?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ rows: any[]; totalCount: number }> => {
    if (!isSupabaseEnabled()) return { rows: [], totalCount: 0 };

    const { page, pageSize, countryFilter, statusFilter, searchTerm, sortField, sortDirection, dateField, dateFrom, dateTo } = params;

    let query = supabase!
      .from('v_direct_policies_consolidated')
      .select('*', { count: 'exact' });

    // Country filter
    if (countryFilter && countryFilter !== 'all') {
      if (countryFilter === 'uzbekistan') {
        query = query.eq('territory', 'Uzbekistan');
      } else if (countryFilter === 'foreign') {
        query = query.neq('territory', 'Uzbekistan');
      }
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    // Search across policy_number, insured_name
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim();
      query = query.or(
        `policy_number.ilike.%${term}%,insured_name.ilike.%${term}%`
      );
    }

    // Date range filter
    if (dateField && (dateFrom || dateTo)) {
      const dateColumnMap: Record<string, string> = {
        'inceptionDate': 'inception_date',
        'expiryDate': 'expiry_date',
        'dateOfSlip': 'date_of_slip',
        'accountingDate': 'accounting_date',
        'premiumPaymentDate': 'premium_payment_date',
        'actualPaymentDate': 'actual_payment_date',
      };
      const dbDateCol = dateColumnMap[dateField] || dateField;
      if (dateFrom) query = query.gte(dbDateCol, dateFrom);
      if (dateTo) query = query.lte(dbDateCol, dateTo);
    }

    // Sort
    const sortMap: Record<string, string> = {
      'policyNumber': 'policy_number',
      'insuredName': 'insured_name',
      'territory': 'territory',
      'classOfInsurance': 'class_of_business',
      'grossPremium': 'gross_premium',
      'inceptionDate': 'inception_date',
      'expiryDate': 'expiry_date',
      'status': 'status',
    };
    const dbSortField = sortMap[sortField || 'inception_date'] || 'inception_date';
    query = query.order(dbSortField, { ascending: sortDirection === 'asc' });

    // Paginate
    const from = page * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Direct policies query error:', error);
      return { rows: [], totalCount: 0 };
    }

    return { rows: data || [], totalCount: count || 0 };
  },

  // Stats for Direct Policies (lightweight head:true count queries)
  getDirectPoliciesStats: async (filters?: {
    countryFilter?: string;
    statusFilter?: string;
    searchTerm?: string;
    dateField?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    total: number; uzbekistan: number; foreign: number;
    active: number; draft: number;
  }> => {
    if (!isSupabaseEnabled()) return { total: 0, uzbekistan: 0, foreign: 0, active: 0, draft: 0 };

    // Helper to build a base query with shared filters
    const buildBase = () => {
      let q = supabase!.from('v_direct_policies_consolidated').select('*', { count: 'exact', head: true });
      if (filters?.countryFilter && filters.countryFilter !== 'all') {
        if (filters.countryFilter === 'uzbekistan') q = q.eq('territory', 'Uzbekistan');
        else if (filters.countryFilter === 'foreign') q = q.neq('territory', 'Uzbekistan');
      }
      if (filters?.statusFilter && filters.statusFilter !== 'all') {
        q = q.eq('status', filters.statusFilter);
      }
      if (filters?.searchTerm && filters.searchTerm.trim()) {
        const term = filters.searchTerm.trim();
        q = q.or(`policy_number.ilike.%${term}%,insured_name.ilike.%${term}%`);
      }
      if (filters?.dateField && (filters?.dateFrom || filters?.dateTo)) {
        const dateColumnMap: Record<string, string> = {
          'inceptionDate': 'inception_date', 'expiryDate': 'expiry_date',
          'dateOfSlip': 'date_of_slip', 'accountingDate': 'accounting_date',
          'premiumPaymentDate': 'premium_payment_date', 'actualPaymentDate': 'actual_payment_date',
        };
        const dbDateCol = dateColumnMap[filters.dateField] || filters.dateField;
        if (filters.dateFrom) q = q.gte(dbDateCol, filters.dateFrom);
        if (filters.dateTo) q = q.lte(dbDateCol, filters.dateTo);
      }
      return q;
    };

    // Build sub-queries that further narrow by country/status on top of shared filters
    const buildCountry = (territory: 'uzbekistan' | 'foreign') => {
      let q = supabase!.from('v_direct_policies_consolidated').select('*', { count: 'exact', head: true });
      // Apply shared filters except country (we override)
      if (filters?.statusFilter && filters.statusFilter !== 'all') q = q.eq('status', filters.statusFilter);
      if (filters?.searchTerm && filters.searchTerm.trim()) {
        const term = filters.searchTerm.trim();
        q = q.or(`policy_number.ilike.%${term}%,insured_name.ilike.%${term}%`);
      }
      if (filters?.dateField && (filters?.dateFrom || filters?.dateTo)) {
        const dateColumnMap: Record<string, string> = {
          'inceptionDate': 'inception_date', 'expiryDate': 'expiry_date',
          'dateOfSlip': 'date_of_slip', 'accountingDate': 'accounting_date',
          'premiumPaymentDate': 'premium_payment_date', 'actualPaymentDate': 'actual_payment_date',
        };
        const dbDateCol = dateColumnMap[filters.dateField] || filters.dateField;
        if (filters.dateFrom) q = q.gte(dbDateCol, filters.dateFrom);
        if (filters.dateTo) q = q.lte(dbDateCol, filters.dateTo);
      }
      if (territory === 'uzbekistan') q = q.eq('territory', 'Uzbekistan');
      else q = q.neq('territory', 'Uzbekistan');
      return q;
    };

    const buildStatus = (status: string) => {
      let q = supabase!.from('v_direct_policies_consolidated').select('*', { count: 'exact', head: true });
      if (filters?.countryFilter && filters.countryFilter !== 'all') {
        if (filters.countryFilter === 'uzbekistan') q = q.eq('territory', 'Uzbekistan');
        else if (filters.countryFilter === 'foreign') q = q.neq('territory', 'Uzbekistan');
      }
      if (filters?.searchTerm && filters.searchTerm.trim()) {
        const term = filters.searchTerm.trim();
        q = q.or(`policy_number.ilike.%${term}%,insured_name.ilike.%${term}%`);
      }
      if (filters?.dateField && (filters?.dateFrom || filters?.dateTo)) {
        const dateColumnMap: Record<string, string> = {
          'inceptionDate': 'inception_date', 'expiryDate': 'expiry_date',
          'dateOfSlip': 'date_of_slip', 'accountingDate': 'accounting_date',
          'premiumPaymentDate': 'premium_payment_date', 'actualPaymentDate': 'actual_payment_date',
        };
        const dbDateCol = dateColumnMap[filters.dateField] || filters.dateField;
        if (filters.dateFrom) q = q.gte(dbDateCol, filters.dateFrom);
        if (filters.dateTo) q = q.lte(dbDateCol, filters.dateTo);
      }
      q = q.eq('status', status);
      return q;
    };

    const [totalRes, uzbekRes, foreignRes, activeRes, draftRes] = await Promise.all([
      buildBase(),
      buildCountry('uzbekistan'),
      buildCountry('foreign'),
      buildStatus('Active'),
      buildStatus('Draft'),
    ]);

    return {
      total: totalRes.count || 0,
      uzbekistan: uzbekRes.count || 0,
      foreign: foreignRes.count || 0,
      active: activeRes.count || 0,
      draft: draftRes.count || 0,
    };
  },

  // --- Inward Reinsurance View (Server-Side Pagination) ---
  getInwardReinsurancePage: async (params: {
    page: number;           // 0-indexed
    pageSize: number;
    typeFilter?: string;    // 'all' | 'foreign' | 'domestic'
    statusFilter?: string;  // 'all' | 'DRAFT' | 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
    classFilter?: string;   // 'all' | specific class
    searchTerm?: string;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    dateField?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ rows: any[]; totalCount: number }> => {
    if (!isSupabaseEnabled()) return { rows: [], totalCount: 0 };

    const { page, pageSize, typeFilter, statusFilter, classFilter, searchTerm, sortField, sortDirection, dateField, dateFrom, dateTo } = params;

    let query = supabase!
      .from('v_inward_consolidated')
      .select('*', { count: 'exact' });

    // Type filter (origin)
    if (typeFilter && typeFilter !== 'all') {
      query = query.eq('source', typeFilter === 'foreign' ? 'inward-foreign' : 'inward-domestic');
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    // Class filter
    if (classFilter && classFilter !== 'all') {
      query = query.eq('class_of_cover', classFilter);
    }

    // Search across contract_number, cedant_name, broker_name, original_insured_name
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim();
      query = query.or(
        `contract_number.ilike.%${term}%,cedant_name.ilike.%${term}%,broker_name.ilike.%${term}%,original_insured_name.ilike.%${term}%`
      );
    }

    // Date range filter
    if (dateField && (dateFrom || dateTo)) {
      const dateColumnMap: Record<string, string> = {
        'inceptionDate': 'inception_date',
        'expiryDate': 'expiry_date',
        'dateOfSlip': 'date_of_slip',
        'accountingDate': 'accounting_date',
        'reinsuranceInceptionDate': 'reinsurance_inception_date',
        'reinsuranceExpiryDate': 'reinsurance_expiry_date',
        'premiumPaymentDate': 'premium_payment_date',
        'actualPaymentDate': 'actual_payment_date',
      };
      const dbDateCol = dateColumnMap[dateField] || dateField;
      if (dateFrom) query = query.gte(dbDateCol, dateFrom);
      if (dateTo) query = query.lte(dbDateCol, dateTo);
    }

    // Sort
    const sortMap: Record<string, string> = {
      'contractNumber': 'contract_number',
      'cedantName': 'cedant_name',
      'brokerName': 'broker_name',
      'classOfCover': 'class_of_cover',
      'grossPremium': 'gross_premium',
      'netPremium': 'net_premium',
      'ourShare': 'our_share',
      'inceptionDate': 'inception_date',
      'expiryDate': 'expiry_date',
      'status': 'status',
      'source': 'source',
    };
    const dbSortField = sortMap[sortField || 'inception_date'] || 'inception_date';
    query = query.order(dbSortField, { ascending: sortDirection === 'asc' });

    // Paginate
    const from = page * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Inward reinsurance query error:', error);
      return { rows: [], totalCount: 0 };
    }

    return { rows: data || [], totalCount: count || 0 };
  },

  // Stats for Inward Reinsurance (lightweight head:true count queries)
  getInwardReinsuranceStats: async (filters?: {
    typeFilter?: string;
    statusFilter?: string;
    classFilter?: string;
    searchTerm?: string;
    dateField?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    total: number; foreign: number; domestic: number; active: number;
  }> => {
    if (!isSupabaseEnabled()) return { total: 0, foreign: 0, domestic: 0, active: 0 };

    const applySharedFilters = (q: any, skipType = false, skipStatus = false) => {
      if (!skipType && filters?.typeFilter && filters.typeFilter !== 'all') {
        q = q.eq('source', filters.typeFilter === 'foreign' ? 'inward-foreign' : 'inward-domestic');
      }
      if (!skipStatus && filters?.statusFilter && filters.statusFilter !== 'all') {
        q = q.eq('status', filters.statusFilter);
      }
      if (filters?.classFilter && filters.classFilter !== 'all') {
        q = q.eq('class_of_cover', filters.classFilter);
      }
      if (filters?.searchTerm && filters.searchTerm.trim()) {
        const term = filters.searchTerm.trim();
        q = q.or(`contract_number.ilike.%${term}%,cedant_name.ilike.%${term}%,broker_name.ilike.%${term}%,original_insured_name.ilike.%${term}%`);
      }
      if (filters?.dateField && (filters?.dateFrom || filters?.dateTo)) {
        const dateColumnMap: Record<string, string> = {
          'inceptionDate': 'inception_date', 'expiryDate': 'expiry_date',
          'dateOfSlip': 'date_of_slip', 'accountingDate': 'accounting_date',
          'reinsuranceInceptionDate': 'reinsurance_inception_date', 'reinsuranceExpiryDate': 'reinsurance_expiry_date',
          'premiumPaymentDate': 'premium_payment_date', 'actualPaymentDate': 'actual_payment_date',
        };
        const dbDateCol = dateColumnMap[filters.dateField] || filters.dateField;
        if (filters.dateFrom) q = q.gte(dbDateCol, filters.dateFrom);
        if (filters.dateTo) q = q.lte(dbDateCol, filters.dateTo);
      }
      return q;
    };

    const buildQuery = () => applySharedFilters(
      supabase!.from('v_inward_consolidated').select('*', { count: 'exact', head: true })
    );
    const buildType = (source: string) => {
      let q = supabase!.from('v_inward_consolidated').select('*', { count: 'exact', head: true });
      q = applySharedFilters(q, true); // skip type filter
      return q.eq('source', source);
    };
    const buildActive = () => {
      let q = supabase!.from('v_inward_consolidated').select('*', { count: 'exact', head: true });
      q = applySharedFilters(q, false, true); // skip status filter
      return q.eq('status', 'ACTIVE');
    };

    const [totalRes, foreignRes, domesticRes, activeRes] = await Promise.all([
      buildQuery(),
      buildType('inward-foreign'),
      buildType('inward-domestic'),
      buildActive(),
    ]);

    return {
      total: totalRes.count || 0,
      foreign: foreignRes.count || 0,
      domestic: domesticRes.count || 0,
      active: activeRes.count || 0,
    };
  },

  // Unique classes for inward reinsurance filter dropdown
  getInwardReinsuranceClasses: async (): Promise<string[]> => {
    if (!isSupabaseEnabled()) return [];

    const { data, error } = await supabase!
      .from('v_inward_consolidated')
      .select('class_of_cover');

    if (error) {
      console.error('Inward classes query error:', error);
      return [];
    }

    const classes = new Set<string>();
    (data || []).forEach((row: any) => {
      if (row.class_of_cover) classes.add(row.class_of_cover);
    });
    return Array.from(classes).sort();
  },

  // --- External API Search Simulation ---
  searchExternalRegistry: async (query: string, type: 'INN' | 'NAME'): Promise<Partial<LegalEntity> | null> => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (query === '309730232' || query.toLowerCase().includes('uzbek')) {
          return {
              fullName: "Uzbek General Insurance LLC",
              shortName: "UGI",
              regCodeType: "INN",
              regCodeValue: "309730232",
              country: "Uzbekistan",
              city: "Tashkent",
              address: "Amir Temur Avenue, 108",
              shareholders: "State Assets Management Agency (100%)",
              lineOfBusiness: "General Insurance Activities",
              directorName: "Aliev Valijon",
              phone: "+998 71 200 00 00",
              status: PolicyStatus.ACTIVE 
          } as any;
      }
      return null;
  },

  // ==================== App Settings ====================

  async getSetting(key: string): Promise<string | null> {
    if (isSupabaseEnabled()) {
      try {
        const { data, error } = await supabase!
          .from('app_settings')
          .select('value')
          .eq('key', key)
          .single();
        if (!error && data) {
          return data.value;
        }
      } catch {
        // Supabase table may not exist, fall back to localStorage
      }
    }
    // localStorage fallback
    try {
      const settings = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || '{}');
      return settings[key] ?? null;
    } catch {
      return null;
    }
  },

  async setSetting(key: string, value: string): Promise<void> {
    if (isSupabaseEnabled()) {
      try {
        const { error } = await supabase!
          .from('app_settings')
          .upsert(
            { key, value, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          );
        if (!error) return;
      } catch {
        // Supabase table may not exist, fall back to localStorage
      }
    }
    // localStorage fallback
    try {
      const settings = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || '{}');
      settings[key] = value;
      localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  },

  // --- BINDING AGREEMENTS (MGA) ---

  getBindingAgreements: async (): Promise<BindingAgreement[]> => {
    if (!isSupabaseEnabled()) return [];
    try {
      const { data, error } = await supabase!
        .from('binding_agreements')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('binding_agreements table not found - migration may not have been run');
          return [];
        }
        throw error;
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        agreementNumber: row.agreement_number,
        agreementType: row.agreement_type,
        mgaName: row.mga_name,
        mgaEntityId: row.mga_entity_id,
        brokerName: row.broker_name,
        brokerEntityId: row.broker_entity_id,
        underwriter: row.underwriter,
        status: row.status,
        inceptionDate: row.inception_date,
        expiryDate: row.expiry_date,
        currency: row.currency,
        territoryScope: row.territory_scope,
        classOfBusiness: row.class_of_business,
        epi: Number(row.epi || 0),
        ourShare: Number(row.our_share || 1),
        commissionPercent: Number(row.commission_percent || 0),
        maxLimitPerRisk: row.max_limit_per_risk ? Number(row.max_limit_per_risk) : undefined,
        aggregateLimit: row.aggregate_limit ? Number(row.aggregate_limit) : undefined,
        depositPremium: Number(row.deposit_premium || 0),
        minimumPremium: Number(row.minimum_premium || 0),
        claimsAuthorityLimit: Number(row.claims_authority_limit || 0),
        riskParameters: row.risk_parameters,
        notes: row.notes,
        isDeleted: row.is_deleted,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      console.error('Failed to fetch binding agreements:', err);
      return [];
    }
  },

  getBindingAgreement: async (id: string): Promise<BindingAgreement | undefined> => {
    if (!isSupabaseEnabled()) return undefined;
    const { data, error } = await supabase!
      .from('binding_agreements')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    const row = data;
    return {
      id: row.id,
      agreementNumber: row.agreement_number,
      agreementType: row.agreement_type,
      mgaName: row.mga_name,
      mgaEntityId: row.mga_entity_id,
      brokerName: row.broker_name,
      brokerEntityId: row.broker_entity_id,
      underwriter: row.underwriter,
      status: row.status,
      inceptionDate: row.inception_date,
      expiryDate: row.expiry_date,
      currency: row.currency,
      territoryScope: row.territory_scope,
      classOfBusiness: row.class_of_business,
      epi: Number(row.epi || 0),
      ourShare: Number(row.our_share || 1),
      commissionPercent: Number(row.commission_percent || 0),
      maxLimitPerRisk: row.max_limit_per_risk ? Number(row.max_limit_per_risk) : undefined,
      aggregateLimit: row.aggregate_limit ? Number(row.aggregate_limit) : undefined,
      depositPremium: Number(row.deposit_premium || 0),
      minimumPremium: Number(row.minimum_premium || 0),
      claimsAuthorityLimit: Number(row.claims_authority_limit || 0),
      riskParameters: row.risk_parameters,
      notes: row.notes,
      isDeleted: row.is_deleted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  saveBindingAgreement: async (agreement: BindingAgreement): Promise<void> => {
    if (!isSupabaseEnabled()) return;
    const { error } = await supabase!.from('binding_agreements').upsert({
      id: agreement.id,
      agreement_number: agreement.agreementNumber,
      agreement_type: agreement.agreementType,
      mga_name: agreement.mgaName,
      mga_entity_id: agreement.mgaEntityId || null,
      broker_name: agreement.brokerName || null,
      broker_entity_id: agreement.brokerEntityId || null,
      underwriter: agreement.underwriter || null,
      status: agreement.status,
      inception_date: agreement.inceptionDate || null,
      expiry_date: agreement.expiryDate || null,
      currency: agreement.currency,
      territory_scope: agreement.territoryScope || null,
      class_of_business: agreement.classOfBusiness || null,
      epi: agreement.epi,
      our_share: agreement.ourShare,
      commission_percent: agreement.commissionPercent,
      max_limit_per_risk: agreement.maxLimitPerRisk || null,
      aggregate_limit: agreement.aggregateLimit || null,
      deposit_premium: agreement.depositPremium,
      minimum_premium: agreement.minimumPremium,
      claims_authority_limit: agreement.claimsAuthorityLimit,
      risk_parameters: agreement.riskParameters || null,
      notes: agreement.notes || null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('Save binding agreement error:', error);
      throw error;
    }
  },

  deleteBindingAgreement: async (id: string): Promise<void> => {
    if (!isSupabaseEnabled()) return;
    await supabase!.from('binding_agreements').update({ is_deleted: true }).eq('id', id);
  },

  // --- BORDEREAUX ---

  getBordereauxByAgreement: async (agreementId: string): Promise<BordereauxEntry[]> => {
    if (!isSupabaseEnabled()) return [];
    try {
      const { data, error } = await supabase!
        .from('bordereaux_entries')
        .select('*')
        .eq('agreement_id', agreementId)
        .eq('is_deleted', false)
        .order('period_from', { ascending: false });
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
          return [];
        }
        throw error;
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        agreementId: row.agreement_id,
        bordereauType: row.bordereaux_type,
        periodFrom: row.period_from,
        periodTo: row.period_to,
        submissionDate: row.submission_date,
        status: row.status,
        totalGwp: Number(row.total_gwp || 0),
        totalPolicies: Number(row.total_policies || 0),
        totalClaimsPaid: Number(row.total_claims_paid || 0),
        totalClaimsReserved: Number(row.total_claims_reserved || 0),
        fileName: row.file_name,
        notes: row.notes,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        isDeleted: row.is_deleted,
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.error('Failed to fetch bordereaux:', err);
      return [];
    }
  },

  saveBordereauxEntry: async (entry: BordereauxEntry): Promise<void> => {
    if (!isSupabaseEnabled()) return;
    const { error } = await supabase!.from('bordereaux_entries').upsert({
      id: entry.id,
      agreement_id: entry.agreementId,
      bordereaux_type: entry.bordereauType,
      period_from: entry.periodFrom || null,
      period_to: entry.periodTo || null,
      submission_date: entry.submissionDate || null,
      status: entry.status,
      total_gwp: entry.totalGwp,
      total_policies: entry.totalPolicies,
      total_claims_paid: entry.totalClaimsPaid,
      total_claims_reserved: entry.totalClaimsReserved,
      file_name: entry.fileName || null,
      notes: entry.notes || null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('Save bordereaux entry error:', error);
      throw error;
    }
  },

  deleteBordereauxEntry: async (id: string): Promise<void> => {
    if (!isSupabaseEnabled()) return;
    await supabase!.from('bordereaux_entries').update({ is_deleted: true }).eq('id', id);
  },

  // --- BINDING AGREEMENT STATS ---

  getBindingAgreementStats: async (): Promise<{ total: number; active: number; totalEpi: number; actualGwp: number }> => {
    if (!isSupabaseEnabled()) return { total: 0, active: 0, totalEpi: 0, actualGwp: 0 };
    try {
      // Get all non-deleted agreements
      const { data: agreements, error: agErr } = await supabase!
        .from('binding_agreements')
        .select('status, epi')
        .eq('is_deleted', false);
      if (agErr) {
        if (agErr.message?.includes('does not exist')) return { total: 0, active: 0, totalEpi: 0, actualGwp: 0 };
        throw agErr;
      }

      const total = (agreements || []).length;
      const activeAgreements = (agreements || []).filter((a: any) => a.status === 'ACTIVE');
      const active = activeAgreements.length;
      const totalEpi = activeAgreements.reduce((sum: number, a: any) => sum + Number(a.epi || 0), 0);

      // Get actual GWP from accepted bordereaux
      const { data: bdx, error: bdxErr } = await supabase!
        .from('bordereaux_entries')
        .select('total_gwp')
        .eq('status', 'ACCEPTED')
        .eq('is_deleted', false);
      if (bdxErr && !bdxErr.message?.includes('does not exist')) throw bdxErr;

      const actualGwp = (bdx || []).reduce((sum: number, b: any) => sum + Number(b.total_gwp || 0), 0);

      return { total, active, totalEpi, actualGwp };
    } catch (err) {
      console.error('Failed to fetch binding agreement stats:', err);
      return { total: 0, active: 0, totalEpi: 0, actualGwp: 0 };
    }
  },
};
