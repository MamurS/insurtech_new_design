
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DB } from '../services/db';
import { Policy, Currency, PolicyStatus, PaymentStatus, Channel, IntermediaryType, PolicyReinsurer, Installment } from '../types';
import { formatDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EntitySearchInput } from '../components/EntitySearchInput';
import { formatSICDisplay } from '../data/sicCodes';
import { Save, ArrowLeft, Building2, FileText, DollarSign, ShieldCheck, ArrowRightLeft, Upload, CheckCircle, XCircle, AlertCircle, Loader2, ChevronDown, Search, Users, Briefcase, Globe, Plus, Trash2, RefreshCw, CreditCard, Calendar } from 'lucide-react';
import { DatePickerInput, parseDate, toISODateString } from '../components/DatePickerInput';

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
    // Determine the initial view mode. 
    const [viewCurrency, setViewCurrency] = useState(currency);

    // Sync local view mode with the parent Policy Currency if it changes (and we aren't explicitly viewing UZS)
    useEffect(() => {
        if (viewCurrency !== 'UZS') {
            setViewCurrency(currency);
        }
    }, [currency]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value === '' ? 0 : Number(e.target.value);
        
        if (viewCurrency === 'UZS') {
            // User is editing in UZS (National)
            // Calculate Original (Policy Currency) based on rate
            const calcOriginal = exchangeRate > 0 ? val / exchangeRate : 0;
            onValueChange(calcOriginal, val);
        } else {
            // User is editing in Foreign Currency (Policy/USD/EUR)
            // Calculate National (UZS) based on rate
            // Note: We use the single Policy Exchange Rate for this calculation.
            const calcNational = val * exchangeRate;
            onValueChange(val, calcNational);
        }
    };

    // Which value to show in the input box
    const displayValue = viewCurrency === 'UZS' ? nationalValue : originalValue;

    // Richer currency options: Policy Currency + UZS + Major Currencies (USD, EUR)
    // We use a Set to automatically deduplicate if Policy Currency is already USD or EUR
    const currencyOptions = Array.from(new Set([currency, 'UZS', 'USD', 'EUR']));

    return (
        <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>
            <div className="flex rounded-lg shadow-sm">
                <select
                    value={viewCurrency}
                    onChange={(e) => setViewCurrency(e.target.value)}
                    disabled={disabled}
                    className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-600 sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none font-bold min-w-[80px]"
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
                    onWheel={(e) => e.currentTarget.blur()} // Prevent accidental scroll changes
                    className="flex-1 min-w-0 block w-full px-3 py-2.5 rounded-r-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 disabled:bg-gray-100"
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
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="text"
          name={name}
          value={value || ''}
          onChange={handleInputChange}
          onClick={() => setIsOpen(true)}
          required={required}
          placeholder={placeholder || "Type to search..."}
          autoComplete="off"
          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 pr-8"
        />
        <div className="absolute right-2 top-1/2 -translate-x-1/2 text-gray-400 pointer-events-none">
          {isOpen ? <Search size={14}/> : <ChevronDown size={14}/>}
        </div>
      </div>
      
      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          {filteredOptions.map((opt) => (
            <li 
              key={opt}
              onClick={() => handleSelect(opt)}
              className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer border-b border-gray-50 last:border-0"
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


const PolicyForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
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
    
    // Outward Defaults
    hasOutwardReinsurance: false,
    reinsurers: [],
    
    // Installments
    installments: [],

    // Calculated aggregates
    cededShare: 0,
    cededPremiumForeign: 0,
    netReinsurancePremium: 0,
    reinsuranceCommission: 0, // Weighted Avg
    
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
          // Backward compatibility
          const loadedData = { ...policy };
          if ((policy as any).recordType) {
              if ((policy as any).recordType === 'Inward') loadedData.channel = 'Inward';
              else loadedData.channel = 'Direct'; 
          }
          // Ensure reinsurers array exists if singular fields exist
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
          
          // Ensure installments array exists
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
          navigate('/');
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
  }, [id, isEdit, navigate]);

  // Reactive Calculations (Premium & Reinsurance)
  useEffect(() => {
    const gross = formData.grossPremium || 0;
    const comm = formData.commissionPercent || 0; 
    const tax = formData.taxPercent || 0;
    const net = gross - (gross * comm / 100) - (gross * tax / 100);
    
    // Reinsurance Aggregations
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

  // Helper for CurrencyInput updates
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

  // Date Change Handler for DatePickerInput
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
        navigate('/');
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
        navigate('/');
    } catch (error: any) { console.error(error); toast.error(`Failed: ${error.message}`); } finally { setProcessingAction(null); }
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.preventDefault();
    setProcessingAction('cancel');
    try {
        await DB.savePolicy({ ...formData, status: PolicyStatus.CANCELLED });
        navigate('/');
    } catch (error: any) { console.error(error); toast.error(`Failed: ${error.message}`); } finally { setProcessingAction(null); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingAction('save');
    try {
        await DB.savePolicy(formData);
        navigate('/');
    } catch (error: any) { 
        console.error(error); 
        toast.error(`Failed to save: ${error.message || 'Check console for details.'}`);
    } finally { setProcessingAction(null); }
  };

  // Helper calculation for Installment Summary
  const totalInstallmentsDue = formData.installments?.reduce((acc, curr) => acc + (curr.dueAmount || 0), 0) || 0;
  const totalInstallmentsPaid = formData.installments?.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0) || 0;

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  const sectionTitleClass = "text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2";
  const labelClass = "block text-sm font-medium text-gray-600 mb-1.5";
  const inputClass = "w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900";
  const selectClass = "w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900";

  // Priority Currencies Sort
  const priorityCurrencies = ['UZS', 'USD', 'EUR'];
  const allCurrencies = Object.values(Currency);
  const sortedCurrencies = [
      ...priorityCurrencies,
      ...allCurrencies.filter(c => !priorityCurrencies.includes(c)).sort()
  ];

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <form onSubmit={handleSubmit}>
        
        {/* Sticky Header - Use z-index 50 to ensure it is above other content and use negative margins to span width */}
        <div className="sticky -mt-4 -mx-4 md:-mt-8 md:-mx-8 px-4 md:px-8 py-4 mb-6 bg-gray-50/95 backdrop-blur-md border-b border-gray-200 flex items-center justify-between shadow-sm z-50 top-0">
            <div className="flex items-center gap-4">
                <button type="button" onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-800 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">{isEdit ? 'Edit Policy' : 'New Policy Record'}</h2>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                       Ref: {formData.policyNumber} 
                       <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${formData.status === PolicyStatus.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                           {formData.status}
                       </span>
                    </p>
                </div>
            </div>
            
            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={!!processingAction}
                    className="flex items-center gap-2 px-6 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-70"
                >
                    {processingAction === 'save' ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />}
                    Save
                </button>
            </div>
        </div>

        {/* ... Rest of JSX remains identical, just copy it over ... */}
        {/* I am re-pasting the full content below to ensure validity */}
        
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* Left Column (Main Data) */}
            <div className="xl:col-span-8 space-y-6">
                
                {/* 1. Channel & Intermediary */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className={sectionTitleClass}><ArrowRightLeft size={18} className="text-blue-500"/> Business Channel & Source</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        {/* Channel Selector */}
                        <div>
                            <label className={labelClass}>Business Channel</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button type="button" onClick={() => handleChannelChange('Direct')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.channel === 'Direct' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
                                    Direct Insurance
                                </button>
                                <button type="button" onClick={() => handleChannelChange('Inward')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.channel === 'Inward' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}>
                                    Inward Reinsurance
                                </button>
                            </div>
                        </div>

                         {/* Intermediary Selector */}
                        <div>
                            <label className={labelClass}>Intermediary Source</label>
                            <select 
                                value={formData.intermediaryType} 
                                onChange={(e) => handleIntermediaryChange(e.target.value as IntermediaryType)}
                                className={selectClass}
                            >
                                <option value="Direct">Direct Client (No Intermediary)</option>
                                <option value="Broker">Insurance Broker</option>
                                <option value="Agent">Insurance Agent</option>
                                <option value="MGA">MGA / Partner</option>
                            </select>
                        </div>
                    </div>

                    {/* Conditional Name Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                <label className={labelClass}>Cedant (Reinsured) Name</label>
                                <input type="text" name="cedantName" value={formData.cedantName || ''} onChange={handleChange} className={`${inputClass} border-purple-300 bg-purple-50`} placeholder="Company sending the risk"/>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Risk & Core Details */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className={sectionTitleClass}><Building2 size={18} className="text-blue-500"/> Risk Details</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                             <EntitySearchInput
                                label="Original Insured Name (Legal Entity)"
                                value={formData.insuredName || ''}
                                onChange={(name, entityId) => setFormData(prev => ({ ...prev, insuredName: name, insuredEntityId: entityId }))}
                                onEntitySelect={(entity) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    insuredName: entity.fullName,
                                    insuredEntityId: entity.id,
                                    insuredSicCode: entity.sicCode || '',
                                    insuredSicSection: entity.sicSection || '',
                                    ...(entity.regCodeValue ? { insuredINN: entity.regCodeValue } : {}),
                                    ...(entity.country ? { territory: entity.country } : {}),
                                    ...(entity.city ? { city: entity.city } : {})
                                  }));
                                }}
                                placeholder="Search for legal entity..."
                                required
                            />
                            {formData.insuredSicCode && (
                              <div className="mt-1.5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
                                <span className="text-gray-400">Industry:</span>
                                <span className="text-gray-600">{formatSICDisplay(formData.insuredSicCode)}</span>
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
                            <label className={labelClass}>Industry / Business</label>
                            <input type="text" name="industry" value={formData.industry || ''} onChange={handleChange} className={inputClass}/>
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

                        <div className="md:col-span-2">
                            <SearchableInput 
                                label="Class of Insurance" 
                                name="classOfInsurance" 
                                value={formData.classOfInsurance || ''} 
                                options={INSURANCE_CLASSES} 
                                onChange={handleChange} 
                            />
                        </div>
                         
                        {/* New Risk Fields */}
                        <div>
                             <label className={labelClass}>Risk Code</label>
                             <input type="text" name="riskCode" value={formData.riskCode || ''} onChange={handleChange} className={inputClass} placeholder="e.g. 03.11"/>
                        </div>
                        <div>
                             <label className={labelClass}>Jurisdiction</label>
                             <input type="text" name="jurisdiction" value={formData.jurisdiction || 'Uzbekistan'} onChange={handleChange} className={inputClass}/>
                        </div>
                         <div className="md:col-span-2">
                             <label className={labelClass}>Insured Risk / Object</label>
                             <input type="text" name="insuredRisk" value={formData.insuredRisk || ''} onChange={handleChange} className={inputClass} placeholder="Detailed description of the risk"/>
                        </div>
                    </div>
                </div>

                {/* 3. Extended Parties */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className={sectionTitleClass}><Users size={18} className="text-blue-500"/> Additional Parties</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                         <div>
                            <label className={labelClass}>Insured Address</label>
                            <input type="text" name="insuredAddress" value={formData.insuredAddress || ''} onChange={handleChange} className={inputClass}/>
                         </div>
                         <div>
                            <label className={labelClass}>Borrower (Loan)</label>
                            <input type="text" name="borrower" value={formData.borrower || ''} onChange={handleChange} className={inputClass}/>
                         </div>
                         <div>
                            <label className={labelClass}>Retrocedent</label>
                            <input type="text" name="retrocedent" value={formData.retrocedent || ''} onChange={handleChange} className={inputClass}/>
                         </div>
                         <div>
                            <label className={labelClass}>Performer</label>
                            <input type="text" name="performer" value={formData.performer || ''} onChange={handleChange} className={inputClass}/>
                         </div>
                    </div>
                </div>
                
                {/* 4. Financials (NEW LAYOUT WITH PER-FIELD CURRENCY TOGGLE) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className={sectionTitleClass}><DollarSign size={18} className="text-blue-500"/> Financials & Premiums</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                        <div>
                            <label className={labelClass}>Policy Currency</label>
                            <div className="flex gap-1">
                                <select name="currency" value={formData.currency} onChange={handleChange} className={selectClass}>
                                    {sortedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button type="button" onClick={handleFetchRate} title="Fetch Latest Rate" className="px-3 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100">
                                    <RefreshCw size={14}/>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">Exchange Rate (to UZS)</label>
                            <input type="number" step="0.01" name="exchangeRate" value={formData.exchangeRate || ''} onChange={handleChange} className={inputClass}/>
                        </div>
                         <div>
                            <label className={labelClass}>Equivalent in USD</label>
                            <input type="number" name="equivalentUSD" value={formData.equivalentUSD || ''} onChange={handleChange} className={inputClass} placeholder="Auto or Manual"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mb-6">
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
                            nationalValue={0} // We don't strictly store National Excess in legacy schema, but UI can calculate it for view
                            currency={formData.currency}
                            exchangeRate={formData.exchangeRate}
                            onValueChange={(o) => updateCurrencyField('excessForeignCurrency', 'excessForeignCurrency', o, 0)} // Hack: we only store FC for excess usually, but component handles view
                         />
                    </div>

                     {/* Additional Rates */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-gray-100 pt-5">
                          <div>
                            <label className={labelClass}>Premium Rate (%)</label>
                            <input type="number" step="0.0001" name="premiumRate" value={formData.premiumRate || ''} onChange={handleChange} className={inputClass}/>
                         </div>
                     </div>
                </div>

                {/* 5. Income / Costs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className={sectionTitleClass}><Briefcase size={18} className="text-blue-500"/> Income & Costs</h3>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                         <div>
                             <label className={labelClass}>Our Share (%)</label>
                             <input type="number" step="0.01" name="ourShare" value={formData.ourShare || ''} onChange={handleChange} className={`${inputClass} font-bold text-blue-700`}/>
                         </div>
                         <div>
                             <label className={labelClass}>Commission %</label>
                             <input type="number" step="0.01" name="commissionPercent" value={formData.commissionPercent || ''} onChange={handleChange} className={inputClass}/>
                         </div>
                         <div>
                             <label className={labelClass}>Tax %</label>
                             <input type="number" step="0.01" name="taxPercent" value={formData.taxPercent || ''} onChange={handleChange} className={inputClass}/>
                         </div>
                         <div>
                             <label className={labelClass}>Net Premium ({formData.currency})</label>
                             <div className={`${inputClass} bg-gray-100 font-bold flex items-center`}>
                                 {formData.netPremium?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                             </div>
                         </div>
                     </div>
                </div>

                {/* 6. INSTALLMENTS SECTION */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className={sectionTitleClass}><CreditCard size={18} className="text-blue-500"/> Payment Schedule & Collection</h3>
                    
                    <div className="mb-4 text-sm text-gray-500">
                        Add installments below. The system tracks Due Date vs Actual Paid Date.
                    </div>

                    <div className="border border-gray-200 rounded-lg mb-4">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700">
                                <tr>
                                    <th className="px-4 py-2 w-10 text-center">#</th>
                                    <th className="px-4 py-2">Due Date</th>
                                    <th className="px-4 py-2">Amount Due ({formData.currency})</th>
                                    <th className="px-4 py-2">Paid Date</th>
                                    <th className="px-4 py-2">Amount Paid ({formData.currency})</th>
                                    <th className="px-4 py-2">Balance</th>
                                    <th className="px-4 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {formData.installments?.map((inst, idx) => {
                                    const balance = (inst.dueAmount || 0) - (inst.paidAmount || 0);
                                    return (
                                        <tr key={inst.id} className="bg-white">
                                            <td className="px-4 py-2 text-center text-gray-400">{idx + 1}</td>
                                            <td className="px-4 py-2 min-w-[160px]">
                                                <DatePickerInput
                                                    value={parseDate(inst.dueDate)}
                                                    onChange={(date) => handleInstallmentDateChange(idx, 'dueDate', date)}
                                                    placeholder="Due Date"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input 
                                                    type="number" 
                                                    value={inst.dueAmount || ''} 
                                                    onChange={(e) => handleInstallmentChange(idx, 'dueAmount', Number(e.target.value))}
                                                    className="w-full border-gray-200 rounded px-2 py-1 text-sm font-medium"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="px-4 py-2 min-w-[160px]">
                                                <DatePickerInput
                                                    value={parseDate(inst.paidDate)}
                                                    onChange={(date) => handleInstallmentDateChange(idx, 'paidDate', date)}
                                                    placeholder="Paid Date"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input 
                                                    type="number" 
                                                    value={inst.paidAmount || ''} 
                                                    onChange={(e) => handleInstallmentChange(idx, 'paidAmount', Number(e.target.value))}
                                                    className="w-full border-gray-200 rounded px-2 py-1 text-sm text-green-700 font-medium"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className={`font-mono font-bold ${balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                    {balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button type="button" onClick={() => removeInstallment(idx)} className="text-red-400 hover:text-red-600">
                                                    <Trash2 size={14}/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50 font-bold text-gray-700">
                                <tr>
                                    <td colSpan={2} className="px-4 py-2 text-right">TOTAL:</td>
                                    <td className="px-4 py-2">{totalInstallmentsDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="px-4 py-2 text-right">PAID:</td>
                                    <td className="px-4 py-2 text-green-700">{totalInstallmentsPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <button type="button" onClick={addInstallment} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800">
                        <Plus size={12}/> Add Installment
                    </button>
                </div>

                {/* 7. Treaty / Inward Specifics */}
                {formData.channel === 'Inward' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 border-l-4 border-l-purple-500">
                    <h3 className={sectionTitleClass}><Globe size={18} className="text-purple-500"/> Treaty & AIC Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                        <div>
                             <label className={labelClass}>Treaty Placement</label>
                             <input type="text" name="treatyPlacement" value={formData.treatyPlacement || ''} onChange={handleChange} className={inputClass}/>
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

                {/* 8. OUTWARD REINSURANCE (MULTI-ROW) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 border-l-4 border-l-amber-400">
                     <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                         <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                             <ArrowRightLeft size={18} className="text-amber-500"/> Outward Reinsurance
                         </h3>
                         <div className="flex items-center gap-2">
                             <label className="text-sm font-medium text-gray-600">Applicable?</label>
                             <input 
                                type="checkbox" 
                                checked={formData.hasOutwardReinsurance || false} 
                                onChange={(e) => setFormData({...formData, hasOutwardReinsurance: e.target.checked})}
                                className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                             />
                         </div>
                     </div>
                     
                     {formData.hasOutwardReinsurance ? (
                        <div className="animate-in fade-in slide-in-from-top-2 space-y-4">
                            
                            {/* Reinsurers Panel Table */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-amber-50 text-amber-900">
                                        <tr>
                                            <th className="px-4 py-2 w-1/2">Reinsurer Name</th>
                                            <th className="px-4 py-2 w-20">Share %</th>
                                            <th className="px-4 py-2 w-20">Comm %</th>
                                            <th className="px-4 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {formData.reinsurers?.map((reinsurer, idx) => (
                                            <tr key={reinsurer.id} className="bg-white">
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="text" 
                                                        value={reinsurer.name}
                                                        onChange={(e) => handleReinsurerChange(idx, 'name', e.target.value)}
                                                        className="w-full border-none focus:ring-0 text-sm"
                                                        placeholder="Reinsurer Name"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number" 
                                                        value={reinsurer.share || ''}
                                                        onChange={(e) => handleReinsurerChange(idx, 'share', Number(e.target.value))}
                                                        className="w-full border-none focus:ring-0 text-sm"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number" 
                                                        value={reinsurer.commission || ''}
                                                        onChange={(e) => handleReinsurerChange(idx, 'commission', Number(e.target.value))}
                                                        className="w-full border-none focus:ring-0 text-sm"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button type="button" onClick={() => removeReinsurer(idx)} className="text-red-400 hover:text-red-600">
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                        <tr>
                                            <td colSpan={4} className="px-4 py-2">
                                                <button type="button" onClick={addReinsurer} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800">
                                                    <Plus size={12}/> Add Reinsurer
                                                </button>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            
                            {/* Aggregates Display */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-amber-50 p-4 rounded-lg">
                                 <div>
                                    <label className={labelClass}>Total Premium Ceded ({formData.currency})</label>
                                    <div className="font-bold text-gray-900 bg-white p-2 rounded border border-amber-200">
                                        {formData.cededPremiumForeign?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Total Share: {formData.cededShare}%
                                    </div>
                                 </div>
                                 <div className="md:col-span-2">
                                    <label className={labelClass}>Net Payable to Reinsurers ({formData.currency})</label>
                                    <div className="font-bold text-amber-900 bg-amber-100 p-2 rounded border border-amber-300">
                                        {formData.netReinsurancePremium?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Avg Commission: {formData.reinsuranceCommission}%
                                    </div>
                                 </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5 text-xs text-gray-600 border-t pt-4">
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
                         <div className="text-sm text-gray-400 italic">No reinsurance ceded for this policy. Check the box to add details.</div>
                     )}
                </div>
            </div>

            {/* Right Column (Reference & Workflow) */}
            <div className="xl:col-span-4 space-y-6">
                
                {/* VALIDATION WORKFLOW */}
                {isEdit && (
                    <div className={`rounded-xl shadow-sm border p-6 transition-all ${
                        formData.status === PolicyStatus.ACTIVE ? 'bg-green-50 border-green-200' :
                        formData.status === PolicyStatus.NTU ? 'bg-red-50 border-red-200' :
                        'bg-amber-50 border-amber-200'
                    }`}>
                        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
                            formData.status === PolicyStatus.ACTIVE ? 'text-green-800' :
                            formData.status === PolicyStatus.NTU ? 'text-red-800' :
                            'text-amber-800'
                        }`}>
                            {formData.status === PolicyStatus.ACTIVE ? <CheckCircle size={20}/> :
                            formData.status === PolicyStatus.NTU ? <XCircle size={20}/> :
                            <AlertCircle size={20}/>}
                            {formData.status}
                        </h3>

                        {formData.status === PolicyStatus.PENDING && (
                            <div className="space-y-4">
                                <div className="border-t border-dashed border-amber-200 pt-4">
                                    <label className="block text-sm font-bold text-amber-900 mb-2">
                                        Upload Signed Document
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <label className="flex-1 cursor-pointer bg-white border border-amber-300 rounded-lg px-4 py-2 text-amber-700 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2 text-sm">
                                            <Upload size={16} /> {selectedFile ? selectedFile.name : 'Select File...'}
                                            <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <button 
                                        type="button" 
                                        onClick={handleNTU}
                                        className="w-full py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-bold transition-colors"
                                    >
                                        Mark NTU
                                    </button>
                                    
                                    <button 
                                        type="button" 
                                        onClick={handleActivate}
                                        disabled={!!processingAction}
                                        className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
                                    >
                                        {processingAction === 'activate' ? <Loader2 className="animate-spin" size={16}/> : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {formData.status === PolicyStatus.ACTIVE && (
                             <div className="mt-4 pt-4 border-t border-green-200">
                                <button 
                                    onClick={handleCancel}
                                    type="button" 
                                    className="w-full py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-bold flex items-center justify-center gap-2"
                                >
                                    <XCircle size={16}/> Cancel Policy
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Key Dates Summary (New) */}
                <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-6">
                    <h3 className="text-lg font-bold text-blue-900 mb-4 pb-2 border-b border-blue-200 flex items-center gap-2">
                        <Calendar size={18}/> Key Dates Summary
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-blue-700">Inception:</span>
                            <span className="font-mono font-bold text-blue-900">{formatDate(formData.inceptionDate)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-blue-700">Expiry:</span>
                            <span className="font-mono font-bold text-blue-900">{formatDate(formData.expiryDate)}</span>
                        </div>
                        <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
                            <span className="text-blue-700">Payment Due:</span>
                            <span className="font-mono font-bold text-red-700">{formatDate(formData.paymentDate)}</span>
                        </div>
                    </div>
                </div>

                {/* References */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className={sectionTitleClass}><FileText size={18} className="text-blue-500"/> References & Dates</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className={labelClass}>Policy / Ref Number</label>
                            <input type="text" name="policyNumber" value={formData.policyNumber || ''} onChange={handleChange} className={`${inputClass} font-mono font-bold text-gray-700`}/>
                        </div>
                        <div>
                            <label className={labelClass}>Secondary Policy Ref</label>
                            <input type="text" name="secondaryPolicyNumber" value={formData.secondaryPolicyNumber || ''} onChange={handleChange} className={inputClass}/>
                        </div>

                        <div>
                            <label className={labelClass}>Agreement / Slip No</label>
                            <input type="text" name="agreementNumber" value={formData.agreementNumber || ''} onChange={handleChange} className={inputClass}/>
                        </div>
                        
                         <div>
                            <label className={labelClass}>Bordereau No</label>
                            <input type="text" name="bordereauNo" value={formData.bordereauNo || ''} onChange={handleChange} className={inputClass}/>
                        </div>

                         <div>
                            <label className={labelClass}>Cover Note Ref</label>
                            <input type="text" name="coverNote" value={formData.coverNote || ''} onChange={handleChange} className={inputClass}/>
                        </div>
                         
                         <div className="flex items-center gap-2 py-2">
                             <input type="checkbox" name="invoiceIssued" checked={formData.invoiceIssued || false} onChange={e => setFormData({...formData, invoiceIssued: e.target.checked})} />
                             <label className="text-sm">Invoice Issued?</label>
                         </div>
                        
                        <div className="grid grid-cols-2 gap-3 border-t pt-3">
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
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                     <h3 className={sectionTitleClass}><ShieldCheck size={18} className="text-blue-500"/> Conditions</h3>
                     <label className={labelClass}>Deductible</label>
                     <textarea rows={2} name="deductible" value={formData.deductible || ''} onChange={handleChange} className={inputClass} placeholder="e.g. 10% of claim amount"></textarea>
                     
                     <label className={labelClass + ' mt-3'}>Warranty Period (Days)</label>
                     <input type="number" name="warrantyPeriod" value={formData.warrantyPeriod || ''} onChange={handleChange} className={inputClass}/>
                     
                     <label className={labelClass + ' mt-3'}>Number of Slips</label>
                     <input type="number" name="numberOfSlips" value={formData.numberOfSlips || ''} onChange={handleChange} className={inputClass}/>
                </div>
            </div>
        </div>
      </form>

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

export default PolicyForm;
