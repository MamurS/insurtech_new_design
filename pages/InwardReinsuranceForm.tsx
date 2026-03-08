import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
  InwardReinsurance,
  InwardReinsuranceOrigin,
  InwardReinsuranceType,
  InwardReinsuranceStructure,
  InwardReinsuranceStatus,
  InwardReinsurancePreset,
  Currency
} from '../types';
import { useToast } from '../context/ToastContext';
import { EntitySearchInput } from '../components/EntitySearchInput';
import { formatSICDisplay } from '../data/sicCodes';
import { DatePickerInput, toISODateString } from '../components/DatePickerInput';
import { SegmentedControl } from '../components/SegmentedControl';
import { ContextBar } from '../components/ContextBar';
import {
  ArrowLeft, FileText, Building, Hash, DollarSign,
  Globe, Home, Layers, ArrowDownRight, Percent,
  User, Shield, AlertCircle
} from 'lucide-react';

// Country list for Risk Location
const ALL_COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahrain', 'Bangladesh', 'Belarus', 'Belgium', 'Brazil', 'Bulgaria',
  'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark',
  'Egypt', 'Estonia',
  'Finland', 'France',
  'Georgia', 'Germany', 'Greece',
  'Hong Kong', 'Hungary',
  'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan',
  'Latvia', 'Lebanon', 'Lithuania', 'Luxembourg',
  'Malaysia', 'Mexico', 'Moldova', 'Mongolia', 'Morocco',
  'Netherlands', 'New Zealand', 'Nigeria', 'Norway',
  'Oman',
  'Pakistan', 'Philippines', 'Poland', 'Portugal',
  'Qatar',
  'Romania', 'Russia',
  'Saudi Arabia', 'Serbia', 'Singapore', 'Slovakia', 'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland',
  'Taiwan', 'Tajikistan', 'Thailand', 'Turkey', 'Turkmenistan',
  'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uzbekistan',
  'Vietnam',
  'Other'
];

// Countries for Foreign (excluding Uzbekistan)
const FOREIGN_COUNTRIES = ALL_COUNTRIES.filter(c => c !== 'Uzbekistan');

// Countries for Domestic (only Uzbekistan)
const DOMESTIC_COUNTRIES = ['Uzbekistan'];

// Form Section Card Component (non-collapsible, matching prototype)
interface FormSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const FormSection: React.FC<FormSectionProps> = ({
  title,
  icon,
  children,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
          {icon}
          {title}
        </h3>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
};

// Error message component
interface FieldErrorProps {
  error?: string;
}

const FieldError: React.FC<FieldErrorProps> = ({ error }) => {
  if (!error) return null;
  return (
    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
      <AlertCircle size={12} />
      {error}
    </p>
  );
};

// Background gradient classes based on type + structure
const backgroundGradients: Record<string, string> = {
  'FAC-PROPORTIONAL': 'bg-gradient-to-br from-amber-50/50 via-blue-50/30 to-slate-50',
  'FAC-NON_PROPORTIONAL': 'bg-gradient-to-br from-amber-50/50 via-violet-50/30 to-slate-50',
  'TREATY-PROPORTIONAL': 'bg-gradient-to-br from-emerald-50/50 via-blue-50/30 to-slate-50',
  'TREATY-NON_PROPORTIONAL': 'bg-gradient-to-br from-emerald-50/50 via-violet-50/30 to-slate-50',
};

// Validation errors type
type FormErrors = Record<string, string>;

const InwardReinsuranceForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // Determine origin from URL path
  const pathOrigin: InwardReinsuranceOrigin = location.pathname.includes('/foreign') ? 'FOREIGN' : 'DOMESTIC';

  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'unsaved' | 'saving' | 'saved'>('unsaved');

  // Validation errors state
  const [errors, setErrors] = useState<FormErrors>({});

  // Tab states
  const [activeType, setActiveType] = useState<InwardReinsuranceType>('FAC');
  const [activeStructure, setActiveStructure] = useState<InwardReinsuranceStructure>('PROPORTIONAL');

  // Preset data
  const [typeOfCoverOptions, setTypeOfCoverOptions] = useState<InwardReinsurancePreset[]>([]);
  const [classOfCoverOptions, setClassOfCoverOptions] = useState<InwardReinsurancePreset[]>([]);
  const [industryOptions, setIndustryOptions] = useState<InwardReinsurancePreset[]>([]);

  // Migration state
  const [migrationRequired, setMigrationRequired] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<InwardReinsurance>>({
    id: crypto.randomUUID(),
    contractNumber: '',
    origin: pathOrigin,
    type: 'FAC',
    structure: 'PROPORTIONAL',
    status: 'DRAFT',
    cedantName: '',
    brokerName: '',
    inceptionDate: '',
    expiryDate: '',
    typeOfCover: '',
    classOfCover: '',
    industry: '',
    territory: '',
    originalInsuredName: '',
    riskDescription: '',
    currency: Currency.USD,
    limitOfLiability: 0,
    deductible: 0,
    retention: 0,
    ourShare: 100,
    grossPremium: 0,
    commissionPercent: 0,
    netPremium: 0,
    minimumPremium: 0,
    depositPremium: 0,
    adjustablePremium: false,
    treatyName: '',
    treatyNumber: '',
    layerNumber: 1,
    excessPoint: 0,
    aggregateLimit: 0,
    aggregateDeductible: 0,
    reinstatements: 0,
    reinstatementPremium: 0,
    notes: '',
    uwYear: new Date().getFullYear()
  });

  // Get background class based on current selections
  const getBackgroundClass = () => {
    const key = `${activeType}-${activeStructure}`;
    return backgroundGradients[key] || backgroundGradients['FAC-PROPORTIONAL'];
  };

  // Helper function to check migration errors
  const checkMigrationError = (error: any): boolean => {
    const errorStr = JSON.stringify(error);
    return (
      error?.code === 'PGRST205' ||
      error?.code === '42P01' ||
      error?.status === 404 ||
      error?.statusCode === 404 ||
      error?.message?.includes('inward_reinsurance') ||
      error?.message?.includes('schema cache') ||
      error?.message?.includes('does not exist') ||
      errorStr?.includes('PGRST205') ||
      errorStr?.includes('inward_reinsurance') ||
      errorStr?.includes('schema cache')
    );
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Contract Number - Required
    if (!formData.contractNumber?.trim()) {
      newErrors.contractNumber = 'Contract number is required';
    }

    // Cedant Name - Required
    if (!formData.cedantName?.trim()) {
      newErrors.cedantName = 'Cedant name is required';
    }

    // Inception Date - Required
    if (!formData.inceptionDate) {
      newErrors.inceptionDate = 'Inception date is required';
    }

    // Expiry Date - Required, must be after inception
    if (!formData.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    } else if (formData.inceptionDate && formData.expiryDate < formData.inceptionDate) {
      newErrors.expiryDate = 'Expiry date must be after inception date';
    }

    // Type of Cover - Required
    if (!formData.typeOfCover) {
      newErrors.typeOfCover = 'Type of cover is required';
    }

    // Class of Cover - Required
    if (!formData.classOfCover) {
      newErrors.classOfCover = 'Class of cover is required';
    }

    // Our Share - Required, 0-100
    if (formData.ourShare === undefined || formData.ourShare === null) {
      newErrors.ourShare = 'Our share is required';
    } else if (formData.ourShare < 0 || formData.ourShare > 100) {
      newErrors.ourShare = 'Our share must be between 0 and 100';
    }

    // Limit of Liability - Required for Non-Proportional
    if (activeStructure === 'NON_PROPORTIONAL') {
      if (!formData.limitOfLiability || formData.limitOfLiability <= 0) {
        newErrors.limitOfLiability = 'Limit is required for non-proportional contracts';
      }
    }

    // FAC-specific: Original Insured Name required
    if (activeType === 'FAC' && !formData.originalInsuredName?.trim()) {
      newErrors.originalInsuredName = 'Original insured name is required for facultative contracts';
    }

    setErrors(newErrors);

    // Scroll to first error
    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => {
        const firstErrorField = document.querySelector('[data-error="true"]');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }

    return Object.keys(newErrors).length === 0;
  };

  // Clear specific error when field changes
  const clearError = (fieldName: string) => {
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // Load data
  useEffect(() => {
    const loadData = async () => {
      await loadPresets();

      if (isEdit && id) {
        const contract = await loadContract(id);
        if (contract) {
          setFormData(contract);
          setActiveType(contract.type);
          setActiveStructure(contract.structure);
        } else {
          toast.error('Contract not found');
          navigate(`/inward-reinsurance/${pathOrigin.toLowerCase()}`);
        }
      }
      setLoading(false);
    };
    loadData();
  }, [id, isEdit, pathOrigin]);

  // Update origin when path changes
  useEffect(() => {
    if (!isEdit) {
      setFormData(prev => ({ ...prev, origin: pathOrigin }));
    }
  }, [pathOrigin, isEdit]);

  // Load presets from database
  const loadPresets = async () => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('inward_reinsurance_presets')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) {
          if (checkMigrationError(error)) {
            setMigrationRequired(true);
          }
          console.error('Failed to load presets:', error);
          return;
        }

        if (data) {
          setTypeOfCoverOptions(data.filter(p => p.category === 'TYPE_OF_COVER'));
          setClassOfCoverOptions(data.filter(p => p.category === 'CLASS_OF_COVER'));
          setIndustryOptions(data.filter(p => p.category === 'INDUSTRY'));
        }
      }
    } catch (err: any) {
      console.error('Failed to load presets:', err);
      if (checkMigrationError(err)) {
        setMigrationRequired(true);
      }
    }
  };

  // Load contract from database
  const loadContract = async (contractId: string): Promise<InwardReinsurance | null> => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('inward_reinsurance')
          .select('*')
          .eq('id', contractId)
          .single();

        if (error) {
          if (checkMigrationError(error)) {
            setMigrationRequired(true);
          }
          console.error('Failed to load contract:', error);
          return null;
        }

        if (data) {
          return {
            id: data.id,
            contractNumber: data.contract_number,
            origin: data.origin,
            type: data.type,
            structure: data.structure,
            status: data.status,
            cedantName: data.cedant_name,
            cedantEntityId: data.cedant_entity_id,
            cedantCountry: data.cedant_country,
            brokerName: data.broker_name,
            brokerEntityId: data.broker_entity_id,
            inceptionDate: data.inception_date,
            expiryDate: data.expiry_date,
            uwYear: data.uw_year,
            typeOfCover: data.type_of_cover,
            classOfCover: data.class_of_cover,
            industry: data.industry,
            territory: data.territory,
            originalInsuredName: data.original_insured_name,
            riskDescription: data.risk_description,
            currency: data.currency,
            limitOfLiability: data.limit_of_liability,
            deductible: data.deductible,
            retention: data.retention,
            ourShare: data.our_share,
            grossPremium: data.gross_premium,
            commissionPercent: data.commission_percent,
            netPremium: data.net_premium,
            minimumPremium: data.minimum_premium,
            depositPremium: data.deposit_premium,
            adjustablePremium: data.adjustable_premium,
            treatyName: data.treaty_name,
            treatyNumber: data.treaty_number,
            layerNumber: data.layer_number,
            excessPoint: data.excess_point,
            aggregateLimit: data.aggregate_limit,
            aggregateDeductible: data.aggregate_deductible,
            reinstatements: data.reinstatements,
            reinstatementPremium: data.reinstatement_premium,
            notes: data.notes,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            createdBy: data.created_by,
            isDeleted: data.is_deleted
          };
        }
      }
      return null;
    } catch (err) {
      console.error('Failed to load contract:', err);
      return null;
    }
  };

  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked :
              type === 'number' ? Number(value) : value
    }));
    setSaveState('unsaved');
    clearError(name);
  };

  // Handle type change
  const handleTypeChange = (type: string) => {
    setActiveType(type as InwardReinsuranceType);
    setFormData(prev => ({ ...prev, type: type as InwardReinsuranceType }));
    setSaveState('unsaved');
  };

  // Handle structure change
  const handleStructureChange = (structure: string) => {
    setActiveStructure(structure as InwardReinsuranceStructure);
    setFormData(prev => ({ ...prev, structure: structure as InwardReinsuranceStructure }));
    setSaveState('unsaved');
  };

  // Calculate net premium
  useEffect(() => {
    const gross = formData.grossPremium || 0;
    const commission = formData.commissionPercent || 0;
    const net = gross * (1 - commission / 100);
    setFormData(prev => ({ ...prev, netPremium: Math.round(net * 100) / 100 }));
  }, [formData.grossPremium, formData.commissionPercent]);

  // Handle form submit
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Validate form first
    if (!validateForm()) {
      toast.error('Please fix the highlighted errors before saving');
      return;
    }

    setSaving(true);
    setSaveState('saving');

    try {
      const now = new Date().toISOString();
      const dataToSave = {
        id: formData.id,
        contract_number: formData.contractNumber,
        origin: pathOrigin,
        type: activeType,
        structure: activeType === 'TREATY' ? activeStructure : 'PROPORTIONAL',
        status: formData.status || 'DRAFT',
        cedant_name: formData.cedantName,
        cedant_entity_id: formData.cedantEntityId || null,
        cedant_country: formData.cedantCountry || null,
        broker_name: formData.brokerName || null,
        broker_entity_id: formData.brokerEntityId || null,
        inception_date: formData.inceptionDate,
        expiry_date: formData.expiryDate,
        uw_year: formData.uwYear,
        type_of_cover: formData.typeOfCover,
        class_of_cover: formData.classOfCover,
        industry: formData.industry || null,
        territory: formData.territory || null,
        original_insured_name: activeType === 'FAC' ? formData.originalInsuredName : null,
        risk_description: formData.riskDescription || null,
        currency: formData.currency,
        limit_of_liability: formData.limitOfLiability,
        deductible: formData.deductible || null,
        retention: formData.retention || null,
        our_share: formData.ourShare,
        gross_premium: formData.grossPremium,
        commission_percent: formData.commissionPercent || null,
        net_premium: formData.netPremium || null,
        minimum_premium: formData.minimumPremium || null,
        deposit_premium: formData.depositPremium || null,
        adjustable_premium: formData.adjustablePremium || false,
        treaty_name: activeType === 'TREATY' ? formData.treatyName : null,
        treaty_number: activeType === 'TREATY' ? formData.treatyNumber : null,
        layer_number: activeType === 'TREATY' && activeStructure === 'NON_PROPORTIONAL' ? formData.layerNumber : null,
        excess_point: activeType === 'TREATY' && activeStructure === 'NON_PROPORTIONAL' ? formData.excessPoint : null,
        aggregate_limit: activeType === 'TREATY' && activeStructure === 'NON_PROPORTIONAL' ? formData.aggregateLimit : null,
        aggregate_deductible: activeType === 'TREATY' && activeStructure === 'NON_PROPORTIONAL' ? formData.aggregateDeductible : null,
        reinstatements: activeType === 'TREATY' && activeStructure === 'NON_PROPORTIONAL' ? formData.reinstatements : null,
        reinstatement_premium: activeType === 'TREATY' && activeStructure === 'NON_PROPORTIONAL' ? formData.reinstatementPremium : null,
        notes: formData.notes || null,
        updated_at: now,
        is_deleted: false
      };

      if (!isEdit) {
        (dataToSave as any).created_at = now;
      }

      if (supabase) {
        if (isEdit) {
          const { error } = await supabase
            .from('inward_reinsurance')
            .update(dataToSave)
            .eq('id', formData.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('inward_reinsurance')
            .insert([dataToSave]);

          if (error) throw error;
        }
      }

      toast.success(isEdit ? 'Contract updated successfully!' : 'Contract created successfully!');
      setSaveState('saved');
      navigate(`/inward-reinsurance/${pathOrigin.toLowerCase()}`);
    } catch (err: any) {
      console.error('Save error:', err);
      setSaveState('unsaved');
      if (checkMigrationError(err)) {
        setMigrationRequired(true);
        toast.error('Database tables not found. Please run the migration script.');
      } else {
        toast.error('Failed to save: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  // Show migration required message
  if (migrationRequired) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate(`/inward-reinsurance/${pathOrigin.toLowerCase()}`)}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            {pathOrigin === 'FOREIGN' ? 'Foreign' : 'Domestic'} Inward Reinsurance
          </h1>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <FileText size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-800">Database Setup Required</h3>
              <p className="text-amber-700 mt-1">
                The Inward Reinsurance tables have not been created in the database yet.
              </p>
              <p className="text-amber-600 mt-2 text-sm">
                To use this feature, please run the migration script in your Supabase SQL Editor:
              </p>
              <code className="block mt-2 p-3 bg-amber-100 rounded-lg text-sm text-amber-900 font-mono">
                supabase_inward_reinsurance_migration.sql
              </code>
              <p className="text-amber-600 mt-3 text-sm">
                You can find this file in the root directory of the project.
              </p>
              <button
                onClick={() => { setMigrationRequired(false); window.location.reload(); }}
                className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
              >
                Retry After Running Migration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Priority currencies
  const priorityCurrencies = ['UZS', 'USD', 'EUR'];
  const allCurrencies = Object.values(Currency);
  const sortedCurrencies = [
    ...priorityCurrencies,
    ...allCurrencies.filter(c => !priorityCurrencies.includes(c)).sort()
  ];

  const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";
  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow";
  const inputErrorClass = "border-red-500 ring-2 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30";
  const selectClass = "w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow bg-white";
  const selectErrorClass = "border-red-500 ring-2 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30";

  // Get save state text
  const getSaveStateText = () => {
    if (saveState === 'saving') return 'Saving...';
    if (saveState === 'saved') return 'Saved';
    return 'Not saved yet';
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${getBackgroundClass()}`}>
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/inward-reinsurance/${pathOrigin.toLowerCase()}`)}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {isEdit ? 'Edit' : 'New'} {pathOrigin === 'FOREIGN' ? 'Foreign' : 'Domestic'} Inward Reinsurance
            </h1>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
              {pathOrigin === 'FOREIGN' ? <Globe className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
              {pathOrigin === 'FOREIGN' ? 'Overseas/International' : 'Domestic'} Contract
            </p>
          </div>
        </div>
      </div>

      {/* Context Bar */}
      <ContextBar
        status={formData.status || 'DRAFT'}
        breadcrumbs={[
          {
            label: 'Inward Reinsurance',
            href: `/inward-reinsurance/${pathOrigin.toLowerCase()}`
          },
          {
            label: activeType === 'FAC' ? 'Facultative' : 'Treaty'
          },
          {
            label: isEdit ? (formData.contractNumber || 'Edit Contract') : 'New Contract'
          },
        ]}
      />

      {/* Form Content */}
      <form onSubmit={handleSubmit}>
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

          {/* Contract Information */}
          <FormSection icon={<FileText className="w-4 h-4" />} title="Contract Information">
            <div className="flex flex-wrap items-end gap-5">
              <SegmentedControl
                label="Contract Type"
                options={[
                  { value: 'FAC', label: 'Facultative', icon: <FileText className="w-4 h-4" /> },
                  { value: 'TREATY', label: 'Treaty', icon: <Layers className="w-4 h-4" /> },
                ]}
                value={activeType}
                onChange={handleTypeChange}
              />

              <SegmentedControl
                label="Structure"
                options={[
                  { value: 'PROPORTIONAL', label: 'Proportional' },
                  { value: 'NON_PROPORTIONAL', label: 'Non-Proportional' },
                ]}
                value={activeStructure}
                onChange={handleStructureChange}
              />

              <div className="w-48">
                <label className={labelClass}>
                  Contract Number<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="contractNumber"
                    value={formData.contractNumber}
                    onChange={handleChange}
                    data-error={!!errors.contractNumber}
                    placeholder="e.g., IR-2026-001"
                    className={`${inputClass} pl-8 ${errors.contractNumber ? inputErrorClass : ''}`}
                  />
                </div>
                <FieldError error={errors.contractNumber} />
              </div>

              <div className="w-28">
                <label className={labelClass}>UW Year</label>
                <input
                  type="number"
                  name="uwYear"
                  value={formData.uwYear}
                  onChange={handleChange}
                  min={2000}
                  max={2100}
                  placeholder="2026"
                  className={inputClass}
                />
              </div>

              <div className="w-40">
                <label className={labelClass}>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={selectClass}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </FormSection>

          {/* Treaty Details - conditional */}
          {activeType === 'TREATY' && (
            <FormSection
              icon={<Layers className="w-4 h-4" />}
              title="Treaty Details"
              className="animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Treaty Name</label>
                  <input
                    type="text"
                    name="treatyName"
                    value={formData.treatyName}
                    onChange={handleChange}
                    placeholder="e.g., Property Quota Share 2026"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Treaty Number</label>
                  <input
                    type="text"
                    name="treatyNumber"
                    value={formData.treatyNumber}
                    onChange={handleChange}
                    placeholder="e.g., TRT-2026-001"
                    className={inputClass}
                  />
                </div>
              </div>
            </FormSection>
          )}

          {/* Facultative Details - conditional */}
          {activeType === 'FAC' && (
            <FormSection
              icon={<FileText className="w-4 h-4" />}
              title="Facultative Details"
              className="animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>
                    Original Insured Name<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="originalInsuredName"
                      value={formData.originalInsuredName || ''}
                      onChange={handleChange}
                      data-error={!!errors.originalInsuredName}
                      placeholder="Company name"
                      className={`${inputClass} pl-8 ${errors.originalInsuredName ? inputErrorClass : ''}`}
                    />
                  </div>
                  <FieldError error={errors.originalInsuredName} />
                </div>
                <div>
                  <label className={labelClass}>Risk Location</label>
                  <select
                    name="territory"
                    value={formData.territory || ''}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Select country...</option>
                    {(pathOrigin === 'FOREIGN' ? FOREIGN_COUNTRIES : DOMESTIC_COUNTRIES).map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>
          )}

          {/* Cedant / Source Information */}
          <FormSection icon={<Building className="w-4 h-4" />} title="Cedant / Source Information">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <EntitySearchInput
                  label="Cedant Name"
                  value={formData.cedantName || ''}
                  onChange={(name, entityId) => {
                    setFormData(prev => ({
                      ...prev,
                      cedantName: name,
                      cedantEntityId: entityId
                    }));
                    setSaveState('unsaved');
                    clearError('cedantName');
                  }}
                  onEntitySelect={(entity) => {
                    setFormData(prev => ({
                      ...prev,
                      cedantName: entity.fullName,
                      cedantEntityId: entity.id,
                      cedantSicCode: entity.sicCode || '',
                      cedantSicSection: entity.sicSection || ''
                    }));
                    setSaveState('unsaved');
                    clearError('cedantName');
                  }}
                  placeholder="Insurance company name"
                  required
                  className={errors.cedantName ? 'has-error' : ''}
                />
                {formData.cedantSicCode && (
                  <div className="mt-1.5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-gray-400">Industry:</span>
                    <span className="text-gray-600">{formatSICDisplay(formData.cedantSicCode)}</span>
                  </div>
                )}
                <FieldError error={errors.cedantName} />
              </div>
              <EntitySearchInput
                label="Broker (if applicable)"
                value={formData.brokerName || ''}
                onChange={(name, entityId) => {
                  setFormData(prev => ({
                    ...prev,
                    brokerName: name,
                    brokerEntityId: entityId
                  }));
                  setSaveState('unsaved');
                }}
                placeholder="Broker name"
              />
              {pathOrigin === 'FOREIGN' && (
                <>
                  <div>
                    <label className={labelClass}>Cedant Country</label>
                    <select
                      name="cedantCountry"
                      value={formData.cedantCountry || ''}
                      onChange={handleChange}
                      className={selectClass}
                    >
                      <option value="">Select country...</option>
                      <option value="TR">Turkey</option>
                      <option value="KZ">Kazakhstan</option>
                      <option value="AZ">Azerbaijan</option>
                      <option value="GE">Georgia</option>
                      <option value="RU">Russia</option>
                      <option value="UK">United Kingdom</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                      <option value="CH">Switzerland</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Cedant Rating</label>
                    <select
                      name="cedantRating"
                      value={(formData as any).cedantRating || ''}
                      onChange={handleChange}
                      className={selectClass}
                    >
                      <option value="">Select rating...</option>
                      <option value="A+">A+ (Superior)</option>
                      <option value="A">A (Excellent)</option>
                      <option value="A-">A- (Excellent)</option>
                      <option value="B++">B++ (Good)</option>
                      <option value="B+">B+ (Good)</option>
                      <option value="NR">Not Rated</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </FormSection>

          {/* Coverage & Terms */}
          <FormSection icon={<Shield className="w-4 h-4" />} title="Coverage & Terms">
            <div className="grid grid-cols-3 gap-5 mb-5">
              <div>
                <label className={labelClass}>
                  Type of Cover<span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  name="typeOfCover"
                  value={formData.typeOfCover}
                  onChange={handleChange}
                  data-error={!!errors.typeOfCover}
                  className={`${selectClass} ${errors.typeOfCover ? selectErrorClass : ''}`}
                >
                  <option value="">Select...</option>
                  {typeOfCoverOptions.length > 0 ? (
                    typeOfCoverOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.value}</option>
                    ))
                  ) : (
                    <>
                      <option value="Property">Property</option>
                      <option value="Energy">Energy</option>
                      <option value="Marine">Marine</option>
                      <option value="Casualty">Casualty</option>
                      <option value="Aviation">Aviation</option>
                      <option value="Engineering">Engineering</option>
                    </>
                  )}
                </select>
                <FieldError error={errors.typeOfCover} />
              </div>
              <div>
                <label className={labelClass}>
                  Class of Cover<span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  name="classOfCover"
                  value={formData.classOfCover}
                  onChange={handleChange}
                  data-error={!!errors.classOfCover}
                  className={`${selectClass} ${errors.classOfCover ? selectErrorClass : ''}`}
                >
                  <option value="">Select...</option>
                  {classOfCoverOptions.length > 0 ? (
                    classOfCoverOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.value}</option>
                    ))
                  ) : (
                    <>
                      <option value="All Risks">All Risks</option>
                      <option value="Fire & Allied Perils">Fire & Allied Perils</option>
                      <option value="Machinery Breakdown">Machinery Breakdown</option>
                      <option value="Business Interruption">Business Interruption</option>
                      <option value="General Liability">General Liability</option>
                      <option value="Cargo">Cargo</option>
                    </>
                  )}
                </select>
                <FieldError error={errors.classOfCover} />
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className={selectClass}
                >
                  {sortedCurrencies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <DatePickerInput
                  label="Period From"
                  value={formData.inceptionDate ? new Date(formData.inceptionDate) : null}
                  onChange={(date) => {
                    setFormData(prev => ({ ...prev, inceptionDate: toISODateString(date) || '' }));
                    setSaveState('unsaved');
                    clearError('inceptionDate');
                  }}
                  required
                  className={errors.inceptionDate ? 'border-red-500 ring-2 ring-red-500/20' : ''}
                />
                <FieldError error={errors.inceptionDate} />
              </div>
              <div>
                <DatePickerInput
                  label="Period To"
                  value={formData.expiryDate ? new Date(formData.expiryDate) : null}
                  onChange={(date) => {
                    setFormData(prev => ({ ...prev, expiryDate: toISODateString(date) || '' }));
                    setSaveState('unsaved');
                    clearError('expiryDate');
                  }}
                  required
                  className={errors.expiryDate ? 'border-red-500 ring-2 ring-red-500/20' : ''}
                />
                <FieldError error={errors.expiryDate} />
              </div>
              <div>
                <label className={labelClass}>Gross Premium</label>
                <input
                  type="number"
                  name="grossPremium"
                  value={formData.grossPremium}
                  onChange={handleChange}
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
            </div>
          </FormSection>

          {/* Layer / Participation - adapts to Structure */}
          <FormSection icon={<DollarSign className="w-4 h-4" />} title="Layer / Participation">
            {activeStructure === 'PROPORTIONAL' ? (
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className={labelClass}>Our Share %<span className="text-red-500 ml-0.5">*</span></label>
                  <div className="relative">
                    <input
                      type="number"
                      name="ourShare"
                      value={formData.ourShare}
                      onChange={handleChange}
                      data-error={!!errors.ourShare}
                      min={0}
                      max={100}
                      step="0.01"
                      placeholder="e.g., 5.00"
                      className={`${inputClass} pr-8 ${errors.ourShare ? inputErrorClass : ''}`}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <FieldError error={errors.ourShare} />
                </div>
                <div>
                  <label className={labelClass}>Ceding Commission %</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="commissionPercent"
                      value={formData.commissionPercent}
                      onChange={handleChange}
                      min={0}
                      max={100}
                      step="0.01"
                      placeholder="e.g., 25.00"
                      className={`${inputClass} pr-8`}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Our Capacity / Line</label>
                  <input
                    type="number"
                    name="limitOfLiability"
                    value={formData.limitOfLiability}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    placeholder="e.g., 500,000"
                    className={inputClass}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-5">
                <div>
                  <label className={labelClass}>Limit<span className="text-red-500 ml-0.5">*</span></label>
                  <input
                    type="number"
                    name="limitOfLiability"
                    value={formData.limitOfLiability}
                    onChange={handleChange}
                    data-error={!!errors.limitOfLiability}
                    min={0}
                    step="0.01"
                    placeholder="e.g., 10,000,000"
                    className={`${inputClass} ${errors.limitOfLiability ? inputErrorClass : ''}`}
                  />
                  <FieldError error={errors.limitOfLiability} />
                </div>
                <div>
                  <label className={labelClass}>Excess / Attachment</label>
                  <input
                    type="number"
                    name="excessPoint"
                    value={formData.excessPoint}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    placeholder="e.g., 5,000,000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Rate on Line %</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="rateOnLine"
                      value={(formData as any).rateOnLine || ''}
                      onChange={handleChange}
                      min={0}
                      max={100}
                      step="0.01"
                      placeholder="e.g., 2.50"
                      className={`${inputClass} pr-8`}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Our Share %<span className="text-red-500 ml-0.5">*</span></label>
                  <div className="relative">
                    <input
                      type="number"
                      name="ourShare"
                      value={formData.ourShare}
                      onChange={handleChange}
                      data-error={!!errors.ourShare}
                      min={0}
                      max={100}
                      step="0.01"
                      placeholder="e.g., 5.00"
                      className={`${inputClass} pr-8 ${errors.ourShare ? inputErrorClass : ''}`}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <FieldError error={errors.ourShare} />
                </div>
              </div>
            )}
          </FormSection>

          {/* Non-Proportional Structure - Only for Treaty + Non-Prop */}
          {activeType === 'TREATY' && activeStructure === 'NON_PROPORTIONAL' && (
            <FormSection
              icon={<ArrowDownRight className="w-4 h-4" />}
              title="Non-Proportional Structure"
              className="animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className={labelClass}>Layer Number</label>
                  <input
                    type="number"
                    name="layerNumber"
                    value={formData.layerNumber}
                    onChange={handleChange}
                    min={1}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Aggregate Limit</label>
                  <input
                    type="number"
                    name="aggregateLimit"
                    value={formData.aggregateLimit}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Aggregate Deductible</label>
                  <input
                    type="number"
                    name="aggregateDeductible"
                    value={formData.aggregateDeductible}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Number of Reinstatements</label>
                  <input
                    type="number"
                    name="reinstatements"
                    value={formData.reinstatements}
                    onChange={handleChange}
                    min={0}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Reinstatement Premium (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="reinstatementPremium"
                      value={formData.reinstatementPremium}
                      onChange={handleChange}
                      min={0}
                      max={100}
                      step="0.01"
                      className={`${inputClass} pr-8`}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>
            </FormSection>
          )}

          {/* Notes Section */}
          <FormSection icon={<FileText className="w-4 h-4" />} title="Notes">
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              rows={4}
              placeholder="Additional notes or comments..."
              className={`${inputClass} h-auto resize-none`}
            />
          </FormSection>

        </div>
      </form>
    </div>
  );
};

export default InwardReinsuranceForm;
