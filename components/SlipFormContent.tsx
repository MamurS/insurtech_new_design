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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  const labelClass = "block text-sm font-medium text-gray-600 mb-1.5";
  const inputClass = "w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm text-gray-900";
  const selectClass = "w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm text-gray-900";

  const priorityCurrencies = ['UZS', 'USD', 'EUR'];
  const allCurrencies = Object.values(Currency);
  const sortedCurrencies = [
    ...priorityCurrencies,
    ...allCurrencies.filter(c => !priorityCurrencies.includes(c)).sort()
  ];

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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Settings size={16} className="text-gray-500" />
              <span className="font-semibold text-gray-700">WORKFLOW ACTIONS</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                slipStatus === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                slipStatus === 'PENDING' ? 'bg-blue-100 text-blue-800' :
                slipStatus === 'QUOTED' ? 'bg-purple-100 text-purple-800' :
                slipStatus === 'SIGNED' ? 'bg-indigo-100 text-indigo-800' :
                slipStatus === 'SENT' ? 'bg-cyan-100 text-cyan-800' :
                slipStatus === 'BOUND' ? 'bg-green-100 text-green-800' :
                slipStatus === 'CLOSED' ? 'bg-gray-100 text-gray-600' :
                slipStatus === 'DECLINED' ? 'bg-red-100 text-red-800' :
                slipStatus === 'NTU' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {slipStatus}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(slipStatus === 'DRAFT' || !slipStatus) && (
                <button type="button" onClick={() => handleSlipStatusChange('PENDING')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  <Send size={14} /> Submit for Review
                </button>
              )}

              {slipStatus === 'PENDING' && (
                <>
                  <button type="button" onClick={() => handleSlipStatusChange('QUOTED')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                    <FileText size={14} /> Quote Received
                  </button>
                  <button type="button" onClick={handleSlipDecline}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">
                    <XCircle size={14} /> Decline
                  </button>
                </>
              )}

              {slipStatus === 'QUOTED' && (
                <>
                  <button type="button" onClick={() => { performStatusChange('SIGNED', { signed_date: new Date().toISOString() }); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                    <CheckCircle size={14} /> Accept & Sign
                  </button>
                  <button type="button" onClick={() => handleSlipStatusChange('NTU')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm hover:bg-yellow-200">
                    <XCircle size={14} /> Not Taken Up
                  </button>
                </>
              )}

              {slipStatus === 'SIGNED' && (
                <button type="button" onClick={() => { performStatusChange('SENT', { sent_date: new Date().toISOString() }); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700">
                  <Send size={14} /> Send to Reinsurer
                </button>
              )}

              {slipStatus === 'SENT' && (
                <>
                  <button type="button" onClick={() => { performStatusChange('BOUND', { bound_date: new Date().toISOString() }); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                    <CheckCircle size={14} /> Confirm Bound
                  </button>
                  <button type="button" onClick={() => handleSlipStatusChange('NTU')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm hover:bg-yellow-200">
                    <XCircle size={14} /> Withdrawn
                  </button>
                </>
              )}

              {slipStatus === 'BOUND' && (
                <button type="button" onClick={() => { performStatusChange('CLOSED', { closed_date: new Date().toISOString() }); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700">
                  <Archive size={14} /> Close Slip
                </button>
              )}

              {['DECLINED', 'NTU', 'CANCELLED'].includes(slipStatus) && (
                <button type="button" onClick={() => handleSlipStatusChange('PENDING')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200">
                  <RefreshCw size={14} /> Reopen
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Info Panel */}
          <div className="md:col-span-1">
            <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet size={24} />
              </div>
              <h3 className="font-bold text-amber-900 mb-2">Slip Registry</h3>
              <p className="text-sm text-amber-800/80 leading-relaxed mb-4">
                Register a new Outward Reinsurance Slip. Support for multiple reinsurers (panel) is now enabled.
              </p>
              <div className="text-xs text-amber-700 font-mono bg-amber-100/50 p-2 rounded">
                Current Date: {formatDate(new Date().toISOString())}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-100">Slip Details</h3>

            <div className="space-y-5">
              <div>
                <label className={labelClass}><span className="flex items-center gap-2"><Hash size={14}/> Slip Number</span></label>
                <input
                  required
                  type="text"
                  name="slipNumber"
                  value={formData.slipNumber}
                  onChange={handleChange}
                  placeholder="e.g. RE/05/2021/01"
                  className={`${inputClass} font-mono`}
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
                  <label className={labelClass}><span className="flex items-center gap-2"><Activity size={14}/> Status</span></label>
                  <select
                    name="status"
                    value={formData.status || 'DRAFT'}
                    onChange={handleChange}
                    className={inputClass}
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
                  <div className="mt-1.5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-gray-400">Industry:</span>
                    <span className="text-gray-600">{formatSICDisplay(formData.insuredSicCode)}</span>
                  </div>
                )}
              </div>

              {/* Financials Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-gray-100">
                <div>
                  <label className={labelClass}><span className="flex items-center gap-2"><DollarSign size={14}/> Currency</span></label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className={selectClass}
                  >
                    {sortedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Limit of Liability</label>
                  <input
                    type="number"
                    name="limitOfLiability"
                    value={formData.limitOfLiability || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* REINSURERS PANEL */}
              <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-bold text-gray-800 mb-3">Reinsurance Market / Panel</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 w-1/2">Market Name</th>
                        <th className="px-3 py-2">Share %</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.reinsurers?.map((reinsurer, idx) => (
                        <tr key={reinsurer.id}>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={reinsurer.name}
                              onChange={(e) => handleReinsurerChange(idx, 'name', e.target.value)}
                              className="w-full border-none focus:ring-0 text-sm"
                              placeholder="e.g. Swiss Re"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={reinsurer.share || ''}
                              onChange={(e) => handleReinsurerChange(idx, 'share', Number(e.target.value))}
                              className="w-full border-none focus:ring-0 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button type="button" onClick={() => removeReinsurer(idx)} className="text-red-400 hover:text-red-600">
                              <Trash2 size={14}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formData.reinsurers || formData.reinsurers.length === 0) && (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-gray-400 text-xs italic">
                            No markets added. Click below to add.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addReinsurer} className="text-xs font-bold text-amber-600 flex items-center gap-1 hover:text-amber-800">
                  <Plus size={12}/> Add Market
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-sm transition-colors"
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
            <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-full text-red-600"><XCircle size={20}/></div>
              <h3 className="font-bold text-gray-800">Decline Slip</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason for Declining</label>
                <textarea
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Please enter the reason for declining..."
                  className="w-full p-2 bg-white border rounded-lg text-sm resize-none text-gray-900"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
              <button onClick={() => setShowDeclineModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={confirmSlipDecline} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 text-sm shadow-sm">Decline Slip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlipFormContent;
