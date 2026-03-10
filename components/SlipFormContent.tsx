import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { supabase } from '../services/supabase';
import { ReinsuranceSlip, PolicyStatus, PolicyReinsurer, Currency } from '../types';
import { formatDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
import { EntitySearchInput } from './EntitySearchInput';
import { formatSICDisplay } from '../data/sicCodes';
import { ContextBar } from './ContextBar';
import { Save, FileSpreadsheet, Hash, Activity, Plus, Trash2, DollarSign, Send, FileText, CheckCircle, XCircle, Archive, RefreshCw, Settings } from 'lucide-react';
import { DatePickerInput, parseDate, toISODateString } from './DatePickerInput';
import { useTheme } from '../theme/useTheme';

interface SlipFormContentProps {
  id?: string;
  onSave: () => void;
  onCancel: () => void;
}

export const SlipFormContent: React.FC<SlipFormContentProps> = ({
  id,
  onSave,
  onCancel
}) => {
  const toast = useToast();
  const { t } = useTheme();
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<{ isOpen: boolean; status: string; message: string }>({ isOpen: false, status: '', message: '' });
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(true);
  const [slipStatus, setSlipStatus] = useState<string>('DRAFT');

  const [formData, setFormData] = useState<ReinsuranceSlip>({
    id: crypto.randomUUID(),
    slipNumber: '',
    date: new Date().toISOString().split('T')[0],
    insuredName: '',
    brokerReinsurer: '',
    status: 'DRAFT' as PolicyStatus,
    reinsurers: [],
    currency: Currency.USD,
    limitOfLiability: 0
  });

  useEffect(() => {
    const loadData = async () => {
      if (isEdit && id) {
        const slip = await DB.getSlip(id);
        if (slip) {
          if ((!slip.reinsurers || slip.reinsurers.length === 0) && slip.brokerReinsurer) {
            slip.reinsurers = [{
              id: crypto.randomUUID(),
              name: slip.brokerReinsurer,
              share: 100,
              commission: 0
            }];
          }
          const currentStatus = (slip.status as unknown as string) || 'DRAFT';
          setFormData({
            ...slip,
            status: slip.status || PolicyStatus.ACTIVE,
            reinsurers: slip.reinsurers || [],
            currency: slip.currency || Currency.USD,
            limitOfLiability: slip.limitOfLiability || 0
          });
          setSlipStatus(currentStatus === 'Active' ? 'BOUND' : currentStatus);
        } else {
          toast.error('Slip not found');
          onCancel();
        }
      }
      setLoading(false);
    };
    loadData();
  }, [id, isEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'limitOfLiability' ? Number(value) : value
    }));
  };

  const handleDateChange = (date: Date | null) => {
    setFormData(prev => ({ ...prev, date: toISODateString(date) || '' }));
  };

  const handleReinsurerChange = (index: number, field: keyof PolicyReinsurer, value: any) => {
    const updated = [...(formData.reinsurers || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData(prev => ({ ...prev, reinsurers: updated }));
  };

  const addReinsurer = () => {
    setFormData(prev => ({
      ...prev,
      reinsurers: [...(prev.reinsurers || []), { id: crypto.randomUUID(), name: '', share: 0, commission: 0 }]
    }));
  };

  const removeReinsurer = (index: number) => {
    const updated = [...(formData.reinsurers || [])];
    updated.splice(index, 1);
    setFormData(prev => ({ ...prev, reinsurers: updated }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const primary = formData.reinsurers && formData.reinsurers.length > 0 ? formData.reinsurers[0].name : '';
    await DB.saveSlip({ ...formData, brokerReinsurer: primary || formData.brokerReinsurer });
    toast.success(isEdit ? 'Slip updated!' : 'Slip created!');
    onSave();
  };

  const statusMessages: Record<string, string> = {
    'PENDING': 'Submit this slip for review?',
    'QUOTED': 'Mark as quote received?',
    'SIGNED': 'Mark as signed?',
    'SENT': 'Mark as sent to reinsurer?',
    'BOUND': 'Confirm this slip is bound?',
    'CLOSED': 'Close this slip?',
    'DECLINED': 'Decline this slip?',
    'NTU': 'Mark as Not Taken Up?'
  };

  const requestStatusChange = (newStatus: string) => {
    if (!id) return;
    setStatusChangeConfirm({
      isOpen: true,
      status: newStatus,
      message: statusMessages[newStatus] || `Change status to ${newStatus}?`
    });
  };

  const performStatusChange = async (newStatus: string, additionalFields: any = {}) => {
    if (!id) return;

    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...additionalFields
      };

      if (supabase) {
        const { error } = await supabase
          .from('slips')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const updatedSlip = { ...formData, ...updateData };
        await DB.saveSlip(updatedSlip);
      }

      setSlipStatus(newStatus);
      setFormData(prev => ({ ...prev, status: newStatus as any }));
      toast.success('Status updated successfully!');
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status: ' + (err.message || 'Unknown error'));
    }
  };

  const handleSlipStatusChange = (newStatus: string) => {
    requestStatusChange(newStatus);
  };

  const handleSlipDecline = () => {
    setDeclineReason('');
    setShowDeclineModal(true);
  };

  const confirmSlipDecline = async () => {
    setShowDeclineModal(false);
    await performStatusChange('DECLINED', {
      decline_reason: declineReason,
      declined_date: new Date().toISOString()
    });
  };

  if (loading) return <div className="p-8 text-center" style={{ color: t.text4 }}>Loading...</div>;

  const labelClass = "block text-sm font-medium mb-1.5";
  const inputStyle: React.CSSProperties = { backgroundColor: t.bgPanel, borderColor: t.border, color: t.text1 };
  const inputClass = "w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm";
  const selectClass = "w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm";

  const priorityCurrencies = ['UZS', 'USD', 'EUR'];
  const allCurrencies = Object.values(Currency);
  const sortedCurrencies = [
    ...priorityCurrencies,
    ...allCurrencies.filter(c => !priorityCurrencies.includes(c)).sort()
  ];

  const getStatusBadgeStyle = (): React.CSSProperties => {
    switch (slipStatus) {
      case 'DRAFT': return { background: t.bgCard, color: t.text1 };
      case 'PENDING': return { background: t.accent + '18', color: t.accent };
      case 'QUOTED': return { background: '#a855f718', color: '#a855f7' };
      case 'SIGNED': return { background: '#6366f118', color: '#6366f1' };
      case 'SENT': return { background: '#06b6d418', color: '#06b6d4' };
      case 'BOUND': return { background: t.successBg, color: t.success };
      case 'CLOSED': return { background: t.bgCard, color: t.text3 };
      case 'DECLINED': return { background: t.dangerBg, color: t.danger };
      case 'NTU': return { background: t.warningBg, color: t.warning };
      default: return { background: t.bgCard, color: t.text1 };
    }
  };

  return (
    <div>
      {/* Context Bar */}
      <ContextBar
        status={slipStatus || 'DRAFT'}
        breadcrumbs={[
          { label: 'Reinsurance Slips' },
          { label: isEdit ? (formData.slipNumber || 'Edit Slip') : 'New Slip Record' }
        ]}
      />

      <div className="p-6">
        {/* Workflow Actions Section - Only show when editing existing slip */}
        {id && (
          <div className="rounded-xl p-4 mb-6" style={{ background: t.bgPanel, boxShadow: t.shadow, border: '1px solid ' + t.border }}>
            <div className="flex items-center gap-2 mb-3">
              <Settings size={16} style={{ color: t.text4 }} />
              <span className="font-semibold" style={{ color: t.text2 }}>WORKFLOW ACTIONS</span>
              <span className="ml-2 px-2 py-1 rounded text-xs font-medium" style={getStatusBadgeStyle()}>
                {slipStatus}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(slipStatus === 'DRAFT' || !slipStatus) && (
                <button type="button" onClick={() => handleSlipStatusChange('PENDING')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: t.accent, color: '#fff' }}>
                  <Send size={14} /> Submit for Review
                </button>
              )}

              {slipStatus === 'PENDING' && (
                <>
                  <button type="button" onClick={() => handleSlipStatusChange('QUOTED')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: '#a855f7', color: '#fff' }}>
                    <FileText size={14} /> Quote Received
                  </button>
                  <button type="button" onClick={handleSlipDecline}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: t.dangerBg, color: t.danger }}>
                    <XCircle size={14} /> Decline
                  </button>
                </>
              )}

              {slipStatus === 'QUOTED' && (
                <>
                  <button type="button" onClick={() => { performStatusChange('SIGNED', { signed_date: new Date().toISOString() }); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: '#6366f1', color: '#fff' }}>
                    <CheckCircle size={14} /> Accept & Sign
                  </button>
                  <button type="button" onClick={() => handleSlipStatusChange('NTU')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: t.warningBg, color: t.warning }}>
                    <XCircle size={14} /> Not Taken Up
                  </button>
                </>
              )}

              {slipStatus === 'SIGNED' && (
                <button type="button" onClick={() => { performStatusChange('SENT', { sent_date: new Date().toISOString() }); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: '#06b6d4', color: '#fff' }}>
                  <Send size={14} /> Send to Reinsurer
                </button>
              )}

              {slipStatus === 'SENT' && (
                <>
                  <button type="button" onClick={() => { performStatusChange('BOUND', { bound_date: new Date().toISOString() }); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: t.success, color: '#fff' }}>
                    <CheckCircle size={14} /> Confirm Bound
                  </button>
                  <button type="button" onClick={() => handleSlipStatusChange('NTU')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: t.warningBg, color: t.warning }}>
                    <XCircle size={14} /> Withdrawn
                  </button>
                </>
              )}

              {slipStatus === 'BOUND' && (
                <button type="button" onClick={() => { performStatusChange('CLOSED', { closed_date: new Date().toISOString() }); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: t.text3, color: '#fff' }}>
                  <Archive size={14} /> Close Slip
                </button>
              )}

              {['DECLINED', 'NTU', 'CANCELLED'].includes(slipStatus) && (
                <button type="button" onClick={() => handleSlipStatusChange('PENDING')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: t.accent + '18', color: t.accent }}>
                  <RefreshCw size={14} /> Reopen
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Info Panel */}
          <div className="md:col-span-1">
            <div className="rounded-xl p-6" style={{ background: t.warningBg, borderColor: t.warning + '40', borderWidth: 1, borderStyle: 'solid' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: t.warningBg, color: t.warning }}>
                <FileSpreadsheet size={24} />
              </div>
              <h3 className="font-bold mb-2" style={{ color: t.warning }}>Slip Registry</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: t.warning, opacity: 0.8 }}>
                Register a new Outward Reinsurance Slip. Support for multiple reinsurers (panel) is now enabled.
              </p>
              <div className="text-xs font-mono p-2 rounded" style={{ background: t.warningBg, color: t.warning }}>
                Current Date: {formatDate(new Date().toISOString())}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="md:col-span-2 rounded-xl p-6" style={{ background: t.bgPanel, boxShadow: t.shadow, border: '1px solid ' + t.border }}>
            <h3 className="mb-6 pb-2" style={{ color: t.text1, borderBottom: '1px solid ' + t.border, fontSize: 15, fontWeight: 700 }}>Slip Details</h3>

            <div className="space-y-5">
              <div>
                <label className={labelClass} style={{ color: t.text3 }}><span className="flex items-center gap-2"><Hash size={14}/> Slip Number</span></label>
                <input
                  required
                  type="text"
                  name="slipNumber"
                  value={formData.slipNumber}
                  onChange={handleChange}
                  placeholder="e.g. RE/05/2021/01"
                  className={`${inputClass} font-mono`}
                  style={{...inputStyle}}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <DatePickerInput
                    label="Date"
                    value={parseDate(formData.date)}
                    onChange={handleDateChange}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} style={{ color: t.text3 }}><span className="flex items-center gap-2"><Activity size={14}/> Status</span></label>
                  <select
                    name="status"
                    value={formData.status || 'DRAFT'}
                    onChange={handleChange}
                    className={inputClass}
                    style={{...inputStyle}}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value={PolicyStatus.ACTIVE}>Active / Bound</option>
                    <option value={PolicyStatus.PENDING}>Pending</option>
                    <option value={PolicyStatus.CANCELLED}>Cancelled</option>
                    <option value={PolicyStatus.NTU}>NTU</option>
                  </select>
                </div>
              </div>

              <div>
                <EntitySearchInput
                  label="Insured Name (Legal Entity)"
                  value={formData.insuredName}
                  onChange={(name, entityId) => setFormData(prev => ({ ...prev, insuredName: name, insuredEntityId: entityId }))}
                  onEntitySelect={(entity) => {
                    setFormData(prev => ({ ...prev, insuredName: entity.fullName, insuredEntityId: entity.id }));
                    if (entity.sicCode) setFormData(prev => ({ ...prev, insuredSicCode: entity.sicCode, insuredSicSection: entity.sicSection || '' }));
                  }}
                  placeholder="Search for legal entity..."
                  required
                />
                {formData.insuredSicCode && (
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: t.bgCard, border: '1px solid ' + t.border }}>
                    <span style={{ color: t.text4 }}>Industry:</span>
                    <span style={{ color: t.text3 }}>{formatSICDisplay(formData.insuredSicCode)}</span>
                  </div>
                )}
              </div>

              {/* Financials Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4" style={{ borderTop: '1px solid ' + t.border }}>
                <div>
                  <label className={labelClass} style={{ color: t.text3 }}><span className="flex items-center gap-2"><DollarSign size={14}/> Currency</span></label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className={selectClass}
                    style={{...inputStyle}}
                  >
                    {sortedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} style={{ color: t.text3 }}>Limit of Liability</label>
                  <input
                    type="number"
                    name="limitOfLiability"
                    value={formData.limitOfLiability || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className={inputClass}
                    style={{...inputStyle}}
                  />
                </div>
              </div>

              {/* REINSURERS PANEL */}
              <div className="pt-4" style={{ borderTop: '1px solid ' + t.border }}>
                <label className="block text-sm font-bold mb-3" style={{ color: t.text1 }}>Reinsurance Market / Panel</label>
                <div className="rounded-lg overflow-hidden mb-2" style={{ border: '1px solid ' + t.border }}>
                  <table className="w-full text-sm text-left">
                    <thead style={{ background: t.bgCard, color: t.text2 }}>
                      <tr>
                        <th className="px-3 py-2 w-1/2">Market Name</th>
                        <th className="px-3 py-2">Share %</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: t.border }}>
                      {formData.reinsurers?.map((reinsurer, idx) => (
                        <tr key={reinsurer.id} style={{ borderColor: t.border }}>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={reinsurer.name}
                              onChange={(e) => handleReinsurerChange(idx, 'name', e.target.value)}
                              className="w-full border-none focus:ring-0 text-sm"
                              placeholder="e.g. Swiss Re"
                              style={{ background: 'transparent', color: t.text1 }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={reinsurer.share || ''}
                              onChange={(e) => handleReinsurerChange(idx, 'share', Number(e.target.value))}
                              className="w-full border-none focus:ring-0 text-sm"
                              style={{ background: 'transparent', color: t.text1 }}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button type="button" onClick={() => removeReinsurer(idx)} style={{ color: t.danger }}>
                              <Trash2 size={14}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formData.reinsurers || formData.reinsurers.length === 0) && (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-xs italic" style={{ color: t.text4 }}>
                            No markets added. Click below to add.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addReinsurer} className="text-xs font-bold flex items-center gap-1" style={{ color: t.warning }}>
                  <Plus size={12}/> Add Market
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6" style={{ borderTop: '1px solid ' + t.border }}>
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
                  style={{ color: t.text2, background: t.bgPanel, border: '1px solid ' + t.borderL }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
                  style={{ background: t.warning, color: '#fff' }}
                >
                  <Save size={16} /> {isEdit ? 'Update Slip' : 'Create Slip'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={statusChangeConfirm.isOpen}
        title="Confirm Status Change"
        message={statusChangeConfirm.message}
        onConfirm={() => { setStatusChangeConfirm({ isOpen: false, status: '', message: '' }); performStatusChange(statusChangeConfirm.status); }}
        onCancel={() => setStatusChangeConfirm({ isOpen: false, status: '', message: '' })}
        variant="warning"
        confirmText="Confirm"
      />

      {/* Decline Slip Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="rounded-xl w-full max-w-md overflow-hidden" style={{ background: t.bgPanel, boxShadow: t.shadowLg, border: '1px solid ' + t.border }}>
            <div className="p-4 flex items-center gap-3" style={{ background: t.dangerBg, borderBottom: '1px solid ' + t.danger + '40' }}>
              <div className="p-2 rounded-full" style={{ background: t.dangerBg, color: t.danger }}><XCircle size={20}/></div>
              <h3 className="font-bold" style={{ color: t.text1 }}>Decline Slip</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1" style={{ color: t.text4 }}>Reason for Declining</label>
                <textarea
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Please enter the reason for declining..."
                  className="w-full p-2 border rounded-lg text-sm resize-none"
                  style={{ background: t.bgPanel, borderColor: t.border, color: t.text1 }}
                />
              </div>
            </div>
            <div className="p-4 flex justify-end gap-2" style={{ background: t.bgCard, borderTop: '1px solid ' + t.border }}>
              <button onClick={() => setShowDeclineModal(false)} className="px-4 py-2 font-medium rounded-lg text-sm" style={{ color: t.text3 }}>Cancel</button>
              <button onClick={confirmSlipDecline} className="px-4 py-2 font-bold rounded-lg text-sm" style={{ background: t.danger, color: '#fff', boxShadow: t.shadow }}>Decline Slip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlipFormContent;
