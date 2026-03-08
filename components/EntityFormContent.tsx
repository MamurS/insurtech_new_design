
import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { LegalEntity } from '../types';
import { ContextBar } from './ContextBar';
import { Save, X, Building2, Landmark, MapPin, Users } from 'lucide-react';

interface EntityFormContentProps {
  id?: string;
  onSave: () => void;
  onCancel: () => void;
}

export const EntityFormContent: React.FC<EntityFormContentProps> = ({ id, onSave, onCancel }) => {
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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  const labelClass = "block text-sm font-medium text-gray-600 mb-1.5";
  const inputClass = "w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900";
  const sectionTitleClass = "text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2";

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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-2">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Building2 size={18} className="text-blue-500"/> Corporate Identity</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                      <label className={labelClass}>Full Legal Name</label>
                      <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className={inputClass} placeholder="e.g. Uzbek General Insurance LLC"/>
                  </div>
                  <div>
                      <label className={labelClass}>Short Name / Alias</label>
                      <input type="text" name="shortName" value={formData.shortName} onChange={handleChange} className={inputClass}/>
                  </div>
                  <div>
                      <label className={labelClass}>Entity Type</label>
                      <select name="type" value={formData.type} onChange={handleChange} className={inputClass}>
                          <option value="Insured">Insured</option>
                          <option value="Broker">Broker</option>
                          <option value="Reinsurer">Reinsurer</option>
                          <option value="Agent">Agent</option>
                          <option value="MGA">MGA</option>
                          <option value="Other">Other</option>
                      </select>
                  </div>
                  <div>
                      <label className={labelClass}>Registration Code Type</label>
                      <select name="regCodeType" value={formData.regCodeType} onChange={handleChange} className={inputClass}>
                          <option value="INN">INN (Tax ID)</option>
                          <option value="Company No">Company No</option>
                          <option value="Tax ID">Foreign Tax ID</option>
                      </select>
                  </div>
                  <div>
                      <label className={labelClass}>Code Value</label>
                      <input type="text" name="regCodeValue" value={formData.regCodeValue} onChange={handleChange} className={inputClass} placeholder="e.g. 309730232"/>
                  </div>
              </div>
          </div>

          {/* Address & Contact */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className={sectionTitleClass}><MapPin size={18} className="text-blue-500"/> Location & Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className={labelClass}>Country</label>
                      <input type="text" name="country" value={formData.country} onChange={handleChange} className={inputClass}/>
                  </div>
                  <div>
                      <label className={labelClass}>City</label>
                      <input type="text" name="city" value={formData.city} onChange={handleChange} className={inputClass}/>
                  </div>
                  <div className="md:col-span-2">
                      <label className={labelClass}>Full Registered Address</label>
                      <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputClass}/>
                  </div>
                  <div>
                      <label className={labelClass}>Phone</label>
                      <input type="text" name="phone" value={formData.phone} onChange={handleChange} className={inputClass}/>
                  </div>
                  <div>
                      <label className={labelClass}>Email</label>
                      <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass}/>
                  </div>
                   <div className="md:col-span-2">
                      <label className={labelClass}>Website</label>
                      <input type="text" name="website" value={formData.website} onChange={handleChange} className={inputClass}/>
                  </div>
              </div>
          </div>

          {/* Banking */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className={sectionTitleClass}><Landmark size={18} className="text-blue-500"/> Banking Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className={labelClass}>Bank Name</label>
                      <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className={inputClass}/>
                  </div>
                  <div>
                      <label className={labelClass}>Account Number</label>
                      <input type="text" name="bankAccount" value={formData.bankAccount} onChange={handleChange} className={inputClass}/>
                  </div>
                  <div>
                      <label className={labelClass}>MFO / SWIFT / IBAN</label>
                      <input type="text" name="bankMFO" value={formData.bankMFO} onChange={handleChange} className={inputClass}/>
                  </div>
                  <div>
                      <label className={labelClass}>Bank Address</label>
                      <input type="text" name="bankAddress" value={formData.bankAddress} onChange={handleChange} className={inputClass}/>
                  </div>
              </div>
          </div>

          {/* Corporate */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className={sectionTitleClass}><Users size={18} className="text-blue-500"/> Corporate Structure</h3>
              <div className="grid grid-cols-1 gap-6">
                  <div>
                      <label className={labelClass}>Director Name</label>
                      <input type="text" name="directorName" value={formData.directorName} onChange={handleChange} className={inputClass}/>
                  </div>
                  <div>
                      <label className={labelClass}>Line of Business</label>
                      <input type="text" name="lineOfBusiness" value={formData.lineOfBusiness} onChange={handleChange} className={inputClass}/>
                  </div>
                  <div>
                      <label className={labelClass}>Shareholders (Text Description)</label>
                      <textarea rows={3} name="shareholders" value={formData.shareholders} onChange={handleChange} className={inputClass} placeholder="List main shareholders..."/>
                  </div>
              </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-all"
              >
                <X size={18} /> Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-all"
              >
                <Save size={18} /> Save Entity
              </button>
          </div>
      </div>
    </form>
  );
};

export default EntityFormContent;
