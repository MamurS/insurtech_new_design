import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { DB } from '../services/db';
import { LegalEntity, Currency, PolicyStatus, PaymentStatus } from '../types';
import { DatePickerInput, toISODateString, parseDate } from './DatePickerInput';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../theme/useTheme';
import {
  Search, ChevronDown, Building2, Loader2, Calendar,
  Shield, Users, Layers, DollarSign, Lock, Clock, Save, X, Globe, Check,
  Percent, Plus, Trash2, CreditCard, AlertTriangle, FileText
} from 'lucide-react';

// ─── Insurance Classification (Uzbekistan) ──────────────────────
const INSURANCE_CLASSES: Record<string, string> = {
  '1': 'Accident', '2': 'Sickness', '3': 'Land Transport', '4': 'Railway',
  '5': 'Aviation', '6': 'Marine', '7': 'Goods in Transit',
  '8': 'Fire & Natural Disasters', '9': 'Property Damage', '10': 'Motor TPL',
  '11': 'Aviation Liability', '12': 'Marine Liability',
  '13': 'General Civil Liability', '14': 'Credit', '15': 'Suretyship',
  '16': 'Financial Risks', '17': 'Legal Expenses', '18': 'Health',
};

// ─── Full Country List ──────────────────────────────────────────
const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia",
  "Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium",
  "Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria",
  "Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad",
  "Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic",
  "Côte d'Ivoire","DR Congo","Denmark","Djibouti","Dominica","Dominican Republic","East Timor","Ecuador",
  "Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland",
  "France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea",
  "Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq",
  "Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo",
  "Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania",
  "Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania",
  "Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique",
  "Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria",
  "North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama",
  "Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia",
  "Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa",
  "San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone",
  "Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan",
  "Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Tajikistan","Tanzania",
  "Thailand","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda",
  "Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu",
  "Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

// ─── Types ──────────────────────────────────────────────────────
interface InsuranceProduct {
  id: string;
  name: string;
  code: string;
  class_codes: string[];
  cover_sections: CoverSections | null;
  is_active: boolean;
}

interface CoverSections {
  sumInsured?: SumInsuredField[];
}

interface SumInsuredField {
  key: string;
  label: string;
  hasSubLimits?: boolean;
  subLimits?: { key: string; label: string }[];
  toggles?: { key: string; label: string }[];
}

interface DeductibleRow {
  id: string;
  description: string;
  percentage: number;
  amount: number;
}

interface PremiumSub {
  key: string;
  label: string;
  rate: number;
  amount: number;
  basis: number; // the sum insured this rate applies to
}

interface Installment {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  status: 'Pending' | 'Paid';
}

interface FormData {
  // Section 1: Insured
  insuredName: string;
  insuredEntityId?: string;
  sector: string;
  insuredCountry: string;
  // Section 2: Cover
  productId?: string;
  productName: string;
  classCodes: string[];
  coverSections: CoverSections | null;
  // Section 3: Channel
  channel: 'Direct' | 'Broker' | 'Agent';
  intermediaryName: string;
  intermediaryEntityId?: string;
  // Section 4: Sums Insured
  currency: string;
  exchangeRate: number;
  sumInsuredAmounts: Record<string, number>;
  sumInsuredToggles: Record<string, boolean>;
  totalSumInsured: number;
  totalSumInsuredManual: boolean;
  // Section 5: Limit
  limitOfLiability: number;
  // Section 6: Period
  inceptionDate: string;
  expiryDate: string;
  // Section 7: Deductibles
  deductibles: DeductibleRow[];
  // Section 8: Premium
  premiumRate: number;
  grossPremium: number;
  grossPremiumManual: boolean;
  commissionPercent: number;
  commissionAmount: number;
  netPremium: number;
  subPremiums: PremiumSub[];
  // Section 9: Payment Terms
  paymentType: 'lump_sum' | 'installments';
  lumpSumDueDate: string;
  installments: Installment[];
}

interface NewRequestFormProps {
  onSave: () => void;
  onCancel: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).substring(2, 9);

const fmtNum = (v: number) => v ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '';

const parseNum = (s: string) => Number(s.replace(/[^0-9.]/g, '')) || 0;

// ─── Section Card Wrapper ───────────────────────────────────────
const SectionCard: React.FC<{
  number: number;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ number, title, icon, children }) => {
  const { t } = useTheme();
  return (
    <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: t.shadow }}>
      <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: `1px solid ${t.border}`, background: t.bgInput, borderRadius: '12px 12px 0 0' }}>
        <div className="flex items-center justify-center w-7 h-7 rounded-full" style={{ background: t.accentMuted, color: t.accent, fontSize: 12, fontWeight: 700 }}>
          {number}
        </div>
        <div className="flex items-center gap-2" style={{ color: t.text2 }}>
          {icon}
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">
        {children}
      </div>
    </div>
  );
};

// ─── Searchable Dropdown (strict selection only) ────────────────
const SearchableDropdown: React.FC<{
  label: string;
  value: string;
  options: { id: string; label: string; sublabel?: string; icon?: React.ReactNode }[];
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
  required?: boolean;
  placeholder?: string;
  loading?: boolean;
  error?: string;
}> = ({ label, value, options, onSelect, onClear, required, placeholder, loading, error }) => {
  const { t } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm) return options.slice(0, 50);
    const term = searchTerm.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(term) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(term))
    ).slice(0, 50);
  }, [options, searchTerm]);

  const handleOpen = () => {
    setIsOpen(true);
    setSearchTerm('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
        {label} {required && <span style={{ color: t.danger }}>*</span>}
      </label>
      {!isOpen ? (
        <div
          onClick={handleOpen}
          style={{ width: '100%', padding: '10px 12px', background: t.bgPanel, border: `1px solid ${error ? t.danger : t.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: t.text1, minHeight: 42 }}
          className="flex items-center justify-between"
        >
          {value ? (
            <div className="flex items-center justify-between w-full">
              <span style={{ color: t.text1 }}>{value}</span>
              <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="ml-2" style={{ color: t.text4 }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <span style={{ color: t.text4 }}>{placeholder || 'Select...'}</span>
          )}
          <ChevronDown size={14} className="shrink-0 ml-2" style={{ color: t.text4 }} />
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder || 'Type to filter...'}
            autoComplete="off"
            style={{ width: '100%', padding: '10px 12px', paddingRight: 32, background: t.bgPanel, border: `1px solid ${t.accent}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.text4 }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </div>
        </div>
      )}
      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 max-h-52 overflow-y-auto" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: t.shadowLg }}>
          {filtered.length > 0 ? filtered.map(opt => (
            <li
              key={opt.id}
              onClick={() => { onSelect(opt.id, opt.label); setIsOpen(false); setSearchTerm(''); }}
              className="px-3 py-2 cursor-pointer flex items-center gap-2"
              style={{ fontSize: 13, borderBottom: `1px solid ${t.bgInput}`, background: opt.label === value ? t.accentMuted : undefined, color: opt.label === value ? t.accent : t.text1 }}
            >
              {opt.icon && <span className="shrink-0">{opt.icon}</span>}
              <div className="min-w-0">
                <div className="font-medium truncate" style={{ color: t.text1 }}>{opt.label}</div>
                {opt.sublabel && <div className="truncate" style={{ fontSize: 12, color: t.text4 }}>{opt.sublabel}</div>}
              </div>
              {opt.label === value && <Check size={14} className="shrink-0 ml-auto" style={{ color: t.accent }} />}
            </li>
          )) : (
            <li className="px-3 py-3 text-center" style={{ fontSize: 13, color: t.text4 }}>
              {loading ? 'Loading...' : 'No results found'}
            </li>
          )}
        </ul>
      )}
      {error && <p className="text-xs mt-1" style={{ color: t.danger }}>{error}</p>}
    </div>
  );
};

// ─── Product Search (strict selection) ──────────────────────────
const ProductSearch: React.FC<{
  value: string;
  onSelect: (product: InsuranceProduct) => void;
  onClear: () => void;
  error?: string;
}> = ({ value, onSelect, onClear, error }) => {
  const { t } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<InsuranceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.from('insurance_products').select('*').eq('is_active', true).order('name');
      setAllProducts((data as InsuranceProduct[]) || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) { setIsOpen(false); setSearchTerm(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm) return allProducts;
    const term = searchTerm.toLowerCase();
    return allProducts.filter(p => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term));
  }, [searchTerm, allProducts]);

  const handleOpen = () => { setIsOpen(true); setSearchTerm(''); setTimeout(() => inputRef.current?.focus(), 50); };

  return (
    <div className="relative" ref={wrapperRef}>
      <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
        Type of Insurance Cover <span style={{ color: t.danger }}>*</span>
      </label>
      {!isOpen ? (
        <div
          onClick={handleOpen}
          style={{ width: '100%', padding: '10px 12px', background: t.bgPanel, border: `1px solid ${error ? t.danger : t.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: t.text1, minHeight: 42 }}
          className="flex items-center justify-between"
        >
          {value ? (
            <div className="flex items-center justify-between w-full">
              <span style={{ color: t.text1 }}>{value}</span>
              <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="ml-2" style={{ color: t.text4 }}><X size={14} /></button>
            </div>
          ) : (<span style={{ color: t.text4 }}>Select insurance product...</span>)}
          <ChevronDown size={14} className="shrink-0 ml-2" style={{ color: t.text4 }} />
        </div>
      ) : (
        <div className="relative">
          <input ref={inputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to filter products..." autoComplete="off"
            style={{ width: '100%', padding: '10px 12px', paddingRight: 32, background: t.bgPanel, border: `1px solid ${t.accent}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.text4 }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </div>
        </div>
      )}
      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 max-h-52 overflow-y-auto" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: t.shadowLg }}>
          {filtered.length > 0 ? filtered.map(p => (
            <li key={p.id} onClick={() => { onSelect(p); setIsOpen(false); setSearchTerm(''); }}
              className="px-3 py-2 cursor-pointer"
              style={{ fontSize: 13, borderBottom: `1px solid ${t.bgInput}`, background: p.name === value ? t.accentMuted : undefined }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium" style={{ color: t.text1 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: t.text4 }}>{p.code} · Classes: {(p.class_codes || []).join(', ')}</div>
                </div>
                {p.name === value && <Check size={14} className="shrink-0" style={{ color: t.accent }} />}
              </div>
            </li>
          )) : (
            <li className="px-3 py-3 text-center" style={{ fontSize: 13, color: t.text4 }}>{loading ? 'Loading products...' : 'No products found'}</li>
          )}
        </ul>
      )}
      {error && <p className="text-xs mt-1" style={{ color: t.danger }}>{error}</p>}
    </div>
  );
};

// ─── Currency Badge Amount Input (OUTSIDE main component to prevent focus loss) ─
const CurrencyInput: React.FC<{
  value: number; onChange: (v: number) => void; currency: string; placeholder?: string;
  bold?: boolean;
}> = React.memo(({ value, onChange, currency, placeholder = '0', bold }) => {
  const { t } = useTheme();
  const [localValue, setLocalValue] = useState(value ? fmtNum(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from parent only when not focused
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value ? fmtNum(value) : '');
    }
  }, [value]);

  return (
    <div className="relative flex-1 max-w-xs">
      <input
        ref={inputRef}
        type="text" inputMode="numeric"
        value={localValue}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          setLocalValue(e.target.value);
          onChange(Number(raw) || 0);
        }}
        onBlur={() => setLocalValue(value ? fmtNum(value) : '')}
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
        placeholder={placeholder}
        className={`w-full text-right ${bold ? 'font-bold' : ''}`}
        style={{ padding: '8px 64px 8px 8px', background: bold ? t.accentMuted : t.bgInput, border: bold ? `2px solid ${t.accentMuted}` : `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
      />
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded select-none pointer-events-none"
        style={{ fontSize: 11, fontWeight: bold ? 700 : 500, color: bold ? t.accent : t.text4, background: bold ? t.accentMuted : t.bgHover }}
      >
        {currency}
      </span>
    </div>
  );
});

// ─── Main Component ─────────────────────────────────────────────
export const NewRequestForm: React.FC<NewRequestFormProps> = ({ onSave, onCancel }) => {
  const { t } = useTheme();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormData>({
    insuredName: '', sector: '', insuredCountry: '',
    productName: '', classCodes: [], coverSections: null,
    channel: 'Direct', intermediaryName: '',
    currency: 'USD', exchangeRate: 1,
    sumInsuredAmounts: {}, sumInsuredToggles: {},
    totalSumInsured: 0, totalSumInsuredManual: false,
    limitOfLiability: 0,
    inceptionDate: '', expiryDate: '',
    // Part 2
    deductibles: [{ id: uid(), description: '', percentage: 0, amount: 0 }],
    premiumRate: 0, grossPremium: 0, grossPremiumManual: false,
    commissionPercent: 0, commissionAmount: 0, netPremium: 0,
    subPremiums: [],
    paymentType: 'lump_sum', lumpSumDueDate: '',
    installments: [],
  });

  const [fxDisplay, setFxDisplay] = useState('');

  // ─── Entity data ────────────────────────────────────────────
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);

  useEffect(() => {
    DB.getLegalEntities().then(data => { setEntities(data); setEntitiesLoading(false); }).catch(() => setEntitiesLoading(false));
  }, []);

  const insuredOptions = useMemo(() =>
    entities.map(e => ({ id: e.id, label: e.fullName, sublabel: e.shortName || undefined, icon: <Building2 size={14} style={{ color: t.text4 }} /> })), [entities]);

  const intermediaryOptions = useMemo(() =>
    entities.filter(e => e.type === form.channel).map(e => ({ id: e.id, label: e.fullName, sublabel: e.shortName || undefined, icon: <Building2 size={14} style={{ color: t.text4 }} /> })), [entities, form.channel]);

  const countryOptions = useMemo(() =>
    COUNTRIES.map(c => ({ id: c, label: c, icon: <Globe size={14} style={{ color: t.text4 }} /> })), []);

  // ─── FX Rate ────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase || form.currency === 'UZS') { setForm(f => ({ ...f, exchangeRate: 1 })); setFxDisplay(''); return; }
    (async () => {
      try {
        const { data } = await supabase.from('fx_rates').select('rate').eq('currency', form.currency).order('date', { ascending: false }).limit(1);
        if (data && data.length > 0) {
          const rate = Number(data[0].rate);
          setForm(f => ({ ...f, exchangeRate: rate }));
          setFxDisplay(`1 ${form.currency} = ${rate.toLocaleString('en-US', { maximumFractionDigits: 2 })} UZS`);
        } else { setFxDisplay('Rate not found'); }
      } catch { setFxDisplay('Rate lookup failed'); }
    })();
  }, [form.currency]);

  // ─── Auto-calculate total SI ────────────────────────────────
  useEffect(() => {
    if (form.totalSumInsuredManual) return;
    const fields = form.coverSections?.sumInsured || [];
    let total = 0;
    for (const field of fields) {
      total += form.sumInsuredAmounts[field.key] || 0;
      if (field.toggles) {
        for (const toggle of field.toggles) {
          if (form.sumInsuredToggles[toggle.key]) total += form.sumInsuredAmounts[toggle.key] || 0;
        }
      }
    }
    setForm(f => ({ ...f, totalSumInsured: total }));
  }, [form.sumInsuredAmounts, form.sumInsuredToggles, form.coverSections, form.totalSumInsuredManual]);

  // ─── Build sub-premiums from cover sections ─────────────────
  useEffect(() => {
    const fields = form.coverSections?.sumInsured || [];
    const subs: PremiumSub[] = [];
    for (const field of fields) {
      const basis = form.sumInsuredAmounts[field.key] || 0;
      if (basis > 0) {
        subs.push({ key: field.key, label: field.label, rate: 0, amount: 0, basis });
      }
      if (field.toggles) {
        for (const toggle of field.toggles) {
          if (form.sumInsuredToggles[toggle.key]) {
            const tBasis = form.sumInsuredAmounts[toggle.key] || 0;
            if (tBasis > 0) subs.push({ key: toggle.key, label: toggle.label, rate: 0, amount: 0, basis: tBasis });
          }
        }
      }
    }
    // Preserve existing rates/amounts if keys match
    setForm(f => {
      const merged = subs.map(s => {
        const existing = f.subPremiums.find(p => p.key === s.key);
        return existing ? { ...s, rate: existing.rate, amount: existing.amount } : s;
      });
      return { ...f, subPremiums: merged };
    });
  }, [form.coverSections, form.sumInsuredAmounts, form.sumInsuredToggles]);

  // ─── Auto-calculate gross premium from sub-premiums ─────────
  useEffect(() => {
    if (form.grossPremiumManual || form.subPremiums.length === 0) return;
    const total = form.subPremiums.reduce((sum, s) => sum + s.amount, 0);
    if (total > 0) setForm(f => ({ ...f, grossPremium: total }));
  }, [form.subPremiums, form.grossPremiumManual]);

  // ─── Auto-calculate commission & net premium ────────────────
  useEffect(() => {
    const commission = form.grossPremium * (form.commissionPercent / 100);
    const net = form.grossPremium - commission;
    setForm(f => ({ ...f, commissionAmount: Math.round(commission * 100) / 100, netPremium: Math.round(net * 100) / 100 }));
  }, [form.grossPremium, form.commissionPercent]);

  // Duration calculation
  const durationDays = (() => {
    if (!form.inceptionDate || !form.expiryDate) return null;
    const d1 = new Date(form.inceptionDate);
    const d2 = new Date(form.expiryDate);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  })();

  // Installment total vs premium check
  const installmentTotal = form.installments.reduce((s, i) => s + i.amount, 0);
  const installmentMismatch = form.paymentType === 'installments' && form.installments.length > 0 && form.grossPremium > 0
    && Math.abs(installmentTotal - form.grossPremium) > 0.01;

  const updateForm = (updates: Partial<FormData>) => setForm(f => ({ ...f, ...updates }));
  const setAmount = (key: string, val: number) => setForm(f => ({ ...f, sumInsuredAmounts: { ...f.sumInsuredAmounts, [key]: val } }));
  const setToggle = (key: string, val: boolean) => setForm(f => ({ ...f, sumInsuredToggles: { ...f.sumInsuredToggles, [key]: val } }));

  // ─── Deductible handlers ────────────────────────────────────
  const addDeductible = () => {
    setForm(f => ({ ...f, deductibles: [...f.deductibles, { id: uid(), description: '', percentage: 0, amount: 0 }] }));
  };
  const removeDeductible = (id: string) => {
    setForm(f => ({ ...f, deductibles: f.deductibles.filter(d => d.id !== id) }));
  };
  const updateDeductible = (id: string, field: keyof DeductibleRow, value: any) => {
    setForm(f => ({
      ...f,
      deductibles: f.deductibles.map(d => {
        if (d.id !== id) return d;
        const updated = { ...d, [field]: value };
        const basis = f.totalSumInsured || f.limitOfLiability || 0;
        // Bidirectional: % → amount, amount → %
        if (field === 'percentage' && basis > 0) {
          updated.amount = Math.round(basis * (Number(value) / 100) * 100) / 100;
        } else if (field === 'amount' && basis > 0) {
          updated.percentage = Math.round((Number(value) / basis) * 10000) / 100;
        }
        return updated;
      }),
    }));
  };

  // ─── Sub-premium handlers ───────────────────────────────────
  const updateSubPremium = (key: string, field: 'rate' | 'amount', value: number) => {
    setForm(f => ({
      ...f,
      subPremiums: f.subPremiums.map(s => {
        if (s.key !== key) return s;
        const updated = { ...s, [field]: value };
        if (field === 'rate' && s.basis > 0) {
          updated.amount = Math.round(s.basis * (value / 100) * 100) / 100;
        } else if (field === 'amount' && s.basis > 0) {
          updated.rate = Math.round((value / s.basis) * 10000) / 100;
        }
        return updated;
      }),
    }));
  };

  // ─── Installment handlers ───────────────────────────────────
  const addInstallment = () => {
    const num = form.installments.length + 1;
    setForm(f => ({
      ...f,
      installments: [...f.installments, { id: uid(), number: num, amount: 0, dueDate: '', status: 'Pending' as const }],
    }));
  };
  const removeInstallment = (id: string) => {
    setForm(f => ({
      ...f,
      installments: f.installments.filter(i => i.id !== id).map((inst, idx) => ({ ...inst, number: idx + 1 })),
    }));
  };
  const updateInstallment = (id: string, field: keyof Installment, value: any) => {
    setForm(f => ({
      ...f,
      installments: f.installments.map(i => i.id === id ? { ...i, [field]: value } : i),
    }));
  };
  const splitEqual = () => {
    if (form.grossPremium <= 0 || form.installments.length === 0) return;
    const each = Math.round((form.grossPremium / form.installments.length) * 100) / 100;
    setForm(f => ({
      ...f,
      installments: f.installments.map((inst, idx) => ({
        ...inst,
        amount: idx === f.installments.length - 1 ? Math.round((f.grossPremium - each * (f.installments.length - 1)) * 100) / 100 : each,
      })),
    }));
  };

  // ─── Entity handlers ────────────────────────────────────────
  const handleInsuredSelect = (entityId: string, _label: string) => {
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return;
    updateForm({ insuredName: entity.fullName, insuredEntityId: entity.id, sector: entity.lineOfBusiness || '', insuredCountry: entity.country || '' });
  };

  const handleProductSelect = (product: InsuranceProduct) => {
    updateForm({
      productId: product.id, productName: product.name, classCodes: product.class_codes || [],
      coverSections: product.cover_sections as CoverSections | null,
      sumInsuredAmounts: {}, sumInsuredToggles: {}, totalSumInsured: 0, totalSumInsuredManual: false,
      subPremiums: [], grossPremium: 0, grossPremiumManual: false, premiumRate: 0,
    });
  };

  const handleIntermediarySelect = (entityId: string, _label: string) => {
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return;
    updateForm({ intermediaryName: entity.fullName, intermediaryEntityId: entity.id });
  };

  // ─── Save ───────────────────────────────────────────────────
  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.insuredEntityId) newErrors.insuredName = 'Please select an insured from the list';
    if (!form.productId) newErrors.productName = 'Please select a product from the list';
    if (!form.inceptionDate) newErrors.inceptionDate = 'Required';
    if (!form.expiryDate) newErrors.expiryDate = 'Required';
    if ((form.channel === 'Broker' || form.channel === 'Agent') && !form.intermediaryEntityId) {
      newErrors.intermediaryName = 'Please select from the list';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); toast.error('Please fill in all required fields'); return; }
    setErrors({});
    setSaving(true);

    try {
      if (!supabase) throw new Error('Database not connected');

      // Build deductible text summary
      const deductibleText = form.deductibles
        .filter(d => d.description || d.amount > 0)
        .map(d => `${d.description}: ${d.percentage}% / ${fmtNum(d.amount)} ${form.currency}`)
        .join('; ');

      // Build installments JSON
      const installmentsJson = form.paymentType === 'installments'
        ? form.installments.map(i => ({ number: i.number, amount: i.amount, dueDate: i.dueDate, status: i.status }))
        : [];

      const policyData = {
        insuredName: form.insuredName,
        insuredCountry: form.insuredCountry,
        industry: form.sector,
        classOfInsurance: form.classCodes.join(', '),
        typeOfInsurance: form.productName,
        channel: form.channel === 'Direct' ? 'Direct' : 'Direct',
        intermediaryType: form.channel,
        intermediaryName: form.channel !== 'Direct' ? form.intermediaryName : null,
        currency: form.currency,
        exchangeRate: form.exchangeRate,
        sumInsured: form.totalSumInsured,
        sumInsuredNational: form.totalSumInsured * form.exchangeRate,
        limitForeignCurrency: form.limitOfLiability,
        limitNationalCurrency: form.limitOfLiability * form.exchangeRate,
        inceptionDate: form.inceptionDate,
        expiryDate: form.expiryDate,
        // Premium fields
        premiumRate: form.premiumRate,
        grossPremium: form.grossPremium,
        premiumNationalCurrency: form.grossPremium * form.exchangeRate,
        commissionPercent: form.commissionPercent,
        netPremium: form.netPremium,
        deductible: deductibleText || null,
        // Payment
        paymentStatus: PaymentStatus.PENDING,
        paymentDate: form.paymentType === 'lump_sum' ? form.lumpSumDueDate || null : null,
        installments: installmentsJson,
        // Meta
        status: PolicyStatus.DRAFT,
        recordType: 'Direct',
        ourShare: 100,
        isDeleted: false,
      };

      const { error } = await supabase.from('policies').insert(policyData);
      if (error) throw error;

      toast.success('Request saved as draft');
      onSave();
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────
  const sumInsuredFields = form.coverSections?.sumInsured || [];

  return (
    <div className="space-y-5 pb-24">
      {/* ══════ Section 1: Insured Party ══════ */}
      <SectionCard number={1} title="Insured Party" icon={<Users size={16} />}>
        <SearchableDropdown
          label="Insured Name" value={form.insuredName} options={insuredOptions}
          onSelect={handleInsuredSelect}
          onClear={() => updateForm({ insuredName: '', insuredEntityId: undefined, sector: '', insuredCountry: '' })}
          required placeholder="Search for insured entity..." loading={entitiesLoading} error={errors.insuredName}
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Sector / Industry</label>
            <input type="text" value={form.sector} onChange={(e) => updateForm({ sector: e.target.value })}
              placeholder="e.g. Oil & Gas, Agriculture..."
              style={{ width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <SearchableDropdown
            label="Country" value={form.insuredCountry} options={countryOptions}
            onSelect={(_id, label) => updateForm({ insuredCountry: label })}
            onClear={() => updateForm({ insuredCountry: '' })}
            placeholder="Select country..."
          />
        </div>
      </SectionCard>

      {/* ══════ Section 2: Insurance Cover ══════ */}
      <SectionCard number={2} title="Insurance Cover" icon={<Shield size={16} />}>
        <ProductSearch value={form.productName} onSelect={handleProductSelect}
          onClear={() => updateForm({ productName: '', productId: undefined, classCodes: [], coverSections: null })}
          error={errors.productName} />
        {form.classCodes.length > 0 && (
          <div>
            <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Class of Insurance</label>
            <div className="flex flex-wrap gap-2">
              {form.classCodes.map(code => (
                <span key={code} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: t.accentMuted, color: t.accent, border: `1px solid ${t.accentMuted}` }}>
                  Class {code} — {INSURANCE_CLASSES[code] || 'Unknown'}
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ══════ Section 3: Channel & Intermediary ══════ */}
      <SectionCard number={3} title="Channel & Intermediary" icon={<Layers size={16} />}>
        <div>
          <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Channel <span style={{ color: t.danger }}>*</span></label>
          <select value={form.channel} onChange={(e) => updateForm({ channel: e.target.value as any, intermediaryName: '', intermediaryEntityId: undefined })}
            style={{ width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
            <option value="Direct">Direct</option>
            <option value="Broker">Broker</option>
            <option value="Agent">Agent</option>
          </select>
        </div>
        {(form.channel === 'Broker' || form.channel === 'Agent') && (
          <SearchableDropdown
            label={`${form.channel} Name`} value={form.intermediaryName} options={intermediaryOptions}
            onSelect={handleIntermediarySelect}
            onClear={() => updateForm({ intermediaryName: '', intermediaryEntityId: undefined })}
            required placeholder={`Search for ${form.channel.toLowerCase()}...`}
            loading={entitiesLoading} error={errors.intermediaryName}
          />
        )}
      </SectionCard>

      {/* ══════ Section 4: Sums Insured ══════ */}
      <SectionCard number={4} title="Sums Insured" icon={<DollarSign size={16} />}>
        <div className="flex items-center gap-4">
          <div>
            <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Currency</label>
            <select value={form.currency} onChange={(e) => updateForm({ currency: e.target.value })}
              style={{ padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 100 }}>
              {Object.values(Currency).map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          {fxDisplay && (
            <div className="mt-5 px-3 py-1.5 rounded-lg" style={{ fontSize: 12, color: t.text4, background: t.bgInput, border: `1px solid ${t.border}` }}>
              Exchange rate: {fxDisplay}
            </div>
          )}
        </div>

        {sumInsuredFields.length > 0 ? (
          <div className="space-y-3 mt-2">
            {sumInsuredFields.map(field => (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center gap-3">
                  <label className="w-48 shrink-0" style={{ fontSize: 13, color: t.text2 }}>{field.label}</label>
                  <CurrencyInput currency={form.currency} value={form.sumInsuredAmounts[field.key] || 0} onChange={(v) => setAmount(field.key, v)} />
                </div>
                {field.toggles?.map(toggle => (
                  <div key={toggle.key} className="ml-6 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: t.text2 }}>
                      <input type="checkbox" checked={form.sumInsuredToggles[toggle.key] || false}
                        onChange={(e) => setToggle(toggle.key, e.target.checked)}
                        className="rounded" style={{ borderColor: t.border }} />
                      {toggle.label}
                    </label>
                    {form.sumInsuredToggles[toggle.key] && (
                      <div className="flex items-center gap-3 ml-6">
                        <span style={{ color: t.text5, fontSize: 12 }}>├</span>
                        <label className="w-48 shrink-0" style={{ fontSize: 13, color: t.text2 }}>{toggle.label}</label>
                        <CurrencyInput currency={form.currency} value={form.sumInsuredAmounts[toggle.key] || 0} onChange={(v) => setAmount(toggle.key, v)} />
                      </div>
                    )}
                  </div>
                ))}
                {field.hasSubLimits && field.subLimits?.map(sub => (
                  <div key={sub.key} className="flex items-center gap-3 ml-6">
                    <span style={{ color: t.text5, fontSize: 12 }}>├</span>
                    <label className="w-48 shrink-0" style={{ fontSize: 13, color: t.text2 }}>{sub.label}</label>
                    <CurrencyInput currency={form.currency} value={form.sumInsuredAmounts[sub.key] || 0} onChange={(v) => setAmount(sub.key, v)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <label className="w-48 shrink-0" style={{ fontSize: 13, color: t.text2 }}>Sum Insured</label>
            <CurrencyInput currency={form.currency} value={form.totalSumInsured} onChange={(v) => updateForm({ totalSumInsured: v, totalSumInsuredManual: true })} />
          </div>
        )}

        <div className="flex items-center gap-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
          <label className="font-semibold w-48 shrink-0" style={{ fontSize: 13, color: t.text1 }}>Total Sum Insured</label>
          <CurrencyInput currency={form.currency} value={form.totalSumInsured}
            onChange={(v) => updateForm({ totalSumInsured: v, totalSumInsuredManual: true })}
            bold />
        </div>
      </SectionCard>

      {/* ══════ Section 5: Limit of Liability ══════ */}
      <SectionCard number={5} title="Limit of Liability" icon={<Lock size={16} />}>
        <div className="flex items-center gap-3">
          <label className="w-48 shrink-0" style={{ fontSize: 13, color: t.text2 }}>Limit of Liability</label>
          <CurrencyInput currency={form.currency} value={form.limitOfLiability} onChange={(v) => updateForm({ limitOfLiability: v })} />
        </div>
      </SectionCard>

      {/* ══════ Section 6: Insurance Period ══════ */}
      <SectionCard number={6} title="Insurance Period" icon={<Clock size={16} />}>
        <div className="grid grid-cols-3 gap-4">
          <DatePickerInput label="Inception Date" value={parseDate(form.inceptionDate)}
            onChange={(d) => updateForm({ inceptionDate: toISODateString(d) || '' })} required />
          <DatePickerInput label="Expiry Date" value={parseDate(form.expiryDate)}
            onChange={(d) => updateForm({ expiryDate: toISODateString(d) || '' })} required
            minDate={parseDate(form.inceptionDate) || undefined} />
          <div>
            <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Duration</label>
            <div className="p-2.5 rounded-lg font-medium" style={{ background: t.bgInput, border: `1px solid ${t.border}`, fontSize: 13, color: t.text1 }}>
              {durationDays ? `${durationDays} days` : '—'}
            </div>
          </div>
        </div>
        {errors.inceptionDate && <p className="text-xs" style={{ color: t.danger }}>{errors.inceptionDate}</p>}
        {errors.expiryDate && <p className="text-xs" style={{ color: t.danger }}>{errors.expiryDate}</p>}
      </SectionCard>

      {/* ══════ Section 7: Deductibles ══════ */}
      <SectionCard number={7} title="Deductibles" icon={<Percent size={16} />}>
        <div className="space-y-3">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-3 px-3">
            <div className="col-span-5 text-xs font-medium" style={{ color: t.text4 }}>Type / Description</div>
            <div className="col-span-3 text-xs font-medium" style={{ color: t.text4 }}>Percentage</div>
            <div className="col-span-4 text-xs font-medium" style={{ color: t.text4 }}>Amount</div>
          </div>
          {form.deductibles.map((ded) => (
            <div key={ded.id} className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-12 gap-3 p-3 rounded-lg" style={{ background: t.bgInput, border: `1px solid ${t.border}` }}>
                {/* Description */}
                <div className="col-span-5">
                  <input type="text" value={ded.description}
                    onChange={(e) => updateDeductible(ded.id, 'description', e.target.value)}
                    placeholder="e.g. All Perils, Fire, Flood..."
                    style={{ width: '100%', padding: '8px 12px', background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                {/* Percentage */}
                <div className="col-span-3">
                  <div className="relative">
                    <input type="text" inputMode="numeric"
                      value={ded.percentage || ''}
                      onChange={(e) => updateDeductible(ded.id, 'percentage', parseNum(e.target.value))}
                      placeholder="0"
                      className="w-full text-right"
                      style={{ padding: '8px 32px 8px 8px', background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ fontSize: 12, color: t.text4 }}>%</span>
                  </div>
                </div>
                {/* Amount */}
                <div className="col-span-4">
                  <CurrencyInput currency={form.currency} value={ded.amount} onChange={(v) => updateDeductible(ded.id, 'amount', v)} />
                </div>
              </div>
              {/* Remove button */}
              {form.deductibles.length > 1 ? (
                <button onClick={() => removeDeductible(ded.id)}
                  className="p-1.5 rounded-lg transition-colors shrink-0" style={{ color: t.text4 }}>
                  <Trash2 size={14} />
                </button>
              ) : <div className="w-8 shrink-0" />}
            </div>
          ))}
        </div>
        <button onClick={addDeductible}
          className="flex items-center gap-1.5 font-medium mt-1" style={{ fontSize: 13, color: t.accent }}>
          <Plus size={14} /> Add Deductible
        </button>
        {(form.totalSumInsured > 0 || form.limitOfLiability > 0) && (
          <p className="text-xs mt-1" style={{ color: t.text4 }}>
            Auto-calculation basis: {form.totalSumInsured > 0 ? `Total SI ${fmtNum(form.totalSumInsured)}` : `LoL ${fmtNum(form.limitOfLiability)}`} {form.currency}
          </p>
        )}
      </SectionCard>

      {/* ══════ Section 8: Insurance Premium ══════ */}
      <SectionCard number={8} title="Insurance Premium" icon={<FileText size={16} />}>
        {/* Sub-premiums (if cover sections have amounts) */}
        {form.subPremiums.length > 0 && (
          <div className="space-y-2 mb-4">
            <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, display: 'block' }}>Sub-Premiums</label>
            {/* Header row */}
            <div className="grid grid-cols-12 gap-3 px-3">
              <div className="col-span-4 text-xs font-medium" style={{ color: t.text4 }}>Cover Section</div>
              <div className="col-span-2 text-xs font-medium" style={{ color: t.text4 }}>Rate</div>
              <div className="col-span-1" />
              <div className="col-span-4 text-xs font-medium" style={{ color: t.text4 }}>Premium Amount</div>
              <div className="col-span-1 text-xs font-medium" style={{ color: t.text4 }}>Basis</div>
            </div>
            <div className="space-y-2">
              {form.subPremiums.map(sub => (
                <div key={sub.key} className="grid grid-cols-12 gap-3 items-center p-2.5 rounded-lg" style={{ background: t.bgInput, border: `1px solid ${t.border}` }}>
                  <label className="col-span-4 truncate" style={{ fontSize: 13, color: t.text2 }} title={sub.label}>{sub.label}</label>
                  <div className="col-span-2 relative">
                    <input type="text" inputMode="numeric"
                      value={sub.rate || ''}
                      onChange={(e) => updateSubPremium(sub.key, 'rate', parseNum(e.target.value))}
                      placeholder="0"
                      className="w-full text-right"
                      style={{ padding: '8px 28px 8px 8px', background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ fontSize: 12, color: t.text4 }}>%</span>
                  </div>
                  <span className="col-span-1 text-xs text-center" style={{ color: t.text5 }}>=</span>
                  <div className="col-span-4">
                    <CurrencyInput currency={form.currency} value={sub.amount} onChange={(v) => updateSubPremium(sub.key, 'amount', v)} />
                  </div>
                  <span className="col-span-1 text-xs truncate" style={{ color: t.text4 }} title={`of ${fmtNum(sub.basis)}`}>
                    of {fmtNum(sub.basis)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gross Premium */}
        <div className="grid grid-cols-12 gap-3 items-center">
          <label className="col-span-4 font-semibold" style={{ fontSize: 13, color: t.text1 }}>Gross Premium</label>
          <div className="col-span-2 relative">
            <input type="text" inputMode="numeric"
              value={form.premiumRate || ''}
              onChange={(e) => {
                const rate = parseNum(e.target.value);
                const basis = form.totalSumInsured || form.limitOfLiability || 0;
                const amount = basis > 0 ? Math.round(basis * (rate / 100) * 100) / 100 : 0;
                updateForm({ premiumRate: rate, grossPremium: amount, grossPremiumManual: false });
              }}
              placeholder="0"
              className="w-full text-right"
              style={{ padding: '8px 28px 8px 8px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ fontSize: 12, color: t.text4 }}>%</span>
          </div>
          <span className="col-span-1 text-xs text-center" style={{ color: t.text5 }}>=</span>
          <div className="col-span-5">
            <CurrencyInput currency={form.currency} value={form.grossPremium}
              onChange={(v) => {
                const basis = form.totalSumInsured || form.limitOfLiability || 0;
                const rate = basis > 0 ? Math.round((v / basis) * 10000) / 100 : 0;
                updateForm({ grossPremium: v, premiumRate: rate, grossPremiumManual: true });
              }}
              bold />
          </div>
        </div>

        {/* Commission */}
        <div className="grid grid-cols-12 gap-3 items-center pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
          <label className="col-span-4" style={{ fontSize: 13, color: t.text2 }}>Commission</label>
          <div className="col-span-2 relative">
            <input type="text" inputMode="numeric"
              value={form.commissionPercent || ''}
              onChange={(e) => updateForm({ commissionPercent: parseNum(e.target.value) })}
              placeholder="0"
              className="w-full text-right"
              style={{ padding: '8px 28px 8px 8px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ fontSize: 12, color: t.text4 }}>%</span>
          </div>
          <span className="col-span-1 text-xs text-center" style={{ color: t.text5 }}>=</span>
          <div className="col-span-5 relative">
            <div className="w-full p-2 pr-16 rounded-lg text-right" style={{ background: t.bgInput, border: `1px solid ${t.border}`, fontSize: 13, color: t.text1 }}>
              {fmtNum(form.commissionAmount) || '0'}
            </div>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded select-none pointer-events-none" style={{ fontSize: 11, fontWeight: 500, color: t.text4, background: t.bgHover }}>
              {form.currency}
            </span>
          </div>
        </div>

        {/* Net Premium */}
        <div className="grid grid-cols-12 gap-3 items-center pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
          <label className="col-span-4 font-semibold" style={{ fontSize: 13, color: t.text1 }}>Net Premium</label>
          <div className="col-span-2" />
          <span className="col-span-1" />
          <div className="col-span-5 relative">
            <div className="w-full p-2 pr-16 rounded-lg text-right font-bold" style={{ background: t.successBg, border: `2px solid ${t.success}`, fontSize: 13, color: t.success }}>
              {fmtNum(form.netPremium) || '0'}
            </div>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded select-none pointer-events-none" style={{ fontSize: 11, fontWeight: 700, color: t.success, background: t.successBg }}>
              {form.currency}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ══════ Section 9: Payment Terms ══════ */}
      <SectionCard number={9} title="Payment Terms" icon={<CreditCard size={16} />}>
        {/* Payment type toggle */}
        <div>
          <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block' }}>Payment Type</label>
          <div className="inline-flex rounded-lg overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            <button
              onClick={() => updateForm({ paymentType: 'lump_sum', installments: [] })}
              className="px-4 py-2 font-medium transition-colors"
              style={{ fontSize: 13, background: form.paymentType === 'lump_sum' ? t.accent : t.bgPanel, color: form.paymentType === 'lump_sum' ? '#fff' : t.text2 }}
            >
              Lump Sum
            </button>
            <button
              onClick={() => {
                if (form.installments.length === 0) {
                  // Auto-create 2 installment rows
                  updateForm({
                    paymentType: 'installments',
                    installments: [
                      { id: uid(), number: 1, amount: 0, dueDate: '', status: 'Pending' as const },
                      { id: uid(), number: 2, amount: 0, dueDate: '', status: 'Pending' as const },
                    ],
                  });
                } else {
                  updateForm({ paymentType: 'installments' });
                }
              }}
              className="px-4 py-2 font-medium transition-colors"
              style={{ fontSize: 13, borderLeft: `1px solid ${t.border}`, background: form.paymentType === 'installments' ? t.accent : t.bgPanel, color: form.paymentType === 'installments' ? '#fff' : t.text2 }}
            >
              Installments
            </button>
          </div>
        </div>

        {form.paymentType === 'lump_sum' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Amount</label>
              <div className="relative">
                <div className="w-full p-2.5 pr-16 rounded-lg text-right font-medium" style={{ background: t.bgInput, border: `1px solid ${t.border}`, fontSize: 13, color: t.text1 }}>
                  {fmtNum(form.grossPremium) || '0'}
                </div>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded select-none pointer-events-none" style={{ fontSize: 11, fontWeight: 500, color: t.text4, background: t.bgHover }}>
                  {form.currency}
                </span>
              </div>
            </div>
            <DatePickerInput label="Due Date" value={parseDate(form.lumpSumDueDate)}
              onChange={(d) => updateForm({ lumpSumDueDate: toISODateString(d) || '' })} />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Column headers */}
            <div className="grid grid-cols-12 gap-3 px-3">
              <div className="col-span-1" />
              <div className="col-span-4 text-xs font-medium" style={{ color: t.text4 }}>Amount</div>
              <div className="col-span-4 text-xs font-medium" style={{ color: t.text4 }}>Due Date</div>
              <div className="col-span-2 text-xs font-medium" style={{ color: t.text4 }}>Status</div>
              <div className="col-span-1" />
            </div>

            {/* Installment rows */}
            {form.installments.map((inst) => (
              <div key={inst.id} className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg" style={{ background: t.bgInput, border: `1px solid ${t.border}` }}>
                <span className="col-span-1 text-xs font-bold text-center" style={{ color: t.text4 }}>#{inst.number}</span>
                <div className="col-span-4">
                  <CurrencyInput currency={form.currency} value={inst.amount}
                    onChange={(v) => updateInstallment(inst.id, 'amount', v)} />
                </div>
                <div className="col-span-4">
                  <DatePickerInput value={parseDate(inst.dueDate)}
                    onChange={(d) => updateInstallment(inst.id, 'dueDate', toISODateString(d) || '')} />
                </div>
                <div className="col-span-2">
                  <select value={inst.status}
                    onChange={(e) => updateInstallment(inst.id, 'status', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div className="col-span-1 flex justify-center">
                  <button onClick={() => removeInstallment(inst.id)}
                    className="p-1.5 rounded-lg transition-colors" style={{ color: t.text4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Actions row */}
            <div className="flex items-center gap-3">
              <button onClick={addInstallment}
                className="flex items-center gap-1.5 font-medium" style={{ fontSize: 13, color: t.accent }}>
                <Plus size={14} /> Add Installment
              </button>
              {form.installments.length >= 2 && form.grossPremium > 0 && (
                <button onClick={splitEqual}
                  className="flex items-center gap-1.5 font-medium ml-4" style={{ fontSize: 13, color: t.text4 }}>
                  Split Equally
                </button>
              )}
            </div>

            {/* Mismatch warning */}
            {installmentMismatch && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: t.warningBg, border: `1px solid ${t.warning}`, fontSize: 13, color: t.warning }}>
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  Installments total <strong>{fmtNum(installmentTotal)} {form.currency}</strong> ≠ Gross Premium <strong>{fmtNum(form.grossPremium)} {form.currency}</strong>
                  {' '}(difference: {fmtNum(Math.abs(installmentTotal - form.grossPremium))})
                </span>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ══════ Sticky Footer ══════ */}
      <div className="sticky bottom-0 z-50" style={{ background: t.bgPanel, borderTop: `1px solid ${t.border}`, boxShadow: t.shadowLg, margin: '0 -28px', padding: '0 28px' }}>
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4" style={{ fontSize: 12, color: t.text4 }}>
            {form.productName && <span>Product: {form.productName}</span>}
            {form.totalSumInsured > 0 && <span>SI: {fmtNum(form.totalSumInsured)} {form.currency}</span>}
            {form.grossPremium > 0 && <span>Premium: {fmtNum(form.grossPremium)} {form.currency}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onCancel}
              className="px-4 py-2 font-medium rounded-lg transition-colors"
              style={{ fontSize: 13, color: t.text2, background: t.bgPanel, border: `1px solid ${t.border}` }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 font-semibold rounded-lg disabled:opacity-50 transition-colors"
              style={{ fontSize: 13, color: '#fff', background: t.accent, boxShadow: t.shadow }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save as Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
