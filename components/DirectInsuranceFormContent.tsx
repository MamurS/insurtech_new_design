import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { Policy, PolicyStatus, Currency, PaymentStatus } from '../types';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../theme/useTheme';
import { ContextBar } from './ContextBar';
import { DatePickerInput } from './DatePickerInput';
import { EntitySearchInput } from './EntitySearchInput';
import { formatSICDisplay } from '../data/sicCodes';
import {
  Save, FileText, Building2, DollarSign,
  Globe, MapPin, Loader2, AlertCircle
} from 'lucide-react';

// Country list
const COUNTRIES = [
  'Uzbekistan',
  'Kazakhstan',
  'Kyrgyzstan',
  'Tajikistan',
  'Turkmenistan',
  'Russia',
  'China',
  'Turkey',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Germany',
  'Other'
];

const INSURANCE_CLASSES = [
  "Property",
  "Liability",
  "Motor",
  "Marine Cargo",
  "Engineering",
  "Financial Risk",
  "D&O Liability",
  "Accident & Health",
  "Travel",
  "Construction All Risk",
  "Professional Indemnity"
];

interface DirectInsuranceFormContentProps {
  id?: string;
  onSave: () => void;
  onCancel: () => void;
}

export const DirectInsuranceFormContent: React.FC<DirectInsuranceFormContentProps> = ({
  id,
  onSave,
  onCancel
}) => {
  const toast = useToast();
  const { t } = useTheme();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [formData, setFormData] = useState<Partial<Policy>>({
    channel: 'Direct',
    intermediaryType: 'Direct',
    status: PolicyStatus.DRAFT,
    paymentStatus: PaymentStatus.PENDING,
    currency: Currency.USD,
    insuredCountry: 'Uzbekistan',
    ourShare: 100,
    exchangeRate: 1,
    installments: [],
    claims: [],
    selectedClauseIds: [],
    // Uzbekistan-specific fields
    insuredINN: '',
    insuredLegalAddress: '',
    insuredBankDetails: '',
  });

  // Load existing policy for edit
  useEffect(() => {
    if (id) {
      loadPolicy();
    }
  }, [id]);

  const loadPolicy = async () => {
    try {
      const policies = await DB.getPolicies();
      const policy = policies.find(p => p.id === id);
      if (policy) {
        setFormData(policy);
      }
    } catch (error) {
      toast.error('Failed to load policy');
    } finally {
      setLoading(false);
    }
  };

  // Check if Uzbekistan is selected
  const isUzbekistan = formData.insuredCountry === 'Uzbekistan';

  // Handle input changes
  const handleChange = (field: keyof Policy, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Handle country change - clear UZ-specific fields if not Uzbekistan
  const handleCountryChange = (country: string) => {
    setFormData(prev => ({
      ...prev,
      insuredCountry: country,
      territory: country,
      jurisdiction: country,
      // Clear Uzbekistan-specific fields if switching away
      ...(country !== 'Uzbekistan' && {
        insuredINN: '',
        insuredLegalAddress: '',
        insuredBankDetails: '',
      })
    }));
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.policyNumber?.trim()) {
      newErrors.policyNumber = 'Policy number is required';
    }
    if (!formData.insuredName?.trim()) {
      newErrors.insuredName = 'Insured name is required';
    }
    if (!formData.insuredCountry) {
      newErrors.insuredCountry = 'Country is required';
    }
    if (!formData.inceptionDate) {
      newErrors.inceptionDate = 'Inception date is required';
    }
    if (!formData.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    }

    // Uzbekistan-specific validation
    if (isUzbekistan) {
      if (!formData.insuredINN?.trim()) {
        newErrors.insuredINN = 'INN is required for Uzbekistan companies';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save handler
  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const policyData: Policy = {
        ...formData,
        id: id || crypto.randomUUID(),
        channel: 'Direct',
        intermediaryType: 'Direct',
        territory: formData.territory || formData.insuredCountry || 'Uzbekistan',
        jurisdiction: formData.jurisdiction || formData.insuredCountry || 'Uzbekistan',
        industry: formData.industry || 'General',
        issueDate: formData.issueDate || new Date().toISOString(),
        grossPremium: formData.grossPremium || 0,
        netPremium: formData.netPremium || 0,
        sumInsured: formData.sumInsured || 0,
        commissionPercent: formData.commissionPercent || 0,
        ourShare: formData.ourShare || 100,
        exchangeRate: formData.exchangeRate || 1,
        installments: formData.installments || [],
        claims: formData.claims || [],
        selectedClauseIds: formData.selectedClauseIds || [],
      } as Policy;

      await DB.savePolicy(policyData);
      onSave();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" size={32} style={{ color: t.accent }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Context Bar */}
      <ContextBar
        breadcrumbs={[
          { label: 'Direct Insurance', href: '/direct-insurance' },
          { label: isEditMode ? 'Edit Policy' : 'New Policy' }
        ]}
        status={formData.status as PolicyStatus}
        statusVariant="policy"
      />

      {/* Form Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Column - Basic Info */}
        <div className="space-y-6">
          <div className="space-y-4" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 20, boxShadow: t.shadow }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: t.text1 }}>
              <FileText size={18} style={{ color: t.accent }} />
              Policy Information
            </h3>

            {/* Policy Number */}
            <div>
              <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                Policy Number <span style={{ color: t.danger }}>*</span>
              </label>
              <input
                type="text"
                value={formData.policyNumber || ''}
                onChange={(e) => handleChange('policyNumber', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: errors.policyNumber ? t.dangerBg : t.bgInput, border: `1px solid ${errors.policyNumber ? t.danger : t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                placeholder="POL-2026-001"
              />
              {errors.policyNumber && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: t.danger }}>
                  <AlertCircle size={12} /> {errors.policyNumber}
                </p>
              )}
            </div>

            {/* Status */}
            <div>
              <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Status</label>
              <select
                value={formData.status || 'Draft'}
                onChange={(e) => handleChange('status', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              >
                <option value="Draft">Draft</option>
                <option value="Pending Confirmation">Pending Confirmation</option>
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Class of Insurance */}
            <div>
              <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Class of Insurance</label>
              <select
                value={formData.classOfInsurance || ''}
                onChange={(e) => handleChange('classOfInsurance', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              >
                <option value="">Select class...</option>
                {INSURANCE_CLASSES.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                  Inception Date <span style={{ color: t.danger }}>*</span>
                </label>
                <DatePickerInput
                  value={formData.inceptionDate || ''}
                  onChange={(date) => handleChange('inceptionDate', date)}
                  error={errors.inceptionDate}
                />
              </div>
              <div>
                <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                  Expiry Date <span style={{ color: t.danger }}>*</span>
                </label>
                <DatePickerInput
                  value={formData.expiryDate || ''}
                  onChange={(date) => handleChange('expiryDate', date)}
                  error={errors.expiryDate}
                />
              </div>
            </div>
          </div>

          {/* Financial Info */}
          <div className="space-y-4" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 20, boxShadow: t.shadow }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: t.text1 }}>
              <DollarSign size={18} style={{ color: t.success }} />
              Financial Details
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Currency</label>
                <select
                  value={formData.currency || Currency.USD}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                >
                  <option value={Currency.USD}>USD</option>
                  <option value={Currency.EUR}>EUR</option>
                  <option value={Currency.UZS}>UZS</option>
                </select>
              </div>
              <div>
                <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Sum Insured</label>
                <input
                  type="number"
                  value={formData.sumInsured || ''}
                  onChange={(e) => handleChange('sumInsured', parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Gross Premium</label>
                <input
                  type="number"
                  value={formData.grossPremium || ''}
                  onChange={(e) => handleChange('grossPremium', parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Net Premium</label>
                <input
                  type="number"
                  value={formData.netPremium || ''}
                  onChange={(e) => handleChange('netPremium', parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Insured Info */}
        <div className="space-y-6">
          <div className="space-y-4" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 20, boxShadow: t.shadow }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: t.text1 }}>
              <Building2 size={18} style={{ color: t.accent }} />
              Insured Information
            </h3>

            {/* Insured Name */}
            <div>
              <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                Insured Name <span style={{ color: t.danger }}>*</span>
              </label>
              <EntitySearchInput
                label="Insured Name"
                value={formData.insuredName || ''}
                onChange={(value) => handleChange('insuredName', value)}
                onEntitySelect={(entity) => {
                  handleChange('insuredName', entity.fullName);
                  if (entity.country) handleCountryChange(entity.country);
                  if (entity.regCodeValue) handleChange('insuredINN', entity.regCodeValue);
                  if (entity.address) handleChange('insuredLegalAddress', entity.address);
                  if (entity.sicCode) {
                    handleChange('insuredSicCode', entity.sicCode);
                    handleChange('insuredSicSection', entity.sicSection || '');
                  }
                }}
                placeholder="Search or enter insured name..."
                required
              />
              {formData.insuredSicCode && (
                <div className="mt-1.5 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: t.bgInput, border: `1px solid ${t.border}` }}>
                  <span style={{ color: t.text4 }}>Industry:</span>
                  <span style={{ color: t.text2 }}>{formatSICDisplay(formData.insuredSicCode)}</span>
                </div>
              )}
            </div>

            {/* Country of Registration */}
            <div>
              <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                <Globe size={14} className="inline mr-1" />
                Country of Registration <span style={{ color: t.danger }}>*</span>
              </label>
              <select
                value={formData.insuredCountry || 'Uzbekistan'}
                onChange={(e) => handleCountryChange(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${errors.insuredCountry ? t.danger : t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              >
                {COUNTRIES.map(country => (
                  <option key={country} value={country}>
                    {country === 'Uzbekistan' ? '🇺🇿 ' : ''}{country}
                  </option>
                ))}
              </select>
            </div>

            {/* Uzbekistan-Specific Fields */}
            {isUzbekistan && (
              <div className="pt-4 mt-4 space-y-4" style={{ borderTop: `1px solid ${t.border}` }}>
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: t.accent }}>
                  <MapPin size={16} />
                  Uzbekistan Registration Details
                </div>

                {/* INN */}
                <div>
                  <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                    INN (Tax ID) <span style={{ color: t.danger }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.insuredINN || ''}
                    onChange={(e) => handleChange('insuredINN', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: errors.insuredINN ? t.dangerBg : t.bgInput, border: `1px solid ${errors.insuredINN ? t.danger : t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                    placeholder="123456789"
                  />
                  {errors.insuredINN && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: t.danger }}>
                      <AlertCircle size={12} /> {errors.insuredINN}
                    </p>
                  )}
                </div>

                {/* Legal Address */}
                <div>
                  <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                    Legal Address
                  </label>
                  <textarea
                    value={formData.insuredLegalAddress || ''}
                    onChange={(e) => handleChange('insuredLegalAddress', e.target.value)}
                    className="w-full resize-none"
                    style={{ padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                    rows={2}
                    placeholder="Legal address in Uzbekistan..."
                  />
                </div>

                {/* Bank Details */}
                <div>
                  <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                    Bank Details
                  </label>
                  <textarea
                    value={formData.insuredBankDetails || ''}
                    onChange={(e) => handleChange('insuredBankDetails', e.target.value)}
                    className="w-full resize-none"
                    style={{ padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                    rows={3}
                    placeholder="Bank name, account number, MFO..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-4" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 20, boxShadow: t.shadow }}>
            <label style={{ color: t.text3, fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Notes</label>
            <textarea
              value={formData.conditions || ''}
              onChange={(e) => handleChange('conditions', e.target.value)}
              className="w-full resize-none"
              style={{ padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              rows={4}
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
        <button
          onClick={onCancel}
          className="px-6 py-2.5 rounded-lg transition-colors font-medium"
          style={{ border: `1px solid ${t.border}`, color: t.text2, background: t.bgPanel }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
          style={{ background: t.accent, color: '#fff' }}
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              {isEditMode ? 'Update Policy' : 'Create Policy'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DirectInsuranceFormContent;
