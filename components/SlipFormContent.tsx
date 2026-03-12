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

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: t.text4 }}>Loading...</div>;

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, marginBottom: 6 };
  const inputStyle: React.CSSProperties = { backgroundColor: t.bgPanel, borderColor: t.border, color: t.text1 };
  const baseInputStyle: React.CSSProperties = { width: '100%', padding: 10, borderWidth: 1, borderStyle: 'solid', borderRadius: 8, outline: 'none', fontSize: 14, ...inputStyle };
  const baseSelectStyle: React.CSSProperties = { width: '100%', padding: 10, borderWidth: 1, borderStyle: 'solid', borderRadius: 8, outline: 'none', fontSize: 14, ...inputStyle };

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

  const buttonSmallStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 8, fontSize: 14 };

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

      <div style={{ padding: 24 }}>
        {/* Workflow Actions Section - Only show when editing existing slip */}
        {id && (
          <div style={{ borderRadius: 12, padding: 16, marginBottom: 24, background: t.bgPanel, boxShadow: t.shadow, border: '1px solid ' + t.border }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Settings size={16} style={{ color: t.text4 }} />
              <span style={{ color: t.text2, fontWeight: 600 }}>WORKFLOW ACTIONS</span>
              <span style={{ marginLeft: 8, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4, fontSize: 12, ...getStatusBadgeStyle(), fontWeight: 500 }}>
                {slipStatus}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(slipStatus === 'DRAFT' || !slipStatus) && (
                <button type="button" onClick={() => handleSlipStatusChange('PENDING')}
                  style={{ ...buttonSmallStyle, background: t.accent, color: '#fff' }}>
                  <Send size={14} /> Submit for Review
                </button>
              )}

              {slipStatus === 'PENDING' && (
                <>
                  <button type="button" onClick={() => handleSlipStatusChange('QUOTED')}
                    style={{ ...buttonSmallStyle, background: '#a855f7', color: '#fff' }}>
                    <FileText size={14} /> Quote Received
                  </button>
                  <button type="button" onClick={handleSlipDecline}
                    style={{ ...buttonSmallStyle, background: t.dangerBg, color: t.danger }}>
                    <XCircle size={14} /> Decline
                  </button>
                </>
              )}

              {slipStatus === 'QUOTED' && (
                <>
                  <button type="button" onClick={() => { performStatusChange('SIGNED', { signed_date: new Date().toISOString() }); }}
                    style={{ ...buttonSmallStyle, background: '#6366f1', color: '#fff' }}>
                    <CheckCircle size={14} /> Accept & Sign
                  </button>
                  <button type="button" onClick={() => handleSlipStatusChange('NTU')}
                    style={{ ...buttonSmallStyle, background: t.warningBg, color: t.warning }}>
                    <XCircle size={14} /> Not Taken Up
                  </button>
                </>
              )}

              {slipStatus === 'SIGNED' && (
                <button type="button" onClick={() => { performStatusChange('SENT', { sent_date: new Date().toISOString() }); }}
                  style={{ ...buttonSmallStyle, background: '#06b6d4', color: '#fff' }}>
                  <Send size={14} /> Send to Reinsurer
                </button>
              )}

              {slipStatus === 'SENT' && (
                <>
                  <button type="button" onClick={() => { performStatusChange('BOUND', { bound_date: new Date().toISOString() }); }}
                    style={{ ...buttonSmallStyle, background: t.success, color: '#fff' }}>
                    <CheckCircle size={14} /> Confirm Bound
                  </button>
                  <button type="button" onClick={() => handleSlipStatusChange('NTU')}
                    style={{ ...buttonSmallStyle, background: t.warningBg, color: t.warning }}>
                    <XCircle size={14} /> Withdrawn
                  </button>
                </>
              )}

              {slipStatus === 'BOUND' && (
                <button type="button" onClick={() => { performStatusChange('CLOSED', { closed_date: new Date().toISOString() }); }}
                  style={{ ...buttonSmallStyle, background: t.text3, color: '#fff' }}>
                  <Archive size={14} /> Close Slip
                </button>
              )}

              {['DECLINED', 'NTU', 'CANCELLED'].includes(slipStatus) && (
                <button type="button" onClick={() => handleSlipStatusChange('PENDING')}
                  style={{ ...buttonSmallStyle, background: t.accent + '18', color: t.accent }}>
                  <RefreshCw size={14} /> Reopen
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>

          {/* Info Panel */}
          <div style={{ gridColumn: 'span 1' }}>
            <div style={{ borderRadius: 12, padding: 24, background: t.warningBg, borderColor: t.warning + '40', borderWidth: 1, borderStyle: 'solid' }}>
              <div style={{ width: 48, height: 48, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, background: t.warningBg, color: t.warning }}>
                <FileSpreadsheet size={24} />
              </div>
              <h3 style={{ marginBottom: 8, color: t.warning, fontWeight: 700 }}>Slip Registry</h3>
              <p style={{ fontSize: 14, lineHeight: 1.625, marginBottom: 16, color: t.warning, opacity: 0.8 }}>
                Register a new Outward Reinsurance Slip. Support for multiple reinsurers (panel) is now enabled.
              </p>
              <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", padding: 8, borderRadius: 4, background: t.warningBg, color: t.warning }}>
                Current Date: {formatDate(new Date().toISOString())}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div style={{ gridColumn: 'span 2', borderRadius: 12, padding: 24, background: t.bgPanel, boxShadow: t.shadow, border: '1px solid ' + t.border }}>
            <h3 style={{ marginBottom: 24, paddingBottom: 8, color: t.text1, borderBottom: '1px solid ' + t.border, fontSize: 15, fontWeight: 700 }}>Slip Details</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ ...labelStyle, color: t.text3, fontWeight: 500 }}><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Hash size={14}/> Slip Number</span></label>
                <input
                  required
                  type="text"
                  name="slipNumber"
                  value={formData.slipNumber}
                  onChange={handleChange}
                  placeholder="e.g. RE/05/2021/01"
                  className="transition-all"
                  style={{...baseInputStyle, fontFamily: "'JetBrains Mono', monospace"}}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                <div>
                  <DatePickerInput
                    label="Date"
                    value={parseDate(formData.date)}
                    onChange={handleDateChange}
                    required
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, color: t.text3, fontWeight: 500 }}><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={14}/> Status</span></label>
                  <select
                    name="status"
                    value={formData.status || 'DRAFT'}
                    onChange={handleChange}
                    className="transition-all"
                    style={{...baseInputStyle}}
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
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, background: t.bgCard, border: '1px solid ' + t.border }}>
                    <span style={{ color: t.text4 }}>Industry:</span>
                    <span style={{ color: t.text3 }}>{formatSICDisplay(formData.insuredSicCode)}</span>
                  </div>
                )}
              </div>

              {/* Financials Section */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, paddingTop: 16, borderTop: '1px solid ' + t.border }}>
                <div>
                  <label style={{ ...labelStyle, color: t.text3, fontWeight: 500 }}><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><DollarSign size={14}/> Currency</span></label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="transition-all"
                    style={{...baseSelectStyle}}
                  >
                    {sortedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, color: t.text3, fontWeight: 500 }}>Limit of Liability</label>
                  <input
                    type="number"
                    name="limitOfLiability"
                    value={formData.limitOfLiability || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="transition-all"
                    style={{...baseInputStyle}}
                  />
                </div>
              </div>

              {/* REINSURERS PANEL */}
              <div style={{ paddingTop: 16, borderTop: '1px solid ' + t.border }}>
                <label style={{ display: 'block', fontSize: 14, marginBottom: 12, color: t.text1, fontWeight: 700 }}>Reinsurance Market / Panel</label>
                <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 8, border: '1px solid ' + t.border }}>
                  <table style={{ width: '100%', fontSize: 14, textAlign: 'left' }}>
                    <thead style={{ background: t.bgCard, color: t.text2 }}>
                      <tr>
                        <th style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, width: '50%' }}>Market Name</th>
                        <th style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>Share %</th>
                        <th style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody style={{ borderColor: t.border }}>
                      {formData.reinsurers?.map((reinsurer, idx) => (
                        <tr key={reinsurer.id} style={{ borderColor: t.border, borderTopWidth: idx > 0 ? 1 : 0, borderTopStyle: 'solid' }}>
                          <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>
                            <input
                              type="text"
                              value={reinsurer.name}
                              onChange={(e) => handleReinsurerChange(idx, 'name', e.target.value)}
                              placeholder="e.g. Swiss Re"
                              style={{ width: '100%', border: 'none', fontSize: 14, background: 'transparent', color: t.text1, outline: 'none' }}
                            />
                          </td>
                          <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>
                            <input
                              type="number"
                              value={reinsurer.share || ''}
                              onChange={(e) => handleReinsurerChange(idx, 'share', Number(e.target.value))}
                              style={{ width: '100%', border: 'none', fontSize: 14, background: 'transparent', color: t.text1, outline: 'none' }}
                            />
                          </td>
                          <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'center' }}>
                            <button type="button" onClick={() => removeReinsurer(idx)} style={{ color: t.danger }}>
                              <Trash2 size={14}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formData.reinsurers || formData.reinsurers.length === 0) && (
                        <tr>
                          <td colSpan={3} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 16, paddingBottom: 16, textAlign: 'center', fontSize: 12, fontStyle: 'italic', color: t.text4 }}>
                            No markets added. Click below to add.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addReinsurer} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: t.warning, fontWeight: 700 }}>
                  <Plus size={12}/> Add Market
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 24, borderTop: '1px solid ' + t.border }}>
                <button
                  type="button"
                  onClick={onCancel}
                  className="transition-colors"
                  style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, fontSize: 14, color: t.text2, background: t.bgPanel, border: '1px solid ' + t.borderL, fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="transition-colors"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 10, paddingBottom: 10, borderRadius: 8, fontSize: 14, background: t.warning, color: '#fff', fontWeight: 500 }}
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
        <div className="backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div style={{ borderRadius: 12, width: '100%', maxWidth: 448, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowLg, border: '1px solid ' + t.border }}>
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, background: t.dangerBg, borderBottom: '1px solid ' + t.danger + '40' }}>
              <div style={{ padding: 8, borderRadius: 9999, background: t.dangerBg, color: t.danger }}><XCircle size={20}/></div>
              <h3 style={{ color: t.text1, fontWeight: 700 }}>Decline Slip</h3>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', marginBottom: 4, color: t.text4, fontWeight: 700 }}>Reason for Declining</label>
                <textarea
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Please enter the reason for declining..."
                  style={{ width: '100%', padding: 8, borderWidth: 1, borderStyle: 'solid', borderRadius: 8, fontSize: 14, resize: 'none', background: t.bgPanel, borderColor: t.border, color: t.text1 }}
                />
              </div>
            </div>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, background: t.bgCard, borderTop: '1px solid ' + t.border }}>
              <button onClick={() => setShowDeclineModal(false)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, color: t.text3, fontWeight: 500 }}>Cancel</button>
              <button onClick={confirmSlipDecline} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, background: t.danger, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}>Decline Slip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlipFormContent;
