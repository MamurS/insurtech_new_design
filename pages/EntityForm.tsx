
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DB } from '../services/db';
import { LegalEntity } from '../types';
import { Save, ArrowLeft, Building2, Landmark, MapPin, Users } from 'lucide-react';
import { SICCodePicker } from '../components/SICCodePicker';
import { formatSICDisplay } from '../data/sicCodes';

const EntityForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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
    sicCode: '',
    sicSection: '',
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
      navigate('/entities');
  };

  if (loading) return <div>Loading...</div>;

  const sectionTitleClass = "text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2";
  const labelClass = "block text-sm font-medium text-gray-600 mb-1.5";
  const inputClass = "w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900";

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <form onSubmit={handleSubmit}>
        {/* Sticky Header - Use negative margin to span full width over layout padding */}
        <div className="sticky -mt-4 -mx-4 md:-mt-8 md:-mx-8 px-4 md:px-8 py-4 mb-6 bg-gray-50/95 backdrop-blur-md border-b border-gray-200 flex items-center justify-between shadow-sm z-40">
            <div className="flex items-center gap-4">
                <button type="button" onClick={() => navigate('/entities')} className="text-gray-500 hover:text-gray-800 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">{isEdit ? 'Edit Legal Entity' : 'New Legal Entity'}</h2>
                    <p className="text-xs text-gray-500">Corporate Registry Management</p>
                </div>
            </div>
            <div className="flex gap-3">
                 <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-all"
                >
                    <Save size={18} /> Save Entity
                </button>
            </div>
        </div>

        <div className="space-y-6">
            
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
                        <label className={labelClass}>Line of Business (SIC 2007)</label>
                        <SICCodePicker
                          sicCode={formData.sicCode || ''}
                          sicSection={formData.sicSection || ''}
                          onChange={(code, section) => setFormData(prev => ({
                            ...prev,
                            sicCode: code,
                            sicSection: section,
                            lineOfBusiness: code ? formatSICDisplay(code) : ''
                          }))}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          International industry classification —
                          <a href="https://resources.companieshouse.gov.uk/sic/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline ml-1">SIC 2007 reference</a>
                        </p>
                    </div>
                    <div>
                        <label className={labelClass}>Shareholders (Text Description)</label>
                        <textarea rows={3} name="shareholders" value={formData.shareholders} onChange={handleChange} className={inputClass} placeholder="List main shareholders..."/>
                    </div>
                </div>
            </div>
        </div>
      </form>
    </div>
  );
};

export default EntityForm;
