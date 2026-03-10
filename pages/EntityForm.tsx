
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DB } from '../services/db';
import { LegalEntity } from '../types';
import { Save, ArrowLeft, Building2, Landmark, MapPin, Users } from 'lucide-react';
import { SICCodePicker } from '../components/SICCodePicker';
import { formatSICDisplay } from '../data/sicCodes';
import { useTheme } from '../theme/useTheme';

const EntityForm: React.FC = () => {
  const { t } = useTheme();
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

  const sectionTitleClass = "mb-4 pb-2 flex items-center gap-2";
  const labelClass = "block text-sm font-medium mb-1.5";
  const inputClass = "w-full p-2.5 rounded-lg focus:ring-2 outline-none transition-all text-sm";

  const sectionTitleStyle = { color: t.text1, borderBottom: `1px solid ${t.bgInput}`, fontSize: 15, fontWeight: 700 } as React.CSSProperties;
  const labelStyle = { color: t.text3 };
  const inputStyle = { background: t.bgPanel, border: `1px solid ${t.borderL}`, color: t.text1, '--tw-ring-color': t.accent } as React.CSSProperties;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <form onSubmit={handleSubmit}>
        {/* Sticky Header - Use negative margin to span full width over layout padding */}
        <div className="sticky -mt-4 -mx-4 md:-mt-8 md:-mx-8 px-4 md:px-8 py-4 mb-6 backdrop-blur-md flex items-center justify-between z-40" style={{ background: `${t.bgPanel}f2`, borderBottom: `1px solid ${t.border}`, boxShadow: t.shadow }}>
            <div className="flex items-center gap-4">
                <button type="button" onClick={() => navigate('/entities')} className="transition-colors" style={{ color: t.text4 }}>
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>{isEdit ? 'Edit Legal Entity' : 'New Legal Entity'}</h2>
                    <p className="text-xs" style={{ color: t.text4 }}>Corporate Registry Management</p>
                </div>
            </div>
            <div className="flex gap-3">
                 <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg transition-all"
                    style={{ background: t.accent, color: '#fff', boxShadow: t.shadow }}
                >
                    <Save size={18} /> Save Entity
                </button>
            </div>
        </div>

        <div className="space-y-6">

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
                        <label className={labelClass} style={labelStyle}>Line of Business (SIC 2007)</label>
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
                        <p className="text-xs mt-1" style={{ color: t.text5 }}>
                          International industry classification —
                          <a href="https://resources.companieshouse.gov.uk/sic/" target="_blank" rel="noreferrer" className="hover:underline ml-1" style={{ color: t.accent }}>SIC 2007 reference</a>
                        </p>
                    </div>
                    <div>
                        <label className={labelClass} style={labelStyle}>Shareholders (Text Description)</label>
                        <textarea rows={3} name="shareholders" value={formData.shareholders} onChange={handleChange} className={inputClass} style={inputStyle} placeholder="List main shareholders..."/>
                    </div>
                </div>
            </div>
        </div>
      </form>
    </div>
  );
};

export default EntityForm;
