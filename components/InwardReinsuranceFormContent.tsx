import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import {
  InwardReinsurance,
  InwardReinsuranceOrigin,
  InwardReinsuranceType,
  InwardReinsuranceStructure,
  InwardReinsurancePreset,
  Currency
} from '../types';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../theme/useTheme';
import { EntitySearchInput } from './EntitySearchInput';
import { formatSICDisplay } from '../data/sicCodes';
import { DatePickerInput, toISODateString } from './DatePickerInput';
import { SegmentedControl } from './SegmentedControl';
import { ContextBar } from './ContextBar';
import {
  FileText, Building, Hash, DollarSign,
  Layers, ArrowDownRight, Percent,
  User, Shield, AlertCircle, Save
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

// Validation errors type
type FormErrors = Record<string, string>;

interface InwardReinsuranceFormContentProps {
  id?: string;
  origin: InwardReinsuranceOrigin;
  onSave: () => void;
  onCancel: () => void;
}

export const InwardReinsuranceFormContent: React.FC<InwardReinsuranceFormContentProps> = ({
  id,
  origin,
  onSave,
  onCancel
}) => {
  const toast = useToast();
  const { t } = useTheme();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(Boolean(id)); // Only show loading for edit mode
  const [saving, setSaving] = useState(false);

  // Reusable style constants
  const labelStyle: React.CSSProperties = { color: t.text3, fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const inputStyle: React.CSSProperties = { width: '100%', height: 40, padding: '0 12px', background: t.bgInput, border: `1px solid ${t.borderL}`, borderRadius: 8, color: t.text1, fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'box-shadow 0.15s' };
  const inputErrorStyle: React.CSSProperties = { border: `1px solid ${t.danger}`, boxShadow: `0 0 0 2px ${t.dangerBg}` };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
  const selectErrorStyle: React.CSSProperties = { ...inputErrorStyle };
  const cardStyle: React.CSSProperties = { background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: t.shadow, overflow: 'hidden' };
  const sectionHeaderStyle: React.CSSProperties = { padding: '12px 20px', borderBottom: `1px solid ${t.border}` };
  const sectionTitleStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: t.text3, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 };
  const sectionBodyStyle: React.CSSProperties = { padding: 20 };

  // Form Section Card Component
  const FormSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({
    title,
    icon,
    children,
    className = ''
  }) => {
    return (
      <div className={className} style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={sectionTitleStyle}>
            {icon}
            {title}
          </h3>
        </div>
        <div style={sectionBodyStyle}>
          {children}
        </div>
      </div>
    );
  };

  // Error message component
  const FieldError: React.FC<{ error?: string }> = ({ error }) => {
    if (!error) return null;
    return (
      <p className="mt-1 flex items-center gap-1" style={{ color: t.danger, fontSize: 12 }}>
        <AlertCircle size={12} />
        {error}
      </p>
    );
  };

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
    origin: origin,
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

    if (!formData.contractNumber?.trim()) {
      newErrors.contractNumber = 'Contract number is required';
    }

    if (!formData.cedantName?.trim()) {
      newErrors.cedantName = 'Cedant name is required';
    }

    if (!formData.inceptionDate) {
      newErrors.inceptionDate = 'Inception date is required';
    }

    if (!formData.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    } else if (formData.inceptionDate && formData.expiryDate < formData.inceptionDate) {
      newErrors.expiryDate = 'Expiry date must be after inception date';
    }

    if (!formData.typeOfCover) {
      newErrors.typeOfCover = 'Type of cover is required';
    }

    if (!formData.classOfCover) {
      newErrors.classOfCover = 'Class of cover is required';
    }

    if (formData.ourShare === undefined || formData.ourShare === null) {
      newErrors.ourShare = 'Our share is required';
    } else if (formData.ourShare < 0 || formData.ourShare > 100) {
      newErrors.ourShare = 'Our share must be between 0 and 100';
    }

    if (activeStructure === 'NON_PROPORTIONAL') {
      if (!formData.limitOfLiability || formData.limitOfLiability <= 0) {
        newErrors.limitOfLiability = 'Limit is required for non-proportional contracts';
      }
    }

    if (activeType === 'FAC' && !formData.originalInsuredName?.trim()) {
      newErrors.originalInsuredName = 'Original insured name is required for facultative contracts';
    }

    setErrors(newErrors);

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
      // Start loading presets (non-blocking for new contracts)
      const presetsPromise = loadPresets();

      if (isEdit && id) {
        // For edit mode: wait for both presets AND contract
        await presetsPromise;
        const contract = await loadContract(id);
        if (contract) {
          setFormData(contract);
          setActiveType(contract.type);
          setActiveStructure(contract.structure);
        } else {
          toast.error('Contract not found');
          onCancel();
        }
        setLoading(false);
      }
      // For new contracts: form renders immediately, presets load in background
    };
    loadData();
  }, [id, isEdit, origin]);

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
    clearError(name);
  };

  // Handle type change
  const handleTypeChange = (type: string) => {
    setActiveType(type as InwardReinsuranceType);
    setFormData(prev => ({ ...prev, type: type as InwardReinsuranceType }));
  };

  // Handle structure change
  const handleStructureChange = (structure: string) => {
    setActiveStructure(structure as InwardReinsuranceStructure);
    setFormData(prev => ({ ...prev, structure: structure as InwardReinsuranceStructure }));
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

    if (!validateForm()) {
      toast.error('Please fix the highlighted errors before saving');
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();
      const dataToSave = {
        id: formData.id,
        contract_number: formData.contractNumber,
        origin: origin,
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
      onSave(); // Close modal and refresh list
    } catch (err: any) {
      console.error('Save error:', err);
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
    return <div className="p-8" style={{ textAlign: 'center', color: t.text4 }}>Loading...</div>;
  }

  // Show migration required message
  if (migrationRequired) {
    return (
      <div style={{ background: t.warningBg, border: `1px solid ${t.warning}`, borderRadius: 12, padding: 24 }}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: t.warningBg }}>
            <FileText size={20} style={{ color: t.warning }} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: t.text1 }}>Database Setup Required</h3>
            <p style={{ color: t.text2, marginTop: 4 }}>
              The Inward Reinsurance tables have not been created in the database yet.
            </p>
            <p style={{ color: t.text3, marginTop: 8, fontSize: 14 }}>
              To use this feature, please run the migration script in your Supabase SQL Editor:
            </p>
            <code className="block" style={{ marginTop: 8, padding: 12, background: t.bgInput, borderRadius: 8, fontSize: 14, color: t.text1, fontFamily: 'monospace' }}>
              supabase_inward_reinsurance_migration.sql
            </code>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setMigrationRequired(false); window.location.reload(); }}
                style={{ padding: '8px 16px', background: t.warning, color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer' }}
              >
                Retry After Running Migration
              </button>
              <button
                onClick={onCancel}
                style={{ padding: '8px 16px', background: t.bgPanel, border: `1px solid ${t.borderL}`, color: t.text2, borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
              >
                Cancel
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

  return (
    <div className="rounded-xl" style={{ background: t.bgApp }}>
      {/* Context Bar */}
      <ContextBar
        status={formData.status || 'DRAFT'}
        breadcrumbs={[
          { label: 'Inward Reinsurance' },
          { label: activeType === 'FAC' ? 'Facultative' : 'Treaty' },
          { label: isEdit ? (formData.contractNumber || 'Edit Contract') : 'New Contract' }
        ]}
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-5">

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
                <label style={labelStyle}>
                  Contract Number<span style={{ color: t.danger, marginLeft: 2 }}>*</span>
                </label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
                  <input
                    type="text"
                    name="contractNumber"
                    value={formData.contractNumber}
                    onChange={handleChange}
                    data-error={!!errors.contractNumber}
                    placeholder="e.g., IR-2026-001"
                    style={{ ...inputStyle, paddingLeft: 32, ...(errors.contractNumber ? inputErrorStyle : {}) }}
                  />
                </div>
                <FieldError error={errors.contractNumber} />
              </div>

              <div className="w-28">
                <label style={labelStyle}>UW Year</label>
                <input
                  type="number"
                  name="uwYear"
                  value={formData.uwYear}
                  onChange={handleChange}
                  min={2000}
                  max={2100}
                  placeholder="2026"
                  style={inputStyle}
                />
              </div>

              <div className="w-40">
                <label style={labelStyle}>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  style={selectStyle}
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
                  <label style={labelStyle}>Treaty Name</label>
                  <input
                    type="text"
                    name="treatyName"
                    value={formData.treatyName}
                    onChange={handleChange}
                    placeholder="e.g., Property Quota Share 2026"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Treaty Number</label>
                  <input
                    type="text"
                    name="treatyNumber"
                    value={formData.treatyNumber}
                    onChange={handleChange}
                    placeholder="e.g., TRT-2026-001"
                    style={inputStyle}
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
                  <label style={labelStyle}>
                    Original Insured Name<span style={{ color: t.danger, marginLeft: 2 }}>*</span>
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
                    <input
                      type="text"
                      name="originalInsuredName"
                      value={formData.originalInsuredName || ''}
                      onChange={handleChange}
                      data-error={!!errors.originalInsuredName}
                      placeholder="Company name"
                      style={{ ...inputStyle, paddingLeft: 32, ...(errors.originalInsuredName ? inputErrorStyle : {}) }}
                    />
                  </div>
                  <FieldError error={errors.originalInsuredName} />
                </div>
                <div>
                  <label style={labelStyle}>Risk Location</label>
                  <select
                    name="territory"
                    value={formData.territory || ''}
                    onChange={handleChange}
                    style={selectStyle}
                  >
                    <option value="">Select country...</option>
                    {(origin === 'FOREIGN' ? FOREIGN_COUNTRIES : DOMESTIC_COUNTRIES).map(country => (
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
                    clearError('cedantName');
                  }}
                  placeholder="Insurance company name"
                  required
                  className={errors.cedantName ? 'has-error' : ''}
                />
                {formData.cedantSicCode && (
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: t.bgInput, border: `1px solid ${t.border}`, fontSize: 12 }}>
                    <span style={{ color: t.text4 }}>Industry:</span>
                    <span style={{ color: t.text3 }}>{formatSICDisplay(formData.cedantSicCode)}</span>
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
                }}
                placeholder="Broker name"
              />
              {origin === 'FOREIGN' && (
                <>
                  <div>
                    <label style={labelStyle}>Cedant Country</label>
                    <select
                      name="cedantCountry"
                      value={formData.cedantCountry || ''}
                      onChange={handleChange}
                      style={selectStyle}
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
                    <label style={labelStyle}>Cedant Rating</label>
                    <select
                      name="cedantRating"
                      value={(formData as any).cedantRating || ''}
                      onChange={handleChange}
                      style={selectStyle}
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
                <label style={labelStyle}>
                  Type of Cover<span style={{ color: t.danger, marginLeft: 2 }}>*</span>
                </label>
                <select
                  name="typeOfCover"
                  value={formData.typeOfCover}
                  onChange={handleChange}
                  data-error={!!errors.typeOfCover}
                  style={{ ...selectStyle, ...(errors.typeOfCover ? selectErrorStyle : {}) }}
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
                <label style={labelStyle}>
                  Class of Cover<span style={{ color: t.danger, marginLeft: 2 }}>*</span>
                </label>
                <select
                  name="classOfCover"
                  value={formData.classOfCover}
                  onChange={handleChange}
                  data-error={!!errors.classOfCover}
                  style={{ ...selectStyle, ...(errors.classOfCover ? selectErrorStyle : {}) }}
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
                <label style={labelStyle}>Currency</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  style={selectStyle}
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
                    clearError('inceptionDate');
                  }}
                  required
                  className={errors.inceptionDate ? 'has-error' : ''}
                />
                <FieldError error={errors.inceptionDate} />
              </div>
              <div>
                <DatePickerInput
                  label="Period To"
                  value={formData.expiryDate ? new Date(formData.expiryDate) : null}
                  onChange={(date) => {
                    setFormData(prev => ({ ...prev, expiryDate: toISODateString(date) || '' }));
                    clearError('expiryDate');
                  }}
                  required
                  className={errors.expiryDate ? 'has-error' : ''}
                />
                <FieldError error={errors.expiryDate} />
              </div>
              <div>
                <label style={labelStyle}>Gross Premium</label>
                <input
                  type="number"
                  name="grossPremium"
                  value={formData.grossPremium}
                  onChange={handleChange}
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  style={inputStyle}
                />
              </div>
            </div>
          </FormSection>

          {/* Layer / Participation - adapts to Structure */}
          <FormSection icon={<DollarSign className="w-4 h-4" />} title="Layer / Participation">
            {activeStructure === 'PROPORTIONAL' ? (
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label style={labelStyle}>Our Share %<span style={{ color: t.danger, marginLeft: 2 }}>*</span></label>
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
                      style={{ ...inputStyle, paddingRight: 32, ...(errors.ourShare ? inputErrorStyle : {}) }}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
                  </div>
                  <FieldError error={errors.ourShare} />
                </div>
                <div>
                  <label style={labelStyle}>Ceding Commission %</label>
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
                      style={{ ...inputStyle, paddingRight: 32 }}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Our Capacity / Line</label>
                  <input
                    type="number"
                    name="limitOfLiability"
                    value={formData.limitOfLiability}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    placeholder="e.g., 500,000"
                    style={inputStyle}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-5">
                <div>
                  <label style={labelStyle}>Limit<span style={{ color: t.danger, marginLeft: 2 }}>*</span></label>
                  <input
                    type="number"
                    name="limitOfLiability"
                    value={formData.limitOfLiability}
                    onChange={handleChange}
                    data-error={!!errors.limitOfLiability}
                    min={0}
                    step="0.01"
                    placeholder="e.g., 10,000,000"
                    style={{ ...inputStyle, ...(errors.limitOfLiability ? inputErrorStyle : {}) }}
                  />
                  <FieldError error={errors.limitOfLiability} />
                </div>
                <div>
                  <label style={labelStyle}>Excess / Attachment</label>
                  <input
                    type="number"
                    name="excessPoint"
                    value={formData.excessPoint}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    placeholder="e.g., 5,000,000"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Rate on Line %</label>
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
                      style={{ ...inputStyle, paddingRight: 32 }}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Our Share %<span style={{ color: t.danger, marginLeft: 2 }}>*</span></label>
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
                      style={{ ...inputStyle, paddingRight: 32, ...(errors.ourShare ? inputErrorStyle : {}) }}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
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
                  <label style={labelStyle}>Layer Number</label>
                  <input
                    type="number"
                    name="layerNumber"
                    value={formData.layerNumber}
                    onChange={handleChange}
                    min={1}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Aggregate Limit</label>
                  <input
                    type="number"
                    name="aggregateLimit"
                    value={formData.aggregateLimit}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Aggregate Deductible</label>
                  <input
                    type="number"
                    name="aggregateDeductible"
                    value={formData.aggregateDeductible}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Number of Reinstatements</label>
                  <input
                    type="number"
                    name="reinstatements"
                    value={formData.reinstatements}
                    onChange={handleChange}
                    min={0}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Reinstatement Premium (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="reinstatementPremium"
                      value={formData.reinstatementPremium}
                      onChange={handleChange}
                      min={0}
                      max={100}
                      step="0.01"
                      style={{ ...inputStyle, paddingRight: 32 }}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
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
              style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'none' }}
            />
          </FormSection>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ padding: '10px 16px', color: t.text2, background: t.bgPanel, border: `1px solid ${t.borderL}`, borderRadius: 8, fontWeight: 500, fontSize: 14, cursor: 'pointer', transition: 'background 0.15s' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2"
              style={{ padding: '10px 24px', background: t.accent, color: '#fff', borderRadius: 8, fontWeight: 500, fontSize: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, transition: 'background 0.15s' }}
            >
              <Save size={16} />
              {saving ? 'Saving...' : (isEdit ? 'Update Contract' : 'Create Contract')}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
};

export default InwardReinsuranceFormContent;
