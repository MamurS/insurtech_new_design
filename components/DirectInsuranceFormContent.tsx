import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { Policy, PolicyStatus, Currency, PaymentStatus } from '../types';
import { useToast } from '../context/ToastContext';
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
        <Loader2 className="animate-spin text-blue-600" size={32} />
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
          <div className="bg-slate-50 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              Policy Information
            </h3>

            {/* Policy Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Policy Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.policyNumber || ''}
                onChange={(e) => handleChange('policyNumber', e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                  errors.policyNumber ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
                placeholder="POL-2026-001"
              />
              {errors.policyNumber && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.policyNumber}
                </p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status || 'Draft'}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Class of Insurance</label>
              <select
                value={formData.classOfInsurance || ''}
                onChange={(e) => handleChange('classOfInsurance', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Inception Date <span className="text-red-500">*</span>
                </label>
                <DatePickerInput
                  value={formData.inceptionDate || ''}
                  onChange={(date) => handleChange('inceptionDate', date)}
                  error={errors.inceptionDate}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expiry Date <span className="text-red-500">*</span>
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
          <div className="bg-slate-50 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-600" />
              Financial Details
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <select
                  value={formData.currency || Currency.USD}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value={Currency.USD}>USD</option>
                  <option value={Currency.EUR}>EUR</option>
                  <option value={Currency.UZS}>UZS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sum Insured</label>
                <input
                  type="number"
                  value={formData.sumInsured || ''}
                  onChange={(e) => handleChange('sumInsured', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gross Premium</label>
                <input
                  type="number"
                  value={formData.grossPremium || ''}
                  onChange={(e) => handleChange('grossPremium', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Net Premium</label>
                <input
                  type="number"
                  value={formData.netPremium || ''}
                  onChange={(e) => handleChange('netPremium', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Insured Info */}
        <div className="space-y-6">
          <div className="bg-slate-50 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Building2 size={18} className="text-purple-600" />
              Insured Information
            </h3>

            {/* Insured Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Insured Name <span className="text-red-500">*</span>
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
                <div className="mt-1.5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
                  <span className="text-gray-400">Industry:</span>
                  <span className="text-gray-600">{formatSICDisplay(formData.insuredSicCode)}</span>
                </div>
              )}
            </div>

            {/* Country of Registration */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <Globe size={14} className="inline mr-1" />
                Country of Registration <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.insuredCountry || 'Uzbekistan'}
                onChange={(e) => handleCountryChange(e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white ${
                  errors.insuredCountry ? 'border-red-300' : 'border-slate-200'
                }`}
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
              <div className="border-t border-slate-200 pt-4 mt-4 space-y-4">
                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                  <MapPin size={16} />
                  Uzbekistan Registration Details
                </div>

                {/* INN */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    INN (Tax ID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.insuredINN || ''}
                    onChange={(e) => handleChange('insuredINN', e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                      errors.insuredINN ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                    placeholder="123456789"
                  />
                  {errors.insuredINN && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.insuredINN}
                    </p>
                  )}
                </div>

                {/* Legal Address */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Legal Address
                  </label>
                  <textarea
                    value={formData.insuredLegalAddress || ''}
                    onChange={(e) => handleChange('insuredLegalAddress', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    rows={2}
                    placeholder="Legal address in Uzbekistan..."
                  />
                </div>

                {/* Bank Details */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Bank Details
                  </label>
                  <textarea
                    value={formData.insuredBankDetails || ''}
                    onChange={(e) => handleChange('insuredBankDetails', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    rows={3}
                    placeholder="Bank name, account number, MFO..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-slate-50 rounded-xl p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
            <textarea
              value={formData.conditions || ''}
              onChange={(e) => handleChange('conditions', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              rows={4}
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          onClick={onCancel}
          className="px-6 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
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
