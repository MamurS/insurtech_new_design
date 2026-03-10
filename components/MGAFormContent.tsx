import React, { useState, useEffect } from 'react';
import { BindingAgreement, Currency } from '../types';
import { DB } from '../services/db';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../theme/useTheme';
import {
  FileText, DollarSign, Globe, Hash, Save, AlertCircle
} from 'lucide-react';

// Form Section Card
const FormSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; t: any }> = ({ title, icon, children, t }) => (
  <div style={{ background: t.bgPanel, borderRadius: 12, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
    <div className="px-5 py-3" style={{ borderBottom: `1px solid ${t.bgInput}` }}>
      <h3 className="flex items-center gap-2 uppercase tracking-wide" style={{ color: t.text4, fontSize: 11, fontWeight: 600 }}>
        {icon}
        {title}
      </h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const FieldError: React.FC<{ error?: string; t: any }> = ({ error, t }) => {
  if (!error) return null;
  return (
    <p className="mt-1 flex items-center gap-1" style={{ color: t.danger, fontSize: 12 }}>
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
  const { t } = useTheme();
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

  if (loading) return <div className="p-8 text-center" style={{ color: t.text4 }}>Loading...</div>;

  const inputStyle: React.CSSProperties = { background: t.bgInput, border: `1px solid ${t.borderL}`, borderRadius: 8, color: t.text1, fontSize: 13 };
  const inputErrorStyle: React.CSSProperties = { border: `1px solid ${t.danger}`, boxShadow: `0 0 0 2px ${t.dangerBg}` };
  const selectStyle: React.CSSProperties = { background: t.bgPanel, border: `1px solid ${t.borderL}`, borderRadius: 8, color: t.text2, fontSize: 13 };

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
        <FormSection icon={<FileText className="w-4 h-4" />} title="Agreement Details" t={t}>
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Agreement Number<span className="ml-0.5" style={{ color: t.danger }}>*</span></label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.text5 }} />
                <input type="text" name="agreementNumber" value={formData.agreementNumber || ''} onChange={handleChange}
                  placeholder="BA-2026-001" className="w-full h-10 pl-8 pr-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={{ ...inputStyle, ...(errors.agreementNumber ? inputErrorStyle : {}) }} />
              </div>
              <FieldError error={errors.agreementNumber} t={t} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Agreement Type</label>
              <select name="agreementType" value={formData.agreementType} onChange={handleChange} className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={selectStyle}>
                <option value="BINDING_AUTHORITY">Binding Authority</option>
                <option value="LINESLIP">Lineslip</option>
                <option value="TREATY">Treaty</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={selectStyle}>
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
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>MGA / Partner Name<span className="ml-0.5" style={{ color: t.danger }}>*</span></label>
              <input type="text" name="mgaName" value={formData.mgaName || ''} onChange={handleChange}
                placeholder="Coverholder name" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={{ ...inputStyle, ...(errors.mgaName ? inputErrorStyle : {}) }} />
              <FieldError error={errors.mgaName} t={t} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Broker Name</label>
              <input type="text" name="brokerName" value={formData.brokerName || ''} onChange={handleChange}
                placeholder="Broker (if any)" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Underwriter</label>
              <input type="text" name="underwriter" value={formData.underwriter || ''} onChange={handleChange}
                placeholder="Underwriter at Mosaic" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Inception Date<span className="ml-0.5" style={{ color: t.danger }}>*</span></label>
              <input type="date" name="inceptionDate" value={formData.inceptionDate || ''} onChange={handleChange}
                className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={{ ...inputStyle, ...(errors.inceptionDate ? inputErrorStyle : {}) }} />
              <FieldError error={errors.inceptionDate} t={t} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Expiry Date<span className="ml-0.5" style={{ color: t.danger }}>*</span></label>
              <input type="date" name="expiryDate" value={formData.expiryDate || ''} onChange={handleChange}
                className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={{ ...inputStyle, ...(errors.expiryDate ? inputErrorStyle : {}) }} />
              <FieldError error={errors.expiryDate} t={t} />
            </div>
          </div>
        </FormSection>

        {/* Financial Terms */}
        <FormSection icon={<DollarSign className="w-4 h-4" />} title="Financial Terms" t={t}>
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Currency</label>
              <select name="currency" value={formData.currency} onChange={handleChange} className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={selectStyle}>
                {sortedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>EPI (Estimated Premium Income)</label>
              <input type="number" name="epi" value={formData.epi ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="0.00" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Our Share (decimal 0-1)</label>
              <input type="number" name="ourShare" value={formData.ourShare ?? ''} onChange={handleChange}
                min={0} max={1} step="0.01" placeholder="1.00" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Commission %</label>
              <input type="number" name="commissionPercent" value={formData.commissionPercent ?? ''} onChange={handleChange}
                min={0} max={100} step="0.01" placeholder="0.00" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Deposit Premium</label>
              <input type="number" name="depositPremium" value={formData.depositPremium ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="0.00" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Minimum Premium</label>
              <input type="number" name="minimumPremium" value={formData.minimumPremium ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="0.00" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Max Limit Per Risk</label>
              <input type="number" name="maxLimitPerRisk" value={formData.maxLimitPerRisk ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="Optional" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Aggregate Limit</label>
              <input type="number" name="aggregateLimit" value={formData.aggregateLimit ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="Optional" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Claims Authority Limit</label>
              <input type="number" name="claimsAuthorityLimit" value={formData.claimsAuthorityLimit ?? ''} onChange={handleChange}
                min={0} step="0.01" placeholder="0.00" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
          </div>
        </FormSection>

        {/* Scope */}
        <FormSection icon={<Globe className="w-4 h-4" />} title="Scope" t={t}>
          <div className="grid grid-cols-2 gap-5 mb-5">
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Territory (comma separated)</label>
              <input type="text" name="territoryScope" value={formData.territoryScope || ''} onChange={handleChange}
                placeholder="UK, US, EU" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Class of Business (comma separated)</label>
              <input type="text" name="classOfBusiness" value={formData.classOfBusiness || ''} onChange={handleChange}
                placeholder="Property, Casualty" className="w-full h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="block mb-1.5" style={{ color: t.text3, fontSize: 13, fontWeight: 500 }}>Notes</label>
            <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3}
              placeholder="Additional notes..." className="w-full px-3 h-auto resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" style={inputStyle} />
          </div>
        </FormSection>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button type="button" onClick={onCancel}
            className="px-4 py-2.5 rounded-lg font-medium text-sm" style={{ color: t.text2, background: t.bgPanel, border: `1px solid ${t.borderL}` }}>
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: t.accent, color: '#fff' }}>
            <Save size={16} />
            {saving ? 'Saving...' : (isEdit ? 'Update Agreement' : 'Create Agreement')}
          </button>
        </div>

      </div>
    </form>
  );
};

export default MGAFormContent;
