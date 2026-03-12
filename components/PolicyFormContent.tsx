import React, { useState, useEffect, useRef } from 'react';
import { DB } from '../services/db';
import { Policy, Currency, PolicyStatus, PaymentStatus, Channel, IntermediaryType, PolicyReinsurer, Installment } from '../types';
import { formatDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
import { EntitySearchInput } from './EntitySearchInput';
import { formatSICDisplay } from '../data/sicCodes';
import { ContextBar } from './ContextBar';
import { Save, Building2, FileText, DollarSign, ShieldCheck, ArrowRightLeft, Upload, CheckCircle, XCircle, AlertCircle, Loader2, ChevronDown, Search, Users, Briefcase, Globe, Plus, Trash2, RefreshCw, CreditCard, Calendar } from 'lucide-react';
import { DatePickerInput, parseDate, toISODateString } from './DatePickerInput';
import { useTheme } from '../theme/useTheme';

// --- DATASETS FOR AUTOCOMPLETE ---
const UZBEK_REGIONS = [
  "Tashkent City", "Tashkent Region", "Andijan", "Bukhara", "Fergana", "Jizzakh",
  "Namangan", "Navoiy", "Qashqadaryo", "Samarkand", "Sirdaryo", "Surxondaryo", "Xorazm", "Republic of Karakalpakstan"
];

const COUNTRIES = [
  "Uzbekistan", "Kazakhstan", "Russia", "Turkey", "United Arab Emirates",
  "United Kingdom", "USA", "China", "Germany", "Switzerland", "France", "Singapore"
];

const INSURANCE_CLASSES = [
  "01 - Accident", "02 - Sickness", "03 - Land Vehicles (KASKO)", "04 - Railway Rolling Stock",
  "05 - Aircraft", "06 - Ships", "07 - Goods in Transit (Cargo)", "08 - Fire and Natural Forces",
  "09 - Other Damage to Property", "10 - Motor Vehicle Liability (CMTPL)", "11 - Aircraft Liability",
  "12 - Ships Liability", "13 - General Liability", "14 - Credit", "15 - Suretyship",
  "16 - Miscellaneous Financial Loss", "17 - Legal Expenses", "18 - Assistance"
];

const INSURANCE_TYPES = [
  "Voluntary Property Insurance", "Mandatory Motor Liability (OSGO)", "Voluntary Motor Insurance (KASKO)",
  "Construction All Risk (CAR)", "Erection All Risk (EAR)", "General Third Party Liability (GTPL)",
  "Employer's Liability", "Professional Indemnity", "Cargo Insurance", "Health Insurance",
  "Travel Insurance", "Banker's Blanket Bond (BBB)", "Cyber Insurance", "Directors & Officers (D&O)"
];

const INTERMEDIARIES = [
  "Marsh", "Aon", "Willis Towers Watson", "Arthur J. Gallagher", "Local Broker LLC", "Uzbek Insurance Broker", "Silk Road Broking"
];

// --- REUSABLE COMPONENTS ---

interface CurrencyInputProps {
    label: string;
    originalValue: number;
    nationalValue: number;
    currency: string;
    exchangeRate: number;
    onValueChange: (original: number, national: number) => void;
    disabled?: boolean;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ label, originalValue, nationalValue, currency, exchangeRate, onValueChange, disabled }) => {
    const { t } = useTheme();
    const [viewCurrency, setViewCurrency] = useState(currency);

    useEffect(() => {
        if (viewCurrency !== 'UZS') {
            setViewCurrency(currency);
        }
    }, [currency]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value === '' ? 0 : Number(e.target.value);

        if (viewCurrency === 'UZS') {
            const calcOriginal = exchangeRate > 0 ? val / exchangeRate : 0;
            onValueChange(calcOriginal, val);
        } else {
            const calcNational = val * exchangeRate;
            onValueChange(val, calcNational);
        }
    };

    const displayValue = viewCurrency === 'UZS' ? nationalValue : originalValue;
    const currencyOptions = Array.from(new Set([currency, 'UZS', 'USD', 'EUR']));

    return (
        <div>
            <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>{label}</label>
            <div style={{ display: 'flex', borderRadius: 8, boxShadow: t.shadow }}>
                <select
                    value={viewCurrency}
                    onChange={(e) => setViewCurrency(e.target.value)}
                    disabled={disabled}
                    style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px 0 0 8px', fontSize: 14, outline: 'none', minWidth: 80, border: `1px solid ${t.border}`, borderRight: 'none', background: t.bgInput, color: t.text3, fontWeight: 700 }}
                >
                    {currencyOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
                <input
                    type="number"
                    value={displayValue || ''}
                    onChange={handleAmountChange}
                    disabled={disabled}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="transition-all"
                    style={{ flex: 1, minWidth: 0, display: 'block', width: '100%', padding: '10px 12px', borderRadius: '0 8px 8px 0', outline: 'none', fontSize: 14, border: `1px solid ${t.border}`, color: t.text1, background: disabled ? t.bgInput : t.bgPanel }}
                />
            </div>
        </div>
    );
};

interface SearchableInputProps {
  label: string;
  name: string;
  value: string;
  options: string[];
  onChange: (e: { target: { name: string; value: string } }) => void;
  placeholder?: string;
  required?: boolean;
}

const SearchableInput: React.FC<SearchableInputProps> = ({ label, name, value, options, onChange, placeholder, required }) => {
  const { t } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(value?.toLowerCase() || '')
  );

  const handleSelect = (opt: string) => {
    onChange({ target: { name, value: opt } });
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    setIsOpen(true);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={wrapperRef}>
      <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          name={name}
          value={value || ''}
          onChange={handleInputChange}
          onClick={() => setIsOpen(true)}
          required={required}
          placeholder={placeholder || "Type to search..."}
          autoComplete="off"
          className="transition-all"
          style={{ width: '100%', padding: '10px 32px 10px 12px', borderRadius: 8, outline: 'none', fontSize: 14, background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text1 }}
        />
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', color: t.text5 }}>
          {isOpen ? <Search size={14}/> : <ChevronDown size={14}/>}
        </div>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul className="animate-in fade-in zoom-in-95 duration-100" style={{ position: 'absolute', zIndex: 50, width: '100%', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto', background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadowLg }}>
          {filteredOptions.map((opt) => (
            <li
              key={opt}
              onClick={() => handleSelect(opt)}
              style={{ padding: '8px 12px', fontSize: 14, cursor: 'pointer', color: t.text2, borderBottom: `1px solid ${t.borderL}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.bgHover; e.currentTarget.style.color = t.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.text2; }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


interface PolicyFormContentProps {
  id?: string;
  onSave: () => void;
  onCancel: () => void;
}

export const PolicyFormContent: React.FC<PolicyFormContentProps> = ({
  id,
  onSave,
  onCancel
}) => {
  const toast = useToast();
  const { t } = useTheme();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(true);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Initialize form data
  const [formData, setFormData] = useState<Policy>({
    id: crypto.randomUUID(),
    channel: 'Direct',
    intermediaryType: 'Direct',
    policyNumber: '',
    slipNumber: '',
    insuredName: '',
    insuredAddress: '',
    cedantName: '',
    intermediaryName: '',
    industry: '',
    territory: 'Uzbekistan',
    city: '',
    jurisdiction: 'Uzbekistan',
    classOfInsurance: '',
    typeOfInsurance: '',
    riskCode: '',
    currency: Currency.USD,
    sumInsured: 0,
    grossPremium: 0,
    commissionPercent: 0,
    taxPercent: 0,
    netPremium: 0,
    exchangeRate: 1,
    ourShare: 100,
    hasOutwardReinsurance: false,
    reinsurers: [],
    installments: [],
    cededShare: 0,
    cededPremiumForeign: 0,
    netReinsurancePremium: 0,
    reinsuranceCommission: 0,
    deductible: '',
    inceptionDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    issueDate: new Date().toISOString().split('T')[0],
    status: PolicyStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    selectedClauseIds: [],
    claims: []
  });

  useEffect(() => {
    const loadData = async () => {
      if (isEdit && id) {
        const policy = await DB.getPolicy(id);
        if (policy) {
          const loadedData = { ...policy };
          if ((policy as any).recordType) {
              if ((policy as any).recordType === 'Inward') loadedData.channel = 'Inward';
              else loadedData.channel = 'Direct';
          }
          if (!loadedData.reinsurers || loadedData.reinsurers.length === 0) {
              if (loadedData.reinsurerName && loadedData.hasOutwardReinsurance) {
                  loadedData.reinsurers = [{
                      id: crypto.randomUUID(),
                      name: loadedData.reinsurerName,
                      share: loadedData.cededShare || 0,
                      commission: loadedData.reinsuranceCommission || 0
                  }];
              } else {
                  loadedData.reinsurers = [];
              }
          }

          if (!loadedData.installments) {
              loadedData.installments = [];
          }

          setFormData({
            ...loadedData,
            intermediaryName: loadedData.intermediaryName || (loadedData as any).brokerName || '',
            territory: loadedData.territory || 'Uzbekistan'
          });
        } else {
          toast.error('Policy not found');
          onCancel();
        }
      } else {
        setFormData(prev => ({
           ...prev,
           policyNumber: `D/${new Date().getFullYear()}/${Math.floor(Math.random() * 1000)}`
        }));
      }
      setLoading(false);
    };
    loadData();
  }, [id, isEdit]);

  // Reactive Calculations (Premium & Reinsurance)
  useEffect(() => {
    const gross = formData.grossPremium || 0;
    const comm = formData.commissionPercent || 0;
    const tax = formData.taxPercent || 0;
    const net = gross - (gross * comm / 100) - (gross * tax / 100);

    let totalCededShare = 0;
    let totalCededPremium = 0;
    let totalCommissionAmount = 0;

    if (formData.reinsurers && formData.reinsurers.length > 0) {
        formData.reinsurers.forEach(r => {
            const rShare = r.share || 0;
            const rComm = r.commission || 0;
            const rPrem = gross * (rShare / 100);

            totalCededShare += rShare;
            totalCededPremium += rPrem;
            totalCommissionAmount += rPrem * (rComm / 100);
        });
    }

    const netReinsPayable = totalCededPremium - totalCommissionAmount;
    const avgComm = totalCededPremium > 0 ? (totalCommissionAmount / totalCededPremium) * 100 : 0;

    setFormData(prev => ({
        ...prev,
        netPremium: net,
        cededShare: totalCededShare,
        cededPremiumForeign: totalCededPremium,
        netReinsurancePremium: netReinsPayable,
        reinsuranceCommission: parseFloat(avgComm.toFixed(2))
    }));
  }, [formData.grossPremium, formData.commissionPercent, formData.taxPercent, formData.reinsurers]);

  // FX Rate Fetcher
  const handleFetchRate = async () => {
      if (formData.currency === 'UZS') {
          setFormData(prev => ({ ...prev, exchangeRate: 1 }));
          return;
      }
      const rate = await DB.getLatestExchangeRate(formData.currency);
      setFormData(prev => ({ ...prev, exchangeRate: rate }));
  };

  const handleChange = (e: { target: { name: string; value: string | boolean | number } }) => {
    const { name, value } = e.target;

    const numericFields = [
        'sumInsured', 'sumInsuredNational', 'grossPremium', 'premiumNationalCurrency',
        'exchangeRate', 'commissionPercent', 'taxPercent', 'ourShare',
        'limitForeignCurrency', 'limitNationalCurrency', 'excessForeignCurrency', 'prioritySum',
        'premiumRate', 'warrantyPeriod', 'numberOfSlips',
        'treatyPremium', 'aicCommission', 'aicRetention', 'aicPremium', 'maxRetentionPerRisk',
        'sumReinsuredForeign', 'sumReinsuredNational', 'receivedPremiumForeign', 'receivedPremiumNational'
    ];

    setFormData(prev => ({
      ...prev,
      [name]: numericFields.includes(name) ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  const updateCurrencyField = (keyOriginal: keyof Policy, keyNational: keyof Policy, original: number, national: number) => {
      setFormData(prev => ({
          ...prev,
          [keyOriginal]: original,
          [keyNational]: national
      }));
  };

  const handleChannelChange = (newChannel: Channel) => {
      setFormData(prev => ({
          ...prev,
          channel: newChannel,
          policyNumber: `${newChannel === 'Direct' ? 'D' : 'IN'}/${new Date().getFullYear()}/${Math.floor(Math.random() * 1000)}`
      }));
  };

  const handleIntermediaryChange = (type: IntermediaryType) => {
      setFormData(prev => ({ ...prev, intermediaryType: type }));
  };

  const handleDateChange = (name: string, date: Date | null) => {
      setFormData(prev => ({ ...prev, [name]: toISODateString(date) || '' }));
  };

  // Reinsurance Handlers
  const handleReinsurerChange = (index: number, field: keyof PolicyReinsurer, value: any) => {
      const updated = [...(formData.reinsurers || [])];
      updated[index] = { ...updated[index], [field]: value };
      setFormData(prev => ({ ...prev, reinsurers: updated }));
  };

  const addReinsurer = () => {
      setFormData(prev => ({
          ...prev,
          reinsurers: [...(prev.reinsurers || []), { id: crypto.randomUUID(), name: '', share: 0, commission: 0 }]
      }));
  };

  const removeReinsurer = (index: number) => {
      const updated = [...(formData.reinsurers || [])];
      updated.splice(index, 1);
      setFormData(prev => ({ ...prev, reinsurers: updated }));
  };

  // Installment Handlers
  const handleInstallmentChange = (index: number, field: keyof Installment, value: any) => {
      const updated = [...(formData.installments || [])];
      updated[index] = { ...updated[index], [field]: value };
      setFormData(prev => ({ ...prev, installments: updated }));
  };

  const handleInstallmentDateChange = (index: number, field: keyof Installment, date: Date | null) => {
      const updated = [...(formData.installments || [])];
      updated[index] = { ...updated[index], [field]: toISODateString(date) || '' };
      setFormData(prev => ({ ...prev, installments: updated }));
  };

  const addInstallment = () => {
      setFormData(prev => ({
          ...prev,
          installments: [...(prev.installments || []), {
              id: crypto.randomUUID(),
              dueDate: '',
              dueAmount: 0,
              paidAmount: 0
          }]
      }));
  };

  const removeInstallment = (index: number) => {
      const updated = [...(formData.installments || [])];
      updated.splice(index, 1);
      setFormData(prev => ({ ...prev, installments: updated }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Workflow Actions
  const doActivate = async () => {
    setProcessingAction('activate');
    try {
        const updatedData = { ...formData, status: PolicyStatus.ACTIVE, activationDate: new Date().toISOString() };
        if (selectedFile) {
            updatedData.signedDocument = {
                fileName: selectedFile.name,
                uploadDate: new Date().toISOString(),
                url: URL.createObjectURL(selectedFile)
            };
        }
        await DB.savePolicy(updatedData);
        toast.success('Policy activated!');
        onSave();
    } catch (error: any) {
        console.error(error);
        toast.error(`Failed to activate: ${error.message || 'Unknown error'}`);
    } finally { setProcessingAction(null); }
  };

  const handleActivate = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedFile && !formData.signedDocument) {
        setShowActivateConfirm(true);
        return;
    }
    doActivate();
  };

  const handleNTU = async (e: React.MouseEvent) => {
    e.preventDefault();
    setProcessingAction('ntu');
    try {
        await DB.savePolicy({ ...formData, status: PolicyStatus.NTU });
        toast.success('Policy marked as NTU');
        onSave();
    } catch (error: any) { console.error(error); toast.error(`Failed: ${error.message}`); } finally { setProcessingAction(null); }
  };

  const handlePolicyCancel = async (e: React.MouseEvent) => {
    e.preventDefault();
    setProcessingAction('cancel');
    try {
        await DB.savePolicy({ ...formData, status: PolicyStatus.CANCELLED });
        toast.success('Policy cancelled');
        onSave();
    } catch (error: any) { console.error(error); toast.error(`Failed: ${error.message}`); } finally { setProcessingAction(null); }
  };

  const handleSubmit = async () => {
    setProcessingAction('save');
    try {
        await DB.savePolicy(formData);
        toast.success(isEdit ? 'Policy updated!' : 'Policy created!');
        onSave();
    } catch (error: any) {
        console.error(error);
        toast.error(`Failed to save: ${error.message || 'Check console for details.'}`);
    } finally { setProcessingAction(null); }
  };

  const totalInstallmentsDue = formData.installments?.reduce((acc, curr) => acc + (curr.dueAmount || 0), 0) || 0;
  const totalInstallmentsPaid = formData.installments?.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0) || 0;

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: t.text4 }}>Loading...</div>;

  const sectionTitleStyle: React.CSSProperties = { color: t.text1, fontSize: 15, fontWeight: 600, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${t.borderL}`, display: 'flex', alignItems: 'center', gap: 8 };
  const labelStyle: React.CSSProperties = { color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' };
  const selectStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' };
  const sectionCardStyle: React.CSSProperties = { background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 20, boxShadow: t.shadow };

  const priorityCurrencies = ['UZS', 'USD', 'EUR'];
  const allCurrencies = Object.values(Currency);
  const sortedCurrencies = [
      ...priorityCurrencies,
      ...allCurrencies.filter(c => !priorityCurrencies.includes(c)).sort()
  ];

  return (
    <div>
      {/* Context Bar */}
      <ContextBar
        status={formData.status || 'Pending'}
        breadcrumbs={[
          { label: 'Policies', href: '/' },
          { label: isEdit ? (formData.policyNumber || 'Edit Policy') : 'New Policy' }
        ]}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24 }}>

            {/* Left Column (Main Data) */}
            <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* 1. Channel & Intermediary */}
                <div style={{ ...sectionCardStyle, borderRadius: 12, padding: 24 }}>
                    <h3 style={sectionTitleStyle}><ArrowRightLeft size={18} style={{ color: t.accent }}/> Business Channel & Source</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 16 }}>
                        <div>
                            <label style={labelStyle}>Business Channel</label>
                            <div style={{ display: 'flex', padding: 4, borderRadius: 8, background: t.bgInput }}>
                                <button type="button" onClick={() => handleChannelChange('Direct')} className="transition-all" style={{ flex: 1, padding: '8px 0', fontSize: 14, borderRadius: 6, background: formData.channel === 'Direct' ? t.bgPanel : 'transparent', color: formData.channel === 'Direct' ? t.accent : t.text4, boxShadow: formData.channel === 'Direct' ? t.shadow : 'none', fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                                    Direct Insurance
                                </button>
                                <button type="button" onClick={() => handleChannelChange('Inward')} className="transition-all" style={{ flex: 1, padding: '8px 0', fontSize: 14, borderRadius: 6, background: formData.channel === 'Inward' ? t.bgPanel : 'transparent', color: formData.channel === 'Inward' ? '#9333ea' : t.text4, boxShadow: formData.channel === 'Inward' ? t.shadow : 'none', fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                                    Inward Reinsurance
                                </button>
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Intermediary Source</label>
                            <select
                                value={formData.intermediaryType}
                                onChange={(e) => handleIntermediaryChange(e.target.value as IntermediaryType)}
                                style={selectStyle}
                            >
                                <option value="Direct">Direct Client (No Intermediary)</option>
                                <option value="Broker">Insurance Broker</option>
                                <option value="Agent">Insurance Agent</option>
                                <option value="MGA">MGA / Partner</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                        {formData.intermediaryType !== 'Direct' && (
                            <div className="animate-in fade-in slide-in-from-top-1">
                                <SearchableInput
                                    label={`${formData.intermediaryType} Name`}
                                    name="intermediaryName"
                                    value={formData.intermediaryName || ''}
                                    options={INTERMEDIARIES}
                                    onChange={handleChange}
                                    placeholder={`Select or type ${formData.intermediaryType} name...`}
                                    required
                                />
                            </div>
                        )}

                        {formData.channel === 'Inward' && (
                            <div className="animate-in fade-in slide-in-from-top-1">
                                <label style={labelStyle}>Cedant (Reinsured) Name</label>
                                <input type="text" name="cedantName" value={formData.cedantName || ''} onChange={handleChange} style={{ ...inputStyle, borderColor: '#c084fc', background: '#faf5ff' }} placeholder="Company sending the risk"/>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Risk & Core Details */}
                <div style={{ ...sectionCardStyle, borderRadius: 12, padding: 24 }}>
                    <h3 style={sectionTitleStyle}><Building2 size={18} style={{ color: t.accent }}/> Risk Details</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                        <div style={{ gridColumn: 'span 2' }}>
                             <EntitySearchInput
                                label="Original Insured Name (Legal Entity)"
                                value={formData.insuredName || ''}
                                onChange={(name, entityId) => setFormData(prev => ({ ...prev, insuredName: name, insuredEntityId: entityId }))}
                                onEntitySelect={(entity) => {
                                    setFormData(prev => ({ ...prev, insuredName: entity.fullName, insuredEntityId: entity.id }));
                                    if (entity.sicCode) setFormData(prev => ({ ...prev, insuredSicCode: entity.sicCode, insuredSicSection: entity.sicSection || '' }));
                                }}
                                placeholder="Search for legal entity..."
                                required
                            />
                            {formData.insuredSicCode && (
                                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '6px 12px', fontSize: 12, background: t.bgInput, border: `1px solid ${t.border}` }}>
                                    <span style={{ color: t.text5 }}>Industry:</span>
                                    <span style={{ color: t.text2 }}>{formatSICDisplay(formData.insuredSicCode)}</span>
                                </div>
                            )}
                        </div>

                        <SearchableInput
                            label="Territory (Country)"
                            name="territory"
                            value={formData.territory || 'Uzbekistan'}
                            options={COUNTRIES}
                            onChange={handleChange}
                        />

                        <SearchableInput
                            label="City / Region"
                            name="city"
                            value={formData.city || ''}
                            options={UZBEK_REGIONS}
                            onChange={handleChange}
                        />

                        <div>
                            <label style={labelStyle}>Industry / Business</label>
                            <input type="text" name="industry" value={formData.industry || ''} onChange={handleChange} style={inputStyle}/>
                        </div>

                        <div>
                             <SearchableInput
                                label="Type / Product"
                                name="typeOfInsurance"
                                value={formData.typeOfInsurance || ''}
                                options={INSURANCE_TYPES}
                                onChange={handleChange}
                            />
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                            <SearchableInput
                                label="Class of Insurance"
                                name="classOfInsurance"
                                value={formData.classOfInsurance || ''}
                                options={INSURANCE_CLASSES}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                             <label style={labelStyle}>Risk Code</label>
                             <input type="text" name="riskCode" value={formData.riskCode || ''} onChange={handleChange} style={inputStyle} placeholder="e.g. 03.11"/>
                        </div>
                        <div>
                             <label style={labelStyle}>Jurisdiction</label>
                             <input type="text" name="jurisdiction" value={formData.jurisdiction || 'Uzbekistan'} onChange={handleChange} style={inputStyle}/>
                        </div>
                         <div style={{ gridColumn: 'span 2' }}>
                             <label style={labelStyle}>Insured Risk / Object</label>
                             <input type="text" name="insuredRisk" value={formData.insuredRisk || ''} onChange={handleChange} style={inputStyle} placeholder="Detailed description of the risk"/>
                        </div>
                    </div>
                </div>

                {/* 3. Extended Parties */}
                <div style={{ ...sectionCardStyle, borderRadius: 12, padding: 24 }}>
                    <h3 style={sectionTitleStyle}><Users size={18} style={{ color: t.accent }}/> Additional Parties</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                         <div>
                            <label style={labelStyle}>Insured Address</label>
                            <input type="text" name="insuredAddress" value={formData.insuredAddress || ''} onChange={handleChange} style={inputStyle}/>
                         </div>
                         <div>
                            <label style={labelStyle}>Borrower (Loan)</label>
                            <input type="text" name="borrower" value={formData.borrower || ''} onChange={handleChange} style={inputStyle}/>
                         </div>
                         <div>
                            <label style={labelStyle}>Retrocedent</label>
                            <input type="text" name="retrocedent" value={formData.retrocedent || ''} onChange={handleChange} style={inputStyle}/>
                         </div>
                         <div>
                            <label style={labelStyle}>Performer</label>
                            <input type="text" name="performer" value={formData.performer || ''} onChange={handleChange} style={inputStyle}/>
                         </div>
                    </div>
                </div>

                {/* 4. Financials */}
                <div style={{ ...sectionCardStyle, borderRadius: 12, padding: 24 }}>
                    <h3 style={sectionTitleStyle}><DollarSign size={18} style={{ color: t.accent }}/> Financials & Premiums</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
                        <div>
                            <label style={labelStyle}>Policy Currency</label>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <select name="currency" value={formData.currency} onChange={handleChange} style={selectStyle}>
                                    {sortedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button type="button" onClick={handleFetchRate} title="Fetch Latest Rate" style={{ padding: '0 12px', borderRadius: 4, background: t.accentMuted, color: t.accent, border: `1px solid ${t.accent}`, cursor: 'pointer' }}>
                                    <RefreshCw size={14}/>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Exchange Rate (to UZS)</label>
                            <input type="number" step="0.01" name="exchangeRate" value={formData.exchangeRate || ''} onChange={handleChange} style={inputStyle}/>
                        </div>
                         <div>
                            <label style={labelStyle}>Equivalent in USD</label>
                            <input type="number" name="equivalentUSD" value={formData.equivalentUSD || ''} onChange={handleChange} style={inputStyle} placeholder="Auto or Manual"/>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 32, rowGap: 8, marginBottom: 24 }}>
                         <CurrencyInput
                            label="Sum Insured (100%)"
                            originalValue={formData.sumInsured}
                            nationalValue={formData.sumInsuredNational || 0}
                            currency={formData.currency}
                            exchangeRate={formData.exchangeRate}
                            onValueChange={(o, n) => updateCurrencyField('sumInsured', 'sumInsuredNational', o, n)}
                         />

                         <CurrencyInput
                            label="Gross Premium (100%)"
                            originalValue={formData.grossPremium}
                            nationalValue={formData.premiumNationalCurrency || 0}
                            currency={formData.currency}
                            exchangeRate={formData.exchangeRate}
                            onValueChange={(o, n) => updateCurrencyField('grossPremium', 'premiumNationalCurrency', o, n)}
                         />

                         <CurrencyInput
                            label="Limit of Liability"
                            originalValue={formData.limitForeignCurrency || 0}
                            nationalValue={formData.limitNationalCurrency || 0}
                            currency={formData.currency}
                            exchangeRate={formData.exchangeRate}
                            onValueChange={(o, n) => updateCurrencyField('limitForeignCurrency', 'limitNationalCurrency', o, n)}
                         />

                         <CurrencyInput
                            label="Excess / Deductible Amount"
                            originalValue={formData.excessForeignCurrency || 0}
                            nationalValue={0}
                            currency={formData.currency}
                            exchangeRate={formData.exchangeRate}
                            onValueChange={(o) => updateCurrencyField('excessForeignCurrency', 'excessForeignCurrency', o, 0)}
                         />
                    </div>

                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, paddingTop: 20, borderTop: `1px solid ${t.borderL}` }}>
                          <div>
                            <label style={labelStyle}>Premium Rate (%)</label>
                            <input type="number" step="0.0001" name="premiumRate" value={formData.premiumRate || ''} onChange={handleChange} style={inputStyle}/>
                         </div>
                     </div>
                </div>

                {/* 5. Income / Costs */}
                <div style={{ ...sectionCardStyle, borderRadius: 12, padding: 24 }}>
                    <h3 style={sectionTitleStyle}><Briefcase size={18} style={{ color: t.accent }}/> Income & Costs</h3>
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                         <div>
                             <label style={labelStyle}>Our Share (%)</label>
                             <input type="number" step="0.01" name="ourShare" value={formData.ourShare || ''} onChange={handleChange} style={{ ...inputStyle, fontWeight: 700, color: t.accent }}/>
                         </div>
                         <div>
                             <label style={labelStyle}>Commission %</label>
                             <input type="number" step="0.01" name="commissionPercent" value={formData.commissionPercent || ''} onChange={handleChange} style={inputStyle}/>
                         </div>
                         <div>
                             <label style={labelStyle}>Tax %</label>
                             <input type="number" step="0.01" name="taxPercent" value={formData.taxPercent || ''} onChange={handleChange} style={inputStyle}/>
                         </div>
                         <div>
                             <label style={labelStyle}>Net Premium ({formData.currency})</label>
                             <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: t.bgInput, fontWeight: 700 }}>
                                 {formData.netPremium?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                             </div>
                         </div>
                     </div>
                </div>

                {/* 6. INSTALLMENTS SECTION */}
                <div style={{ ...sectionCardStyle, borderRadius: 12, padding: 24 }}>
                    <h3 style={sectionTitleStyle}><CreditCard size={18} style={{ color: t.accent }}/> Payment Schedule & Collection</h3>

                    <div style={{ marginBottom: 16, fontSize: 14, color: t.text4 }}>
                        Add installments below. The system tracks Due Date vs Actual Paid Date.
                    </div>

                    <div style={{ borderRadius: 8, marginBottom: 16, border: `1px solid ${t.border}` }}>
                        <table style={{ width: '100%', fontSize: 14, textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead style={{ background: t.bgInput, color: t.text2 }}>
                                <tr>
                                    <th style={{ padding: '8px 16px', width: 40, textAlign: 'center' }}>#</th>
                                    <th style={{ padding: '8px 16px' }}>Due Date</th>
                                    <th style={{ padding: '8px 16px' }}>Amount Due ({formData.currency})</th>
                                    <th style={{ padding: '8px 16px' }}>Paid Date</th>
                                    <th style={{ padding: '8px 16px' }}>Amount Paid ({formData.currency})</th>
                                    <th style={{ padding: '8px 16px' }}>Balance</th>
                                    <th style={{ padding: '8px 16px', width: 40 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.installments?.map((inst, idx) => {
                                    const balance = (inst.dueAmount || 0) - (inst.paidAmount || 0);
                                    return (
                                        <tr key={inst.id} style={{ background: t.bgPanel, borderBottom: `1px solid ${t.borderL}` }}>
                                            <td style={{ padding: '8px 16px', textAlign: 'center', color: t.text5 }}>{idx + 1}</td>
                                            <td style={{ padding: '8px 16px', minWidth: 160 }}>
                                                <DatePickerInput
                                                    value={parseDate(inst.dueDate)}
                                                    onChange={(date) => handleInstallmentDateChange(idx, 'dueDate', date)}
                                                    placeholder="Due Date"
                                                />
                                            </td>
                                            <td style={{ padding: '8px 16px' }}>
                                                <input
                                                    type="number"
                                                    value={inst.dueAmount || ''}
                                                    onChange={(e) => handleInstallmentChange(idx, 'dueAmount', Number(e.target.value))}
                                                    style={{ width: '100%', borderRadius: 4, padding: '4px 8px', fontSize: 14, border: `1px solid ${t.border}`, background: t.bgInput, color: t.text1, fontWeight: 500 }}
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td style={{ padding: '8px 16px', minWidth: 160 }}>
                                                <DatePickerInput
                                                    value={parseDate(inst.paidDate)}
                                                    onChange={(date) => handleInstallmentDateChange(idx, 'paidDate', date)}
                                                    placeholder="Paid Date"
                                                />
                                            </td>
                                            <td style={{ padding: '8px 16px' }}>
                                                <input
                                                    type="number"
                                                    value={inst.paidAmount || ''}
                                                    onChange={(e) => handleInstallmentChange(idx, 'paidAmount', Number(e.target.value))}
                                                    style={{ width: '100%', borderRadius: 4, padding: '4px 8px', fontSize: 14, border: `1px solid ${t.border}`, background: t.bgInput, color: t.success, fontWeight: 500 }}
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td style={{ padding: '8px 16px' }}>
                                                <div style={{ fontFamily: "'JetBrains Mono', monospace", color: balance > 0 ? t.danger : t.success, fontWeight: 700 }}>
                                                    {balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </div>
                                            </td>
                                            <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                                <button type="button" onClick={() => removeInstallment(idx)} style={{ color: t.danger }}>
                                                    <Trash2 size={14}/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot style={{ background: t.bgInput, color: t.text2, fontWeight: 700 }}>
                                <tr>
                                    <td colSpan={2} style={{ padding: '8px 16px', textAlign: 'right' }}>TOTAL:</td>
                                    <td style={{ padding: '8px 16px' }}>{totalInstallmentsDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td style={{ padding: '8px 16px', textAlign: 'right' }}>PAID:</td>
                                    <td style={{ padding: '8px 16px', color: t.success }}>{totalInstallmentsPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <button type="button" onClick={addInstallment} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: t.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Plus size={12}/> Add Installment
                    </button>
                </div>

                {/* 7. Treaty / Inward Specifics */}
                {formData.channel === 'Inward' && (
                <div style={{ ...sectionCardStyle, borderRadius: 12, padding: 24, borderLeft: '4px solid #a855f7' }}>
                    <h3 style={sectionTitleStyle}><Globe size={18} style={{ color: '#a855f7' }}/> Treaty & AIC Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 16 }}>
                        <div>
                             <label style={labelStyle}>Treaty Placement</label>
                             <input type="text" name="treatyPlacement" value={formData.treatyPlacement || ''} onChange={handleChange} style={inputStyle}/>
                        </div>
                        <CurrencyInput
                            label="Treaty Premium"
                            originalValue={formData.treatyPremium || 0}
                            nationalValue={0}
                            currency={formData.currency}
                            exchangeRate={formData.exchangeRate}
                            onValueChange={(o) => updateCurrencyField('treatyPremium', 'treatyPremium', o, 0)}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                        <CurrencyInput
                            label="AIC Retention"
                            originalValue={formData.aicRetention || 0}
                            nationalValue={0}
                            currency={formData.currency}
                            exchangeRate={formData.exchangeRate}
                            onValueChange={(o) => updateCurrencyField('aicRetention', 'aicRetention', o, 0)}
                        />
                        <CurrencyInput
                            label="AIC Premium"
                            originalValue={formData.aicPremium || 0}
                            nationalValue={0}
                            currency={formData.currency}
                            exchangeRate={formData.exchangeRate}
                            onValueChange={(o) => updateCurrencyField('aicPremium', 'aicPremium', o, 0)}
                        />
                         <CurrencyInput
                            label="AIC Commission Amount"
                            originalValue={formData.aicCommission || 0}
                            nationalValue={0}
                            currency={formData.currency}
                            exchangeRate={formData.exchangeRate}
                            onValueChange={(o) => updateCurrencyField('aicCommission', 'aicCommission', o, 0)}
                        />
                        <CurrencyInput
                            label="Max Retention / Risk"
                            originalValue={formData.maxRetentionPerRisk || 0}
                            nationalValue={0}
                            currency={formData.currency}
                            exchangeRate={formData.exchangeRate}
                            onValueChange={(o) => updateCurrencyField('maxRetentionPerRisk', 'maxRetentionPerRisk', o, 0)}
                        />
                    </div>
                </div>
                )}

                {/* 8. OUTWARD REINSURANCE */}
                <div style={{ ...sectionCardStyle, borderRadius: 12, padding: 24, borderLeft: `4px solid ${t.warning}` }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${t.borderL}` }}>
                         <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.text1, fontSize: 15, fontWeight: 700 }}>
                             <ArrowRightLeft size={18} style={{ color: t.warning }}/> Outward Reinsurance
                         </h3>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                             <label style={{ fontSize: 14, color: t.text3, fontWeight: 500 }}>Applicable?</label>
                             <input
                                type="checkbox"
                                checked={formData.hasOutwardReinsurance || false}
                                onChange={(e) => setFormData({...formData, hasOutwardReinsurance: e.target.checked})}
                                style={{ width: 20, height: 20, borderRadius: 4 }}
                             />
                         </div>
                     </div>

                     {formData.hasOutwardReinsurance ? (
                        <div className="animate-in fade-in slide-in-from-top-2" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.border}` }}>
                                <table style={{ width: '100%', fontSize: 14, textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: t.warningBg, color: t.text1 }}>
                                        <tr>
                                            <th style={{ padding: '8px 16px', width: '50%' }}>Reinsurer Name</th>
                                            <th style={{ padding: '8px 16px', width: 80 }}>Share %</th>
                                            <th style={{ padding: '8px 16px', width: 80 }}>Comm %</th>
                                            <th style={{ padding: '8px 16px', width: 40 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.reinsurers?.map((reinsurer, idx) => (
                                            <tr key={reinsurer.id} style={{ background: t.bgPanel, borderBottom: `1px solid ${t.borderL}` }}>
                                                <td style={{ padding: '8px 16px' }}>
                                                    <input
                                                        type="text"
                                                        value={reinsurer.name}
                                                        onChange={(e) => handleReinsurerChange(idx, 'name', e.target.value)}
                                                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
                                                        placeholder="Reinsurer Name"
                                                    />
                                                </td>
                                                <td style={{ padding: '8px 16px' }}>
                                                    <input
                                                        type="number"
                                                        value={reinsurer.share || ''}
                                                        onChange={(e) => handleReinsurerChange(idx, 'share', Number(e.target.value))}
                                                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px 16px' }}>
                                                    <input
                                                        type="number"
                                                        value={reinsurer.commission || ''}
                                                        onChange={(e) => handleReinsurerChange(idx, 'commission', Number(e.target.value))}
                                                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                                    <button type="button" onClick={() => removeReinsurer(idx)} style={{ color: t.danger }}>
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot style={{ background: t.bgInput }}>
                                        <tr>
                                            <td colSpan={4} style={{ padding: '8px 16px' }}>
                                                <button type="button" onClick={addReinsurer} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: t.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                                                    <Plus size={12}/> Add Reinsurer
                                                </button>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, padding: 16, borderRadius: 8, background: t.warningBg }}>
                                 <div>
                                    <label style={labelStyle}>Total Premium Ceded ({formData.currency})</label>
                                    <div style={{ padding: 8, borderRadius: 4, color: t.text1, background: t.bgPanel, border: `1px solid ${t.warning}`, fontWeight: 700 }}>
                                        {formData.cededPremiumForeign?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </div>
                                    <div style={{ fontSize: 12, marginTop: 4, color: t.text4 }}>
                                        Total Share: {formData.cededShare}%
                                    </div>
                                 </div>
                                 <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Net Payable to Reinsurers ({formData.currency})</label>
                                    <div style={{ padding: 8, borderRadius: 4, color: t.text1, background: t.warningBg, border: `1px solid ${t.warning}`, fontWeight: 700 }}>
                                        {formData.netReinsurancePremium?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </div>
                                    <div style={{ fontSize: 12, marginTop: 4, color: t.text4 }}>
                                        Avg Commission: {formData.reinsuranceCommission}%
                                    </div>
                                 </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, fontSize: 12, paddingTop: 16, color: t.text3, borderTop: `1px solid ${t.borderL}` }}>
                                <CurrencyInput
                                    label="Sum Reinsured"
                                    originalValue={formData.sumReinsuredForeign || 0}
                                    nationalValue={formData.sumReinsuredNational || 0}
                                    currency={formData.currency}
                                    exchangeRate={formData.exchangeRate}
                                    onValueChange={(o, n) => updateCurrencyField('sumReinsuredForeign', 'sumReinsuredNational', o, n)}
                                />
                                <CurrencyInput
                                    label="Received Premium"
                                    originalValue={formData.receivedPremiumForeign || 0}
                                    nationalValue={formData.receivedPremiumNational || 0}
                                    currency={formData.currency}
                                    exchangeRate={formData.exchangeRate}
                                    onValueChange={(o, n) => updateCurrencyField('receivedPremiumForeign', 'receivedPremiumNational', o, n)}
                                />
                            </div>
                        </div>
                     ) : (
                         <div style={{ fontSize: 14, fontStyle: 'italic', color: t.text5 }}>No reinsurance ceded for this policy. Check the box to add details.</div>
                     )}
                </div>
            </div>

            {/* Right Column (Reference & Workflow) */}
            <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* VALIDATION WORKFLOW */}
                {isEdit && (
                    <div className="transition-all" style={{
                        borderRadius: 12, padding: 24,
                        background: formData.status === PolicyStatus.ACTIVE ? t.successBg :
                                   formData.status === PolicyStatus.NTU ? t.dangerBg : t.warningBg,
                        border: `1px solid ${formData.status === PolicyStatus.ACTIVE ? t.success :
                                              formData.status === PolicyStatus.NTU ? t.danger : t.warning}`,
                        boxShadow: t.shadow
                    }}>
                        <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
                            color: formData.status === PolicyStatus.ACTIVE ? t.success :
                                   formData.status === PolicyStatus.NTU ? t.danger : t.warning,
                            fontSize: 15, fontWeight: 700
                        }}>
                            {formData.status === PolicyStatus.ACTIVE ? <CheckCircle size={20}/> :
                            formData.status === PolicyStatus.NTU ? <XCircle size={20}/> :
                            <AlertCircle size={20}/>}
                            {formData.status}
                        </h3>

                        {formData.status === PolicyStatus.PENDING && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ paddingTop: 16, borderTop: `1px dashed ${t.warning}` }}>
                                    <label style={{ display: 'block', fontSize: 14, marginBottom: 8, color: t.text1, fontWeight: 700 }}>
                                        Upload Signed Document
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <label className="transition-colors" style={{ flex: 1, cursor: 'pointer', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, background: t.bgPanel, border: `1px solid ${t.warning}`, color: t.warning }}>
                                            <Upload size={16} /> {selectedFile ? selectedFile.name : 'Select File...'}
                                            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />
                                        </label>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, paddingTop: 8 }}>
                                    <button
                                        type="button"
                                        onClick={handleNTU}
                                        className="transition-colors"
                                        style={{ width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 14, background: t.bgPanel, border: `1px solid ${t.danger}`, color: t.danger, fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Mark NTU
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleActivate}
                                        disabled={!!processingAction}
                                        className="transition-colors"
                                        style={{ width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: t.success, color: '#fff', boxShadow: t.shadow, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                                    >
                                        {processingAction === 'activate' ? <Loader2 className="animate-spin" size={16}/> : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {formData.status === PolicyStatus.ACTIVE && (
                             <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.success}` }}>
                                <button
                                    onClick={handlePolicyCancel}
                                    type="button"
                                    style={{ width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: t.bgPanel, border: `1px solid ${t.danger}`, color: t.danger, fontWeight: 700, cursor: 'pointer' }}
                                >
                                    <XCircle size={16}/> Cancel Policy
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Key Dates Summary */}
                <div style={{ borderRadius: 12, padding: 24, background: t.accentMuted, border: `1px solid ${t.accent}`, boxShadow: t.shadow }}>
                    <h3 style={{ marginBottom: 16, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8, color: t.accent, borderBottom: `1px solid ${t.accent}`, fontSize: 15, fontWeight: 700 }}>
                        <Calendar size={18}/> Key Dates Summary
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: t.accent }}>Inception:</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 700 }}>{formatDate(formData.inceptionDate)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: t.accent }}>Expiry:</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 700 }}>{formatDate(formData.expiryDate)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 8, borderTop: `1px solid ${t.accent}` }}>
                            <span style={{ color: t.accent }}>Payment Due:</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: t.danger, fontWeight: 700 }}>{formatDate(formData.paymentDate)}</span>
                        </div>
                    </div>
                </div>

                {/* References */}
                <div style={{ ...sectionCardStyle, borderRadius: 12, padding: 24 }}>
                    <h3 style={sectionTitleStyle}><FileText size={18} style={{ color: t.accent }}/> References & Dates</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={labelStyle}>Policy / Ref Number</label>
                            <input type="text" name="policyNumber" value={formData.policyNumber || ''} onChange={handleChange} style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 700, color: t.text2 }}/>
                        </div>
                        <div>
                            <label style={labelStyle}>Secondary Policy Ref</label>
                            <input type="text" name="secondaryPolicyNumber" value={formData.secondaryPolicyNumber || ''} onChange={handleChange} style={inputStyle}/>
                        </div>

                        <div>
                            <label style={labelStyle}>Agreement / Slip No</label>
                            <input type="text" name="agreementNumber" value={formData.agreementNumber || ''} onChange={handleChange} style={inputStyle}/>
                        </div>

                         <div>
                            <label style={labelStyle}>Bordereau No</label>
                            <input type="text" name="bordereauNo" value={formData.bordereauNo || ''} onChange={handleChange} style={inputStyle}/>
                        </div>

                         <div>
                            <label style={labelStyle}>Cover Note Ref</label>
                            <input type="text" name="coverNote" value={formData.coverNote || ''} onChange={handleChange} style={inputStyle}/>
                        </div>

                         <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                             <input type="checkbox" name="invoiceIssued" checked={formData.invoiceIssued || false} onChange={e => setFormData({...formData, invoiceIssued: e.target.checked})} />
                             <label style={{ fontSize: 14 }}>Invoice Issued?</label>
                         </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, paddingTop: 12, borderTop: `1px solid ${t.borderL}` }}>
                            <div>
                                <DatePickerInput label="Inception" value={parseDate(formData.inceptionDate)} onChange={(date) => handleDateChange('inceptionDate', date)} />
                            </div>
                             <div>
                                <DatePickerInput label="Expiry" value={parseDate(formData.expiryDate)} onChange={(date) => handleDateChange('expiryDate', date)} />
                            </div>
                             <div>
                                <DatePickerInput label="Date of Slip" value={parseDate(formData.dateOfSlip)} onChange={(date) => handleDateChange('dateOfSlip', date)} />
                            </div>
                             <div>
                                <DatePickerInput label="Accounting Date" value={parseDate(formData.accountingDate)} onChange={(date) => handleDateChange('accountingDate', date)} />
                            </div>
                            <div>
                                <DatePickerInput label="Payment Date" value={parseDate(formData.paymentDate)} onChange={(date) => handleDateChange('paymentDate', date)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Settings */}
                <div style={{ ...sectionCardStyle, borderRadius: 12, padding: 24 }}>
                     <h3 style={sectionTitleStyle}><ShieldCheck size={18} style={{ color: t.accent }}/> Conditions</h3>
                     <label style={labelStyle}>Deductible</label>
                     <textarea rows={2} name="deductible" value={formData.deductible || ''} onChange={handleChange} style={inputStyle} placeholder="e.g. 10% of claim amount"></textarea>

                     <label style={{ ...labelStyle, marginTop: 12 }}>Warranty Period (Days)</label>
                     <input type="number" name="warrantyPeriod" value={formData.warrantyPeriod || ''} onChange={handleChange} style={inputStyle}/>

                     <label style={{ ...labelStyle, marginTop: 12 }}>Number of Slips</label>
                     <input type="number" name="numberOfSlips" value={formData.numberOfSlips || ''} onChange={handleChange} style={inputStyle}/>
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 24, marginTop: 24, borderTop: `1px solid ${t.border}` }}>
          <button
            type="button"
            onClick={onCancel}
            className="transition-colors"
            style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, color: t.text2, background: t.bgPanel, border: `1px solid ${t.border}`, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!!processingAction}
            className="transition-colors"
            style={{ padding: '10px 24px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, background: t.accent, color: '#fff', fontWeight: 500, border: 'none', cursor: 'pointer', opacity: processingAction ? 0.5 : 1 }}
          >
            {processingAction === 'save' ? <Loader2 className="animate-spin" size={16}/> : <Save size={16} />}
            {processingAction === 'save' ? 'Saving...' : (isEdit ? 'Update Policy' : 'Create Policy')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showActivateConfirm}
        title="Activate Without Signed Slip?"
        message="You are about to activate this policy without uploading a signed slip document. Are you sure you want to continue?"
        onConfirm={() => { setShowActivateConfirm(false); doActivate(); }}
        onCancel={() => setShowActivateConfirm(false)}
        variant="warning"
        confirmText="Activate Anyway"
      />
    </div>
  );
};

export default PolicyFormContent;
