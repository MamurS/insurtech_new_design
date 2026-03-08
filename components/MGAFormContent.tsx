import React, { useState, useEffect } from 'react';
import { BindingAgreement, Currency } from '../types';
import { DB } from '../services/db';
import { useToast } from '../context/ToastContext';
import {
  FileText, DollarSign, Globe, Hash, Save, AlertCircle
} from 'lucide-react';

// Form Section Card
const FormSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
    <div className="px-5 py-3 border-b border-slate-100">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
        {icon}
        {title}
      </h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const FieldError: React.FC<{ error?: string }> = ({ error }) => {
  if (!error) return null;
  return (
    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
      <AlertCircle size={12} />
      {error}
    </p>
  );
};

type FormErrors = Record<string, string>;

interface MGAFormContentProps {
  id?: string;
  onSave: () => void;
  onCancel: () => void;
}

export const MGAFormContent: React.FC<MGAFormContentProps> = ({ id, onSave, onCancel }) => {
  const toast = useToast();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState<Partial<BindingAgreement>>({
    id: crypto.randomUUID(),
    agreementNumber: `BA-${new Date().getFullYear()}-`,
    agreementType: 'BINDING_AUTHORITY',
    status: 'DRAFT',
    mgaName: '',
    brokerName: '',
    underwriter: '',
    inceptionDate: '',
    expiryDate: '',
    currency: 'USD',
    epi: 0,
    ourShare: 1.0,
    commissionPercent: 0,
    depositPremium: 0,
    minimumPremium: 0,
    maxLimitPerRisk: undefined,
    aggregateLimit: undefined,
    claimsAuthorityLimit: 0,
    territoryScope: '',
    classOfBusiness: '',
    notes: '',
  });

  useEffect(() => {
    if (isEdit && id) {
      (async () => {
        const agreement = await DB.getBindingAgreement(id);
        if (agreement) {
          setFormData({
            ...agreement,
            ourShare: agreement.ourShare, // stored as decimal 0-1
          });
        } else {
          toast.error('Agreement not found');
          onCancel();
        }
        setLoading(false);
      })();
    }
  }, [id, isEdit]);

  const clearError = (name: string) => {
    if (errors[name]) {
      setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? undefined : Number(value)) : value,
    }));
    clearError(name);
  };

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!formData.agreementNumber?.trim()) errs.agreementNumber = 'Required';
    if (!formData.mgaName?.trim()) errs.mgaName = 'MGA / partner name is required';
    if (!formData.inceptionDate) errs.inceptionDate = 'Inception date is required';
    if (!formData.expiryDate) errs.expiryDate = 'Expiry date is required';
    else if (formData.inceptionDate && formData.expiryDate < formData.inceptionDate)
      errs.expiryDate = 'Must be after inception';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) { toast.error('Please fix highlighted errors'); return; }
    setSaving(true);
    try {
      await DB.saveBindingAgreement({
        id: formData.id!,
        agreementNumber: formData.agreementNumber!,
        agreementType: formData.agreementType as BindingAgreement['agreementType'],
        mgaName: formData.mgaName!,
        mgaEntityId: formData.mgaEntityId,
        brokerName: formData.brokerName,
        brokerEntityId: formData.brokerEntityId,
        underwriter: formData.underwriter,
        status: (formData.status || 'DRAFT') as BindingAgreement['status'],
        inceptionDate: formData.inceptionDate,
        expiryDate: formData.expiryDate,
        currency: formData.currency || 'USD',
        territoryScope: formData.territoryScope,
        classOfBusiness: formData.classOfBusiness,
        epi: Number(formData.epi || 0),
        ourShare: Number(formData.ourShare || 1),
        commissionPercent: Number(formData.commissionPercent || 0),
        maxLimitPerRisk: formData.maxLimitPerRisk ? Number(formData.maxLimitPerRisk) : undefined,
        aggregateLimit: formData.aggregateLimit ? Number(formData.aggregateLimit) : undefined,
        depositPremium: Number(formData.depositPremium || 0),
        minimumPremium: Number(formData.minimumPremium || 0),
        claimsAuthorityLimit: Number(formData.claimsAuthorityLimit || 0),
        riskParameters: formData.riskParameters,
        notes: formData.notes,
      });
      toast.success(isEdit ? 'Agreement updated' : 'Agreement created');
      onSave();
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";
  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow";
  const inputErrorClass = "border-red-500 ring-2 ring-red-500/20";
  const selectClass = "w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow bg-white";

  const priorityCurrencies = ['USD', 'EUR', 'GBP'];
  const allCurrencies = Object.values(Currency);
  const sortedCurrencies = [
    ...priorityCurrencies,
    ...allCurrencies.filter(c => !priorityCurrencies.includes(c)).sort()
  ];

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-5">

        {/* Agreement Details */}
        <FormSection icon={<FileText className="w-4 h-4" />} title="Agreement Details">
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div>
              <label className={labelClass}>Agreement Number<span className="text-red-500 ml-0.5">*</span></label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" name="agreementNumber" value={formData.agreementNumber || ''} onChange={handleChange}
                  placeholder="BA-2026-001" className={`${inputClass} pl-8 ${errors.agreementNumber ? inputErrorClass : ''}`} />
              </div>
              <FieldError error={errors.agreementNumber} />
            </div>
            <div>
              <label className={labelClass}>Agreement Type</label>
              <select name="agreementType" value={formData.agreementType} onChange={handleChange} className={selectClass}>
                <option value="BINDING_AUTHORITY">Binding Authority</option>
                <option value="LINESLIP">Lineslip</option>
                <option value="TREATY">Treaty</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className={selectClass}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="TERMINATED">Terminated</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div>
              <label className={labelClass}>MGA / Partner Name<span className="text-red-500 ml-0.5">*</span></label>
              <input type="text" name="mgaName" value={formData.mgaName || ''} onChange={handleChange}
                placeholder="Coverholder name" className={`${inputClass} ${errors.mgaName ? inputErrorClass : ''}`} />
              <FieldError error={errors.mgaName} />
            </div>
            <div>
              <label className={labelClass}>Broker Name</label>
              <input type="text" name="brokerName" value={formData.brokerName || ''} onChange={handleChange}
                placeholder="Broker (if any)" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Underwriter</label>
              <input type="text" name="underwriter" value={formData.underwriter || ''} onChange={handleChange}
                placeholder="Underwriter at Mosaic" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Inception Date<span className="text-red-500 ml-0.5">*</span></label>
              <input type="date" name="inceptionDate" value={formData.inceptionDate || ''} onChange={handleChange}
                className={`${inputClass} ${errors.inceptionDate ? inputErrorClass : ''}`} />
              <FieldError error={errors.inceptionDate} />
            </div>
            <div>
              <label className={labelClass}>Expiry Date<span className="text-red-500 ml-0.5">*</span></label>
              <input type="date" name="expiryDate" value={formData.expiryDate || ''} onChange={handleChange}
                className={`${inputClass} ${errors.expiryDate ? inputErrorClass : ''}`} />
              <FieldError error={errors.expiryDate} />
            </div>
          </div>
        </FormSection>

        {/* Financial Terms */}
        <FormSection icon={<DollarSign className="w-4 h-4" />} title="Financial Terms">
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div>
              <label className={labelClass}>Currency</label>
              <select name="currency" value={formData.currency} onChange={handleChange} className={selectClass}>
                {sortedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>EPI (Estimated Premium Income)</label>
              <input type="number" name="epi" value={formData.epi ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="0.00" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Our Share (decimal 0-1)</label>
              <input type="number" name="ourShare" value={formData.ourShare ?? ''} onChange={handleChange}
                min={0} max={1} step="0.01" placeholder="1.00" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div>
              <label className={labelClass}>Commission %</label>
              <input type="number" name="commissionPercent" value={formData.commissionPercent ?? ''} onChange={handleChange}
                min={0} max={100} step="0.01" placeholder="0.00" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Deposit Premium</label>
              <input type="number" name="depositPremium" value={formData.depositPremium ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="0.00" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Minimum Premium</label>
              <input type="number" name="minimumPremium" value={formData.minimumPremium ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="0.00" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Max Limit Per Risk</label>
              <input type="number" name="maxLimitPerRisk" value={formData.maxLimitPerRisk ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="Optional" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Aggregate Limit</label>
              <input type="number" name="aggregateLimit" value={formData.aggregateLimit ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="Optional" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Claims Authority Limit</label>
              <input type="number" name="claimsAuthorityLimit" value={formData.claimsAuthorityLimit ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="0.00" className={inputClass} />
            </div>
          </div>
        </FormSection>

        {/* Scope */}
        <FormSection icon={<Globe className="w-4 h-4" />} title="Scope">
          <div className="grid grid-cols-2 gap-5 mb-5">
            <div>
              <label className={labelClass}>Territory (comma separated)</label>
              <input type="text" name="territoryScope" value={formData.territoryScope || ''} onChange={handleChange}
                placeholder="UK, US, EU" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Class of Business (comma separated)</label>
              <input type="text" name="classOfBusiness" value={formData.classOfBusiness || ''} onChange={handleChange}
                placeholder="Property, Casualty" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3}
              placeholder="Additional notes..." className={`${inputClass} h-auto resize-none`} />
          </div>
        </FormSection>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button type="button" onClick={onCancel}
            className="px-4 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium text-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Save size={16} />
            {saving ? 'Saving...' : (isEdit ? 'Update Agreement' : 'Create Agreement')}
          </button>
        </div>

      </div>
    </form>
  );
};

export default MGAFormContent;
