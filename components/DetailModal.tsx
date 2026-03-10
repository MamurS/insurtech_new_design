
import React, { useState } from 'react';
import { Policy, ReinsuranceSlip, Clause, PolicyStatus, TerminationDetails } from '../types';
import { DB } from '../services/db';
import { formatDate } from '../utils/dateUtils';
import { DatePickerInput, parseDate, toISODateString } from './DatePickerInput';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
import { useTheme } from '../theme/useTheme';
import {
  X, Building2, Calendar, DollarSign,
  CheckCircle, FileText, Upload, AlertCircle, XCircle, AlertTriangle,
  MapPin, Shield, Settings, Send, RefreshCw, Archive
} from 'lucide-react';

interface DetailModalProps {
  item: Policy | ReinsuranceSlip | Clause | null;
  onClose: () => void;
  onRefresh?: () => void;
  title?: string;
  allowJsonView?: boolean;
}

export const DetailModal: React.FC<DetailModalProps> = ({ item, onClose, onRefresh, title }) => {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const toast = useToast();
  const { t } = useTheme();

  // Modal States
  const [showTerminationConfirm, setShowTerminationConfirm] = useState(false);
  const [showNTUConfirm, setShowNTUConfirm] = useState(false);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);

  // Slip workflow confirmation state
  const [slipStatusConfirm, setSlipStatusConfirm] = useState<{
    show: boolean;
    newStatus: string;
    additionalFields?: any;
    message: string;
  }>({ show: false, newStatus: '', message: '' });

  // Decline modal state
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const [terminationData, setTerminationData] = useState<TerminationDetails>({
      terminationDate: new Date().toISOString().split('T')[0],
      initiator: 'Us',
      reason: ''
  });

  if (!item) return null;

  const formatMoney = (amount: number | undefined, currency: string = 'USD') => {
    if (amount === undefined || amount === null) return '-';
    const safeCurrency = currency && currency.length === 3 ? currency : 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency }).format(amount);
    } catch {
      return `${safeCurrency} ${Number(amount).toLocaleString()}`;
    }
  };

  const handleStatusChange = async (newStatus: PolicyStatus, policy: Policy, additionalData?: any) => {
    setIsProcessing(true);
    try {
        const updatedPolicy = { ...policy, status: newStatus };
        if (newStatus === PolicyStatus.EARLY_TERMINATION && additionalData) {
            updatedPolicy.terminationDetails = additionalData;
        }
        if (uploadFile) {
            updatedPolicy.signedDocument = {
                fileName: uploadFile.name,
                uploadDate: new Date().toISOString(),
                url: '#'
            };
            if (newStatus === PolicyStatus.ACTIVE) {
                updatedPolicy.activationDate = new Date().toISOString();
            }
        } else if (newStatus === PolicyStatus.ACTIVE) {
            updatedPolicy.activationDate = new Date().toISOString();
        }

        await DB.savePolicy(updatedPolicy);
        if (onRefresh) onRefresh();
        onClose();
    } catch (e) {
        console.error("Error updating status:", e);
        toast.error("Error updating status");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- SLIP WORKFLOW HANDLERS ---

  const statusLabels: Record<string, string> = {
      'PENDING': 'submit for review',
      'QUOTED': 'mark as quoted',
      'SIGNED': 'sign',
      'SENT': 'send to reinsurer',
      'BOUND': 'confirm as bound',
      'CLOSED': 'close',
      'DECLINED': 'decline',
      'NTU': 'mark as not taken up',
      'CANCELLED': 'cancel'
  };

  const requestSlipStatusChange = (newStatus: string, additionalFields: any = {}) => {
    if (!item || !('slipNumber' in item)) {
        toast.error('Error: No slip selected');
        return;
    }
    setSlipStatusConfirm({
        show: true,
        newStatus,
        additionalFields,
        message: `Are you sure you want to ${statusLabels[newStatus] || newStatus.toLowerCase()} this slip?`
    });
  };

  const confirmSlipStatusChange = async () => {
    if (!item || !('slipNumber' in item)) return;
    const slip = item as ReinsuranceSlip;
    const { newStatus, additionalFields } = slipStatusConfirm;

    setSlipStatusConfirm({ show: false, newStatus: '', message: '' });

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
                .eq('id', slip.id);

            if (error) throw error;
        } else {
            // Local fallback
            const updatedSlip = { ...slip, ...updateData };
            await DB.saveSlip(updatedSlip);
        }

        toast.success(`Slip ${statusLabels[newStatus] || 'updated'} successfully!`);
        window.location.reload();

    } catch (error: any) {
        console.error('Error updating slip status:', error);
        toast.error('Failed to update slip: ' + (error.message || 'Unknown error'));
    }
  };

  const handleSlipDecline = () => {
    if (!item || !('slipNumber' in item)) return;
    setDeclineReason('');
    setShowDeclineModal(true);
  };

  const confirmSlipDecline = async () => {
    if (!item || !('slipNumber' in item)) return;
    const slip = item as ReinsuranceSlip;

    setShowDeclineModal(false);

    try {
        if (supabase) {
            const { error } = await supabase
                .from('slips')
                .update({
                    status: 'DECLINED',
                    decline_reason: declineReason,
                    declined_date: new Date().toISOString().split('T')[0],
                    updated_at: new Date().toISOString()
                })
                .eq('id', slip.id);

            if (error) throw error;
        } else {
             // Local fallback
             const updatedSlip = {
                 ...slip,
                 status: 'DECLINED' as any,
                 decline_reason: declineReason,
                 declined_date: new Date().toISOString().split('T')[0]
             };
             await DB.saveSlip(updatedSlip);
        }

        toast.success('Slip declined successfully!');
        window.location.reload();

    } catch (error: any) {
        console.error('Error declining slip:', error);
        toast.error('Failed to decline slip: ' + (error.message || 'Unknown error'));
    }
  };

  const getSlipStatusBadge = (status: string) => {
    const badgeStyles: Record<string, { background: string; color: string }> = {
        'DRAFT': { background: t.bgCard, color: t.text1 },
        'PENDING': { background: t.accent + '18', color: t.accent },
        'QUOTED': { background: '#a855f718', color: '#a855f7' },
        'SIGNED': { background: '#6366f118', color: '#6366f1' },
        'SENT': { background: '#06b6d418', color: '#06b6d4' },
        'BOUND': { background: t.success + '18', color: t.success },
        'CLOSED': { background: t.bgCard, color: t.text1 },
        'DECLINED': { background: t.danger + '18', color: t.danger },
        'NTU': { background: t.warning + '18', color: t.warning },
        'CANCELLED': { background: t.danger + '18', color: t.danger },
        'Active': { background: t.success + '18', color: t.success }
    };
    const s = badgeStyles[status] || { background: t.bgCard, color: t.text1 };
    return (
        <span className="px-3 py-1 rounded-full text-sm" style={{ background: s.background, color: s.color, fontWeight: 500 }}>
            {status || 'DRAFT'}
        </span>
    );
  };

  const renderTerminationModal = () => (
      <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="rounded-xl w-full max-w-md overflow-hidden" style={{ background: t.bgPanel, boxShadow: t.shadowLg, border: `1px solid ${t.border}` }}>
              <div className="p-4 flex items-center gap-3" style={{ background: t.warningBg, borderBottom: `1px solid ${t.warning}40` }}>
                  <div className="p-2 rounded-full" style={{ background: t.warningBg, color: t.warning }}><AlertTriangle size={20}/></div>
                  <h3 style={{ color: t.text1, fontWeight: 700 }}>Early Policy Termination</h3>
              </div>
              <div className="p-6 space-y-4">
                  <div>
                      <DatePickerInput label="Termination Date" value={parseDate(terminationData.terminationDate)} onChange={(date) => setTerminationData({...terminationData, terminationDate: toISODateString(date) || ''})}/>
                  </div>
                  <div>
                      <label className="block text-xs uppercase mb-1" style={{ color: t.text4, fontWeight: 700 }}>Initiated By</label>
                      <select value={terminationData.initiator} onChange={(e) => setTerminationData({...terminationData, initiator: e.target.value as any})} className="w-full p-2 rounded-lg text-sm" style={{ background: t.bgPanel, borderColor: t.border, border: `1px solid ${t.border}`, color: t.text1 }}>
                          <option value="Us">Us (Insurer)</option>
                          <option value="Broker">Broker</option>
                          <option value="Cedant">Cedant / Client</option>
                          <option value="Other">Other</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-xs uppercase mb-1" style={{ color: t.text4, fontWeight: 700 }}>Reason for Termination</label>
                      <textarea rows={3} value={terminationData.reason} onChange={(e) => setTerminationData({...terminationData, reason: e.target.value})} className="w-full p-2 rounded-lg text-sm resize-none" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text1 }}/>
                  </div>
              </div>
              <div className="p-4 flex justify-end gap-2" style={{ background: t.bgCard, borderTop: `1px solid ${t.border}` }}>
                  <button onClick={() => setShowTerminationConfirm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: t.text3, fontWeight: 500 }}>Cancel</button>
                  <button onClick={() => handleStatusChange(PolicyStatus.EARLY_TERMINATION, item as Policy, terminationData)} className="px-4 py-2 rounded-lg text-sm" style={{ background: t.danger, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}>Terminate Policy</button>
              </div>
          </div>
      </div>
  );

  const renderNTUModal = () => (
      <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-xl w-full max-w-md overflow-hidden" style={{ background: t.bgPanel, boxShadow: t.shadowLg, border: `1px solid ${t.border}` }}>
            <div className="p-4 flex items-center gap-3" style={{ background: t.bgCard, borderBottom: `1px solid ${t.border}` }}>
                <div className="p-2 rounded-full" style={{ background: t.bgHover, color: t.text3 }}><XCircle size={20}/></div>
                <h3 style={{ color: t.text1, fontWeight: 700 }}>Confirm "Not Taken Up"</h3>
            </div>
            <div className="p-6">
                <p className="text-sm" style={{ color: t.text3 }}>This means the deal was cancelled by the client/broker before inception.</p>
            </div>
            <div className="p-4 flex justify-end gap-2" style={{ background: t.bgCard, borderTop: `1px solid ${t.border}` }}>
                <button type="button" onClick={() => setShowNTUConfirm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: t.text3, fontWeight: 500 }}>Go Back</button>
                <button type="button" onClick={() => { setShowNTUConfirm(false); handleStatusChange(PolicyStatus.NTU, item as Policy); }} disabled={isProcessing} className="px-4 py-2 rounded-lg text-sm" style={{ background: t.text2, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}>Confirm NTU</button>
            </div>
        </div>
    </div>
  );

  const renderActivateModal = () => (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-xl w-full max-w-md overflow-hidden" style={{ background: t.bgPanel, boxShadow: t.shadowLg, border: `1px solid ${t.border}` }}>
            <div className="p-4 flex items-center gap-3" style={{ background: t.successBg, borderBottom: `1px solid ${t.success}40` }}>
                <div className="p-2 rounded-full" style={{ background: t.success + '18', color: t.success }}><CheckCircle size={20}/></div>
                <h3 style={{ color: t.text1, fontWeight: 700 }}>Bind & Activate Policy</h3>
            </div>
            <div className="p-6">
                {!uploadFile && !(item as Policy)?.signedDocument ? (
                    <div className="rounded-lg p-3 mb-4" style={{ background: t.warningBg, border: `1px solid ${t.warning}40` }}>
                        <p className="text-sm flex items-center gap-2" style={{ color: t.warning, fontWeight: 500 }}><AlertCircle size={16} /> No signed document uploaded</p>
                    </div>
                ) : (
                    <div className="rounded-lg p-3 mb-4" style={{ background: t.successBg, border: `1px solid ${t.success}40` }}>
                        <p className="text-sm flex items-center gap-2" style={{ color: t.success, fontWeight: 500 }}><CheckCircle size={16} /> {uploadFile ? `Document ready: ${uploadFile.name}` : 'Signed document on file'}</p>
                    </div>
                )}
                <p className="text-sm" style={{ color: t.text3 }}>This will bind the risk and mark the policy as <strong>Active</strong>.</p>
            </div>
            <div className="p-4 flex justify-end gap-2" style={{ background: t.bgCard, borderTop: `1px solid ${t.border}` }}>
                <button type="button" onClick={() => setShowActivateConfirm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: t.text3, fontWeight: 500 }}>Go Back</button>
                <button type="button" onClick={() => { setShowActivateConfirm(false); handleStatusChange(PolicyStatus.ACTIVE, item as Policy); }} disabled={isProcessing} className="px-4 py-2 rounded-lg text-sm flex items-center gap-2" style={{ background: t.success, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}>Activate Policy</button>
            </div>
        </div>
    </div>
  );

  const renderPolicyDetail = (policy: Policy) => {
    return (
    <div className="space-y-6 relative">
        {/* Header Badge */}
        <div className="flex flex-wrap items-center gap-3 mb-4 justify-between">
            <div className="flex gap-3">
                <span className="px-3 py-1 rounded-full text-sm" style={{ fontWeight: 700, ...(policy.channel === 'Direct' ? { background: t.accent + '18', color: t.accent } : { background: '#a855f718', color: '#a855f7' }) }}>{policy.channel} Insurance</span>
                <span className="px-3 py-1 rounded-full text-sm" style={{ background: t.bgCard, color: t.text2, fontWeight: 700 }}>{policy.status}</span>
                {policy.isDeleted && <span className="px-3 py-1 rounded-full text-sm animate-pulse" style={{ background: t.danger, color: '#fff', fontWeight: 700 }}>DELETED</span>}
            </div>
        </div>

        {/* WORKFLOW ACTIONS */}
        {policy.status === PolicyStatus.PENDING && (
            <div className="rounded-xl p-5 mb-6" style={{ background: t.warningBg, border: `1px solid ${t.warning}40`, boxShadow: t.shadow }}>
                <h4 className="flex items-center gap-2 mb-3" style={{ color: t.warning, fontWeight: 700 }}><AlertCircle size={18} /> Underwriting Workflow</h4>
                <div className="p-4 rounded-lg mb-4 flex items-center gap-3" style={{ background: t.bgPanel, border: `1px solid ${t.warning}40` }}>
                    <label className="cursor-pointer px-4 py-2 rounded-lg text-sm flex items-center gap-2" style={{ background: t.bgCard, color: t.text2, fontWeight: 500 }}><Upload size={16} /> {uploadFile ? uploadFile.name : "Choose PDF..."}<input type="file" accept=".pdf" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowNTUConfirm(true)} className="w-full py-2.5 rounded-lg text-sm" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text2, fontWeight: 700 }}>Mark as NTU</button>
                    <button onClick={() => setShowActivateConfirm(true)} className="w-full py-2.5 rounded-lg text-sm" style={{ background: t.success, color: '#fff', fontWeight: 700 }}>Bind & Activate</button>
                </div>
            </div>
        )}

        {/* EARLY TERMINATION BUTTON */}
        {policy.status === PolicyStatus.ACTIVE && (
            <div className="rounded-xl p-4 mb-6 flex justify-between items-center relative z-20" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                <div className="text-sm flex items-center gap-2" style={{ color: t.text3 }}><CheckCircle style={{ color: t.success }} size={18} /><span style={{ color: t.text1, fontWeight: 700 }}>Policy is Active.</span></div>
                <button onClick={() => setShowTerminationConfirm(true)} className="px-4 py-2 rounded-lg text-sm flex items-center gap-2" style={{ background: t.bgPanel, border: `1px solid ${t.warning}40`, color: t.warning, fontWeight: 700 }}><XCircle size={16} /> Early Termination</button>
            </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="pb-2 flex items-center gap-2" style={{ color: t.text1, borderBottom: `1px solid ${t.border}`, fontWeight: 700 }}><Building2 size={16}/> Core Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><div style={{ color: t.text4 }}>Insured Name</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.insuredName}</div></div>
                    <div><div style={{ color: t.text4 }}>Ref / Policy No</div><div className="font-mono" style={{ color: t.text1, fontWeight: 500 }}>{policy.policyNumber}</div></div>
                    {policy.secondaryPolicyNumber && <div><div style={{ color: t.text4 }}>Secondary Ref</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.secondaryPolicyNumber}</div></div>}
                    {policy.agreementNumber && <div><div style={{ color: t.text4 }}>Agreement No</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.agreementNumber}</div></div>}

                    {policy.channel === 'Inward' && <div className="col-span-2 p-2 rounded" style={{ background: '#a855f718', border: '1px solid #a855f720' }}><div className="text-xs uppercase" style={{ color: '#a855f7', fontWeight: 700 }}>Cedant</div><div style={{ color: '#a855f7', fontWeight: 500 }}>{policy.cedantName || '-'}</div></div>}
                    <div className="col-span-2 p-2 rounded" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}><div className="text-xs uppercase" style={{ color: t.text4 }}>Intermediary ({policy.intermediaryType})</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.intermediaryName || 'Direct'}</div></div>

                    {policy.borrower && <div><div style={{ color: t.text4 }}>Borrower</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.borrower}</div></div>}
                    {policy.insuredAddress && <div className="col-span-2"><div style={{ color: t.text4 }}>Insured Address</div><div className="truncate" style={{ color: t.text1, fontWeight: 500 }}>{policy.insuredAddress}</div></div>}

                     <div><div style={{ color: t.text4 }}>Industry</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.industry || '-'}</div></div>
                     <div><div style={{ color: t.text4 }}>Territory</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.territory}</div></div>
                     <div><div style={{ color: t.text4 }}>Class</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.classOfInsurance}</div></div>
                     <div><div style={{ color: t.text4 }}>Risk Code</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.riskCode || '-'}</div></div>
                </div>
            </div>

            <div className="space-y-4">
                 <h4 className="pb-2 flex items-center gap-2" style={{ color: t.text1, borderBottom: `1px solid ${t.border}`, fontWeight: 700 }}><Calendar size={16}/> Dates & Terms</h4>
                 <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><div style={{ color: t.text4 }}>Inception</div><div style={{ color: t.text1, fontWeight: 500 }}>{formatDate(policy.inceptionDate)}</div></div>
                    <div><div style={{ color: t.text4 }}>Expiry</div><div style={{ color: t.text1, fontWeight: 500 }}>{formatDate(policy.expiryDate)}</div></div>

                    {policy.dateOfSlip && <div><div style={{ color: t.text4 }}>Date of Slip</div><div style={{ color: t.text1, fontWeight: 500 }}>{formatDate(policy.dateOfSlip)}</div></div>}
                    {policy.accountingDate && <div><div style={{ color: t.text4 }}>Accounting Date</div><div style={{ color: t.text1, fontWeight: 500 }}>{formatDate(policy.accountingDate)}</div></div>}

                    <div className="col-span-2"><div style={{ color: t.text4 }}>Deductible</div><div className="p-2 rounded text-xs" style={{ color: t.text1, background: t.bgCard, fontWeight: 500 }}>{policy.deductible || 'N/A'}</div></div>
                 </div>
            </div>
        </div>

        {/* Financials */}
        <div className="p-6 rounded-xl" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
             <h4 className="mb-4 flex items-center gap-2" style={{ color: t.text1, fontWeight: 700 }}><DollarSign size={16}/> Financials ({policy.currency})</h4>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                 <div><div style={{ color: t.text4 }}>Sum Insured</div><div style={{ color: t.text1, fontWeight: 700, fontSize: 15 }}>{formatMoney(policy.sumInsured, policy.currency)}</div></div>
                 <div><div style={{ color: t.text4 }}>Limit of Liability</div><div style={{ color: t.text1, fontWeight: 500 }}>{formatMoney(policy.limitForeignCurrency, policy.currency)}</div></div>
                 <div><div style={{ color: t.text4 }}>Gross Premium</div><div style={{ color: t.success, fontWeight: 700, fontSize: 15 }}>{formatMoney(policy.grossPremium, policy.currency)}</div></div>
                 <div><div style={{ color: t.text4 }}>Net Premium</div><div style={{ color: t.accent, fontWeight: 700, fontSize: 15 }}>{formatMoney(policy.netPremium, policy.currency)}</div></div>
             </div>
             {policy.hasOutwardReinsurance && (
                 <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
                     <h5 className="font-bold text-xs uppercase mb-2" style={{ color: t.warning }}>Outward Reinsurance</h5>
                     <div className="grid grid-cols-2 gap-4 text-sm">
                         <div><div style={{ color: t.text4 }}>Market</div><div className="font-medium">{policy.reinsurers && policy.reinsurers.length > 0 ? 'Panel Placement' : policy.reinsurerName || '-'}</div></div>
                         <div><div style={{ color: t.text4 }}>Ceded Share</div><div className="font-medium">{policy.cededShare}%</div></div>
                     </div>
                 </div>
             )}
        </div>
    </div>
    );
  };

  const renderSlipDetail = (slip: ReinsuranceSlip) => {
    try {
      // Normalize legacy status values
      let currentStatus = (slip.status as unknown as string) || 'DRAFT';

      // Map legacy 'Active' to 'BOUND'
      if (currentStatus === 'Active') currentStatus = 'BOUND';

      // Safely parse reinsurers — may arrive as JSON string from DB
      let reinsurers = slip.reinsurers as any;
      if (typeof reinsurers === 'string') {
        try { reinsurers = JSON.parse(reinsurers); } catch { reinsurers = []; }
      }
      if (!Array.isArray(reinsurers)) reinsurers = [];

      return (
      <div className="space-y-6">
          <div className="flex gap-3 mb-4 items-center">
              <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ background: t.warning + '18', color: t.warning }}>Reinsurance Slip</span>
              {getSlipStatusBadge(currentStatus)}
          </div>

          {/* Slip Workflow Actions */}
          <div className="rounded-lg p-4 mb-4" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <h3 className="font-bold mb-3 flex items-center gap-2 text-xs uppercase tracking-wide" style={{ color: t.text1 }}>
                <Settings size={14} />
                Workflow Actions
            </h3>

            <div className="flex flex-wrap gap-2">
                {/* DRAFT status */}
                {(!slip.status || currentStatus === 'DRAFT') && (
                    <button
                        onClick={() => requestSlipStatusChange('PENDING')}
                        className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                        style={{ background: t.accent, color: '#fff', boxShadow: t.shadow }}
                    >
                        <Send size={16} />
                        Submit for Review
                    </button>
                )}

                {/* PENDING status */}
                {currentStatus === 'PENDING' && (
                    <>
                        <button
                            onClick={() => requestSlipStatusChange('QUOTED')}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                            style={{ background: t.accent, color: '#fff', boxShadow: t.shadow }}
                        >
                            <FileText size={16} />
                            Quote Received
                        </button>
                        <button
                            onClick={() => handleSlipDecline()}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                            style={{ background: t.danger, color: '#fff', boxShadow: t.shadow }}
                        >
                            <XCircle size={16} />
                            Decline
                        </button>
                    </>
                )}

                {/* QUOTED status */}
                {currentStatus === 'QUOTED' && (
                    <>
                        <button
                            onClick={() => requestSlipStatusChange('SIGNED', { signed_date: new Date().toISOString().split('T')[0] })}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                            style={{ background: t.success, color: '#fff', boxShadow: t.shadow }}
                        >
                            <CheckCircle size={16} />
                            Accept & Sign
                        </button>
                        <button
                            onClick={() => requestSlipStatusChange('NTU')}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                            style={{ background: t.warning, color: '#fff', boxShadow: t.shadow }}
                        >
                            <XCircle size={16} />
                            Not Taken Up
                        </button>
                    </>
                )}

                {/* SIGNED status */}
                {currentStatus === 'SIGNED' && (
                    <button
                        onClick={() => requestSlipStatusChange('SENT', { sent_date: new Date().toISOString().split('T')[0] })}
                        className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                        style={{ background: t.accent, color: '#fff', boxShadow: t.shadow }}
                    >
                        <Send size={16} />
                        Send to Reinsurer
                    </button>
                )}

                {/* SENT status */}
                {currentStatus === 'SENT' && (
                    <>
                        <button
                            onClick={() => requestSlipStatusChange('BOUND', { bound_date: new Date().toISOString().split('T')[0] })}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                            style={{ background: t.success, color: '#fff', boxShadow: t.shadow }}
                        >
                            <CheckCircle size={16} />
                            Confirm Bound
                        </button>
                        <button
                            onClick={() => requestSlipStatusChange('NTU')}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                            style={{ background: t.warning, color: '#fff', boxShadow: t.shadow }}
                        >
                            <XCircle size={16} />
                            Withdrawn
                        </button>
                    </>
                )}

                {/* BOUND status */}
                {currentStatus === 'BOUND' && (
                    <button
                        onClick={() => requestSlipStatusChange('CLOSED', { closed_date: new Date().toISOString().split('T')[0] })}
                        className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                        style={{ background: t.text3, color: '#fff', boxShadow: t.shadow }}
                    >
                        <Archive size={16} />
                        Close Slip
                    </button>
                )}

                {/* DECLINED, NTU, CANCELLED status */}
                {['DECLINED', 'NTU', 'CANCELLED'].includes(currentStatus) && (
                    <button
                        onClick={() => requestSlipStatusChange('PENDING')}
                        className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
                        style={{ background: t.warning, color: '#fff', boxShadow: t.shadow }}
                    >
                        <RefreshCw size={16} />
                        Reopen
                    </button>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                  <h4 className="font-bold mb-3 flex items-center gap-2" style={{ color: t.text1 }}><FileText size={16}/> Slip Details</h4>
                  <div className="space-y-3 text-sm">
                      <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Slip Number</div><div className="font-mono font-bold text-lg" style={{ color: t.accent }}>{slip.slipNumber}</div></div>
                      <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Date</div><div className="font-medium">{formatDate(slip.date)}</div></div>
                      <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Insured Name</div><div className="font-medium">{slip.insuredName}</div></div>
                  </div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                  <h4 className="font-bold mb-3 flex items-center gap-2" style={{ color: t.text1 }}><DollarSign size={16}/> Values</h4>
                  <div className="space-y-3 text-sm">
                      <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Limit of Liability</div><div className="font-mono font-bold text-lg">{formatMoney(slip.limitOfLiability, slip.currency as string)}</div></div>
                      <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Broker / Reinsurer</div><div className="font-medium">{slip.brokerReinsurer}</div></div>
                  </div>
              </div>
          </div>

          {reinsurers.length > 0 && (
              <div className="p-4 rounded-xl" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                  <h4 className="font-bold mb-3 text-sm" style={{ color: t.text1 }}>Market Panel</h4>
                  <table className="w-full text-sm text-left">
                      <thead>
                          <tr style={{ color: t.text4, borderBottom: `1px solid ${t.border}` }}>
                              <th className="pb-2">Reinsurer</th>
                              <th className="pb-2 text-right">Share %</th>
                              <th className="pb-2 text-right">Comm %</th>
                          </tr>
                      </thead>
                      <tbody>
                          {reinsurers.map((r: any, i: number) => (
                              <tr key={i} className="last:border-0" style={{ borderBottom: `1px solid ${t.border}` }}>
                                  <td className="py-2 font-medium">{r.name}</td>
                                  <td className="py-2 text-right">{r.share}%</td>
                                  <td className="py-2 text-right">{r.commission}%</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </div>
      );
    } catch (error) {
      console.error('Error rendering slip detail:', error);
      return (
        <div className="p-4" style={{ color: t.danger }}>
          <p>Error displaying slip details. Please try again.</p>
          <pre className="text-xs mt-2">{String(error)}</pre>
        </div>
      );
    }
  };

  const renderClauseDetail = (clause: Clause) => (
      <div className="space-y-4">
          <div className="flex justify-between items-start">
              <div>
                  <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{clause.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded uppercase font-bold mt-1 inline-block" style={
                      clause.category === 'Exclusion' ? { background: t.danger + '18', color: t.danger } :
                      clause.category === 'Warranty' ? { background: t.warning + '18', color: t.warning } :
                      { background: t.accent + '18', color: t.accent }
                  }>{clause.category}</span>
              </div>
              {clause.isStandard && <span className="text-xs px-2 py-1 rounded font-bold" style={{ background: t.success + '18', color: t.success }}>Standard</span>}
          </div>
          <div className="p-4 rounded-xl font-serif text-sm leading-relaxed whitespace-pre-wrap" style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.text1 }}>
              {clause.content}
          </div>
      </div>
  );

  // Type Guards
  const isPolicy = (i: any): i is Policy => 'policyNumber' in i;
  const isSlip = (i: any): i is ReinsuranceSlip => 'slipNumber' in i && !('policyNumber' in i);
  const isClause = (i: any): i is Clause => 'title' in i && 'content' in i;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" style={{ background: t.bgPanel, boxShadow: t.shadowLg }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-4 flex justify-between items-center sticky top-0 z-10" style={{ background: t.bgPanel, borderBottom: `1px solid ${t.border}` }}>
           <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{title || 'Details'}</h3>
           <button onClick={onClose} className="p-1 rounded-full transition-colors" style={{ color: t.text4 }}><X size={20}/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ background: t.bgPanel }}>
            {isPolicy(item) && renderPolicyDetail(item)}
            {isSlip(item) && renderSlipDetail(item)}
            {isClause(item) && renderClauseDetail(item)}
            {!isPolicy(item) && !isSlip(item) && !isClause(item) && (
              <div className="p-4">
                <pre className="text-xs whitespace-pre-wrap" style={{ color: t.text3 }}>
                  {JSON.stringify(item, null, 2)}
                </pre>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 flex justify-end" style={{ background: t.bgCard, borderTop: `1px solid ${t.border}` }}>
            <button onClick={onClose} className="px-5 py-2 rounded-lg font-bold text-sm transition-colors" style={{ background: t.bgHover, color: t.text1 }}>Close</button>
        </div>

        {/* Overlays */}
        {showTerminationConfirm && renderTerminationModal()}
        {showNTUConfirm && renderNTUModal()}
        {showActivateConfirm && renderActivateModal()}

        {/* Slip Status Change Confirm Dialog */}
        <ConfirmDialog
            isOpen={slipStatusConfirm.show}
            title="Confirm Action"
            message={slipStatusConfirm.message}
            onConfirm={confirmSlipStatusChange}
            onCancel={() => setSlipStatusConfirm({ show: false, newStatus: '', message: '' })}
            confirmText="Confirm"
            variant="warning"
        />

        {/* Decline Slip Modal */}
        {showDeclineModal && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="rounded-xl w-full max-w-md overflow-hidden" style={{ background: t.bgPanel, boxShadow: t.shadowLg, border: `1px solid ${t.border}` }}>
                    <div className="p-4 flex items-center gap-3" style={{ background: t.dangerBg, borderBottom: `1px solid ${t.danger}40` }}>
                        <div className="p-2 rounded-full" style={{ background: t.danger + '18', color: t.danger }}><XCircle size={20}/></div>
                        <h3 style={{ color: t.text1, fontWeight: 700 }}>Decline Slip</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs uppercase mb-1" style={{ color: t.text4, fontWeight: 700 }}>Reason for Declining</label>
                            <textarea
                                rows={3}
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                                placeholder="Please enter the reason for declining..."
                                className="w-full p-2 rounded-lg text-sm resize-none"
                                style={{ background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text1 }}
                            />
                        </div>
                    </div>
                    <div className="p-4 flex justify-end gap-2" style={{ background: t.bgCard, borderTop: `1px solid ${t.border}` }}>
                        <button onClick={() => setShowDeclineModal(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: t.text3, fontWeight: 500 }}>Cancel</button>
                        <button onClick={confirmSlipDecline} className="px-4 py-2 rounded-lg text-sm" style={{ background: t.danger, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}>Decline Slip</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
