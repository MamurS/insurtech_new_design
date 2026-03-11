
import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { LegalEntity } from '../types';
import { ContextBar } from './ContextBar';
import { Save, X, Building2, Landmark, MapPin, Users } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

interface EntityFormContentProps {
  id?: string;
  onSave: () => void;
  onCancel: () => void;
}

export const EntityFormContent: React.FC<EntityFormContentProps> = ({ id, onSave, onCancel }) => {
  const { t } = useTheme();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<LegalEntity>({
    id: crypto.randomUUID(),
    fullName: '',
    shortName: '',
    type: 'Insured',
    regCodeType: 'INN',
    regCodeValue: '',
    country: 'Uzbekistan',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    shareholders: '',
    lineOfBusiness: '',
    directorName: '',
    bankName: '',
    bankAccount: '',
    bankMFO: '',
    bankAddress: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  useEffect(() => {
    if (isEdit && id) {
      DB.getLegalEntity(id).then(entity => {
        if (entity) setFormData(entity);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [id, isEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      await DB.saveLegalEntity(formData);
      onSave();
  };

  if (loading) return <div className="p-8 text-center" style={{ color: t.text4 }}>Loading...</div>;

  const labelClass = "block text-sm mb-1.5";
  const inputClass = "w-full p-2.5 rounded-lg focus:ring-2 outline-none transition-all text-sm";
  const sectionTitleClass = "mb-4 pb-2 flex items-center gap-2";

  const labelStyle = { color: t.text3, fontWeight: 500 as const };
  const inputStyle = { background: t.bgPanel, border: `1px solid ${t.borderL}`, color: t.text1, '--tw-ring-color': t.accent } as React.CSSProperties;
  const sectionTitleStyle = { color: t.text1, borderBottom: `1px solid ${t.bgInput}`, fontSize: 15, fontWeight: 700 } as React.CSSProperties;

  return (
    <form onSubmit={handleSubmit}>
      {/* Context Bar */}
      <ContextBar
        status={isEdit ? 'ACTIVE' : 'NEW'}
        breadcrumbs={[
          { label: 'Legal Entities' },
          { label: isEdit ? (formData.shortName || formData.fullName || 'Edit Entity') : 'New Entity' }
        ]}
      />

      <div className="space-y-6 p-6">

          {/* Identity Section */}
          <div className="rounded-xl p-6" style={{ background: t.bgPanel, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
              <div className="flex justify-between items-start mb-4 pb-2" style={{ borderBottom: `1px solid ${t.bgInput}` }}>
                  <h3 className="flex items-center gap-2" style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}><Building2 size={18} style={{ color: t.accent }}/> Corporate Identity</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                      <label className={labelClass} style={labelStyle}>Full Legal Name</label>
                      <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className={inputClass} style={inputStyle} placeholder="e.g. Uzbek General Insurance LLC"/>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>Short Name / Alias</label>
                      <input type="text" name="shortName" value={formData.shortName} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>Entity Type</label>
                      <select name="type" value={formData.type} onChange={handleChange} className={inputClass} style={inputStyle}>
                          <option value="Insured">Insured</option>
                          <option value="Broker">Broker</option>
                          <option value="Reinsurer">Reinsurer</option>
                          <option value="Agent">Agent</option>
                          <option value="MGA">MGA</option>
                          <option value="Other">Other</option>
                      </select>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>Registration Code Type</label>
                      <select name="regCodeType" value={formData.regCodeType} onChange={handleChange} className={inputClass} style={inputStyle}>
                          <option value="INN">INN (Tax ID)</option>
                          <option value="Company No">Company No</option>
                          <option value="Tax ID">Foreign Tax ID</option>
                      </select>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>Code Value</label>
                      <input type="text" name="regCodeValue" value={formData.regCodeValue} onChange={handleChange} className={inputClass} style={inputStyle} placeholder="e.g. 309730232"/>
                  </div>
              </div>
          </div>

          {/* Address & Contact */}
          <div className="rounded-xl p-6" style={{ background: t.bgPanel, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
              <h3 className={sectionTitleClass} style={sectionTitleStyle}><MapPin size={18} style={{ color: t.accent }}/> Location & Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className={labelClass} style={labelStyle}>Country</label>
                      <input type="text" name="country" value={formData.country} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>City</label>
                      <input type="text" name="city" value={formData.city} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                  <div className="md:col-span-2">
                      <label className={labelClass} style={labelStyle}>Full Registered Address</label>
                      <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>Phone</label>
                      <input type="text" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>Email</label>
                      <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                   <div className="md:col-span-2">
                      <label className={labelClass} style={labelStyle}>Website</label>
                      <input type="text" name="website" value={formData.website} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
              </div>
          </div>

          {/* Banking */}
          <div className="rounded-xl p-6" style={{ background: t.bgPanel, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
              <h3 className={sectionTitleClass} style={sectionTitleStyle}><Landmark size={18} style={{ color: t.accent }}/> Banking Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className={labelClass} style={labelStyle}>Bank Name</label>
                      <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>Account Number</label>
                      <input type="text" name="bankAccount" value={formData.bankAccount} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>MFO / SWIFT / IBAN</label>
                      <input type="text" name="bankMFO" value={formData.bankMFO} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>Bank Address</label>
                      <input type="text" name="bankAddress" value={formData.bankAddress} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
              </div>
          </div>

          {/* Corporate */}
          <div className="rounded-xl p-6" style={{ background: t.bgPanel, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
              <h3 className={sectionTitleClass} style={sectionTitleStyle}><Users size={18} style={{ color: t.accent }}/> Corporate Structure</h3>
              <div className="grid grid-cols-1 gap-6">
                  <div>
                      <label className={labelClass} style={labelStyle}>Director Name</label>
                      <input type="text" name="directorName" value={formData.directorName} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>Line of Business</label>
                      <input type="text" name="lineOfBusiness" value={formData.lineOfBusiness} onChange={handleChange} className={inputClass} style={inputStyle}/>
                  </div>
                  <div>
                      <label className={labelClass} style={labelStyle}>Shareholders (Text Description)</label>
                      <textarea rows={3} name="shareholders" value={formData.shareholders} onChange={handleChange} className={inputClass} style={inputStyle} placeholder="List main shareholders..."/>
                  </div>
              </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-2 px-6 py-2.5 text-sm rounded-lg transition-all"
                style={{ color: t.text2, background: t.bgPanel, border: `1px solid ${t.borderL}`, fontWeight: 500 }}
              >
                <X size={18} /> Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 text-sm rounded-lg transition-all"
                style={{ background: t.accent, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
              >
                <Save size={18} /> Save Entity
              </button>
          </div>
      </div>
    </form>
  );
};

export default EntityFormContent;
