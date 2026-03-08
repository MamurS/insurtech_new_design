
import React, { useState } from 'react';
import { Policy, ReinsuranceSlip, Clause, PolicyStatus, TerminationDetails } from '../types';
import { DB } from '../services/db';
import { formatDate } from '../utils/dateUtils';
import { DatePickerInput, parseDate, toISODateString } from './DatePickerInput';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
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
    const styles: Record<string, string> = {
        'DRAFT': 'bg-gray-100 text-gray-800',
        'PENDING': 'bg-blue-100 text-blue-800',
        'QUOTED': 'bg-purple-100 text-purple-800',
        'SIGNED': 'bg-indigo-100 text-indigo-800',
        'SENT': 'bg-cyan-100 text-cyan-800',
        'BOUND': 'bg-green-100 text-green-800',
        'CLOSED': 'bg-gray-100 text-gray-800',
        'DECLINED': 'bg-red-100 text-red-800',
        'NTU': 'bg-yellow-100 text-yellow-800',
        'CANCELLED': 'bg-red-100 text-red-800',
        'Active': 'bg-green-100 text-green-800' // Legacy support
    };
    return (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
            {status || 'DRAFT'}
        </span>
    );
  };

  const renderTerminationModal = () => (
      <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
              <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center gap-3">
                  <div className="bg-orange-100 p-2 rounded-full text-orange-600"><AlertTriangle size={20}/></div>
                  <h3 className="font-bold text-gray-800">Early Policy Termination</h3>
              </div>
              <div className="p-6 space-y-4">
                  <div>
                      <DatePickerInput label="Termination Date" value={parseDate(terminationData.terminationDate)} onChange={(date) => setTerminationData({...terminationData, terminationDate: toISODateString(date) || ''})}/>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Initiated By</label>
                      <select value={terminationData.initiator} onChange={(e) => setTerminationData({...terminationData, initiator: e.target.value as any})} className="w-full p-2 bg-white border rounded-lg text-sm text-gray-900">
                          <option value="Us">Us (Insurer)</option>
                          <option value="Broker">Broker</option>
                          <option value="Cedant">Cedant / Client</option>
                          <option value="Other">Other</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason for Termination</label>
                      <textarea rows={3} value={terminationData.reason} onChange={(e) => setTerminationData({...terminationData, reason: e.target.value})} className="w-full p-2 bg-white border rounded-lg text-sm resize-none text-gray-900"/>
                  </div>
              </div>
              <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                  <button onClick={() => setShowTerminationConfirm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg text-sm">Cancel</button>
                  <button onClick={() => handleStatusChange(PolicyStatus.EARLY_TERMINATION, item as Policy, terminationData)} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 text-sm shadow-sm">Terminate Policy</button>
              </div>
          </div>
      </div>
  );

  const renderNTUModal = () => (
      <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 p-4 border-b flex items-center gap-3">
                <div className="bg-gray-200 p-2 rounded-full text-gray-600"><XCircle size={20}/></div>
                <h3 className="font-bold text-gray-800">Confirm "Not Taken Up"</h3>
            </div>
            <div className="p-6">
                <p className="text-gray-600 text-sm">This means the deal was cancelled by the client/broker before inception.</p>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                <button type="button" onClick={() => setShowNTUConfirm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg text-sm">Go Back</button>
                <button type="button" onClick={() => { setShowNTUConfirm(false); handleStatusChange(PolicyStatus.NTU, item as Policy); }} disabled={isProcessing} className="px-4 py-2 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-800 text-sm shadow-sm">Confirm NTU</button>
            </div>
        </div>
    </div>
  );

  const renderActivateModal = () => (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
            <div className="bg-green-50 p-4 border-b border-green-100 flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full text-green-600"><CheckCircle size={20}/></div>
                <h3 className="font-bold text-gray-800">Bind & Activate Policy</h3>
            </div>
            <div className="p-6">
                {!uploadFile && !(item as Policy)?.signedDocument ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                        <p className="text-amber-800 text-sm font-medium flex items-center gap-2"><AlertCircle size={16} /> No signed document uploaded</p>
                    </div>
                ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <p className="text-green-800 text-sm font-medium flex items-center gap-2"><CheckCircle size={16} /> {uploadFile ? `Document ready: ${uploadFile.name}` : 'Signed document on file'}</p>
                    </div>
                )}
                <p className="text-gray-600 text-sm">This will bind the risk and mark the policy as <strong>Active</strong>.</p>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                <button type="button" onClick={() => setShowActivateConfirm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg text-sm">Go Back</button>
                <button type="button" onClick={() => { setShowActivateConfirm(false); handleStatusChange(PolicyStatus.ACTIVE, item as Policy); }} disabled={isProcessing} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 text-sm shadow-sm flex items-center gap-2">Activate Policy</button>
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
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${policy.channel === 'Direct' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{policy.channel} Insurance</span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold">{policy.status}</span>
                {policy.isDeleted && <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">DELETED</span>}
            </div>
        </div>

        {/* WORKFLOW ACTIONS */}
        {policy.status === PolicyStatus.PENDING && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-6 shadow-sm">
                <h4 className="font-bold text-orange-900 flex items-center gap-2 mb-3"><AlertCircle size={18} /> Underwriting Workflow</h4>
                <div className="bg-white p-4 rounded-lg border border-orange-100 mb-4 flex items-center gap-3">
                    <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"><Upload size={16} /> {uploadFile ? uploadFile.name : "Choose PDF..."}<input type="file" accept=".pdf" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowNTUConfirm(true)} className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-red-50 text-sm">Mark as NTU</button>
                    <button onClick={() => setShowActivateConfirm(true)} className="w-full py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 text-sm">Bind & Activate</button>
                </div>
            </div>
        )}

        {/* EARLY TERMINATION BUTTON */}
        {policy.status === PolicyStatus.ACTIVE && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm flex justify-between items-center relative z-20">
                <div className="text-sm text-gray-600 flex items-center gap-2"><CheckCircle className="text-green-600" size={18} /><span className="font-bold text-gray-800">Policy is Active.</span></div>
                <button onClick={() => setShowTerminationConfirm(true)} className="px-4 py-2 bg-white border border-orange-200 text-orange-600 font-bold rounded-lg hover:bg-orange-50 text-sm flex items-center gap-2"><XCircle size={16} /> Early Termination</button>
            </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Building2 size={16}/> Core Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><div className="text-gray-500">Insured Name</div><div className="font-medium text-gray-900">{policy.insuredName}</div></div>
                    <div><div className="text-gray-500">Ref / Policy No</div><div className="font-medium text-gray-900 font-mono">{policy.policyNumber}</div></div>
                    {policy.secondaryPolicyNumber && <div><div className="text-gray-500">Secondary Ref</div><div className="font-medium text-gray-900">{policy.secondaryPolicyNumber}</div></div>}
                    {policy.agreementNumber && <div><div className="text-gray-500">Agreement No</div><div className="font-medium text-gray-900">{policy.agreementNumber}</div></div>}
                    
                    {policy.channel === 'Inward' && <div className="col-span-2 bg-purple-50 p-2 rounded border border-purple-100"><div className="text-purple-800 text-xs uppercase font-bold">Cedant</div><div className="font-medium text-purple-900">{policy.cedantName || '-'}</div></div>}
                    <div className="col-span-2 bg-gray-50 p-2 rounded border border-gray-200"><div className="text-gray-500 text-xs uppercase">Intermediary ({policy.intermediaryType})</div><div className="font-medium text-gray-900">{policy.intermediaryName || 'Direct'}</div></div>

                    {policy.borrower && <div><div className="text-gray-500">Borrower</div><div className="font-medium text-gray-900">{policy.borrower}</div></div>}
                    {policy.insuredAddress && <div className="col-span-2"><div className="text-gray-500">Insured Address</div><div className="font-medium text-gray-900 truncate">{policy.insuredAddress}</div></div>}

                     <div><div className="text-gray-500">Industry</div><div className="font-medium text-gray-900">{policy.industry || '-'}</div></div>
                     <div><div className="text-gray-500">Territory</div><div className="font-medium text-gray-900">{policy.territory}</div></div>
                     <div><div className="text-gray-500">Class</div><div className="font-medium text-gray-900">{policy.classOfInsurance}</div></div>
                     <div><div className="text-gray-500">Risk Code</div><div className="font-medium text-gray-900">{policy.riskCode || '-'}</div></div>
                </div>
            </div>

            <div className="space-y-4">
                 <h4 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Calendar size={16}/> Dates & Terms</h4>
                 <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><div className="text-gray-500">Inception</div><div className="font-medium text-gray-900">{formatDate(policy.inceptionDate)}</div></div>
                    <div><div className="text-gray-500">Expiry</div><div className="font-medium text-gray-900">{formatDate(policy.expiryDate)}</div></div>
                    
                    {policy.dateOfSlip && <div><div className="text-gray-500">Date of Slip</div><div className="font-medium text-gray-900">{formatDate(policy.dateOfSlip)}</div></div>}
                    {policy.accountingDate && <div><div className="text-gray-500">Accounting Date</div><div className="font-medium text-gray-900">{formatDate(policy.accountingDate)}</div></div>}
                    
                    <div className="col-span-2"><div className="text-gray-500">Deductible</div><div className="font-medium text-gray-900 bg-gray-50 p-2 rounded text-xs">{policy.deductible || 'N/A'}</div></div>
                 </div>
            </div>
        </div>

        {/* Financials */}
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
             <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><DollarSign size={16}/> Financials ({policy.currency})</h4>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                 <div><div className="text-gray-500">Sum Insured</div><div className="font-bold text-lg text-gray-900">{formatMoney(policy.sumInsured, policy.currency)}</div></div>
                 <div><div className="text-gray-500">Limit of Liability</div><div className="font-medium text-gray-900">{formatMoney(policy.limitForeignCurrency, policy.currency)}</div></div>
                 <div><div className="text-gray-500">Gross Premium</div><div className="font-bold text-lg text-green-700">{formatMoney(policy.grossPremium, policy.currency)}</div></div>
                 <div><div className="text-gray-500">Net Premium</div><div className="font-bold text-lg text-blue-700">{formatMoney(policy.netPremium, policy.currency)}</div></div>
             </div>
             {policy.hasOutwardReinsurance && (
                 <div className="mt-4 pt-4 border-t border-gray-200">
                     <h5 className="font-bold text-amber-800 text-xs uppercase mb-2">Outward Reinsurance</h5>
                     <div className="grid grid-cols-2 gap-4 text-sm">
                         <div><div className="text-gray-500">Market</div><div className="font-medium">{policy.reinsurers && policy.reinsurers.length > 0 ? 'Panel Placement' : policy.reinsurerName || '-'}</div></div>
                         <div><div className="text-gray-500">Ceded Share</div><div className="font-medium">{policy.cededShare}%</div></div>
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
              <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-bold">Reinsurance Slip</span>
              {getSlipStatusBadge(currentStatus)}
          </div>

          {/* Slip Workflow Actions */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-xs uppercase tracking-wide">
                <Settings size={14} />
                Workflow Actions
            </h3>

            <div className="flex flex-wrap gap-2">
                {/* DRAFT status */}
                {(!slip.status || currentStatus === 'DRAFT') && (
                    <button
                        onClick={() => requestSlipStatusChange('PENDING')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-bold shadow-sm"
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
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-bold shadow-sm"
                        >
                            <FileText size={16} />
                            Quote Received
                        </button>
                        <button
                            onClick={() => handleSlipDecline()}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-bold shadow-sm"
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
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-bold shadow-sm"
                        >
                            <CheckCircle size={16} />
                            Accept & Sign
                        </button>
                        <button
                            onClick={() => requestSlipStatusChange('NTU')}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 text-sm font-bold shadow-sm"
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
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-bold shadow-sm"
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
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-bold shadow-sm"
                        >
                            <CheckCircle size={16} />
                            Confirm Bound
                        </button>
                        <button
                            onClick={() => requestSlipStatusChange('NTU')}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 text-sm font-bold shadow-sm"
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
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 text-sm font-bold shadow-sm"
                    >
                        <Archive size={16} />
                        Close Slip
                    </button>
                )}

                {/* DECLINED, NTU, CANCELLED status */}
                {['DECLINED', 'NTU', 'CANCELLED'].includes(currentStatus) && (
                    <button
                        onClick={() => requestSlipStatusChange('PENDING')}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 text-sm font-bold shadow-sm"
                    >
                        <RefreshCw size={16} />
                        Reopen
                    </button>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><FileText size={16}/> Slip Details</h4>
                  <div className="space-y-3 text-sm">
                      <div><div className="text-gray-500 text-xs uppercase">Slip Number</div><div className="font-mono font-bold text-lg text-blue-600">{slip.slipNumber}</div></div>
                      <div><div className="text-gray-500 text-xs uppercase">Date</div><div className="font-medium">{formatDate(slip.date)}</div></div>
                      <div><div className="text-gray-500 text-xs uppercase">Insured Name</div><div className="font-medium">{slip.insuredName}</div></div>
                  </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><DollarSign size={16}/> Values</h4>
                  <div className="space-y-3 text-sm">
                      <div><div className="text-gray-500 text-xs uppercase">Limit of Liability</div><div className="font-mono font-bold text-lg">{formatMoney(slip.limitOfLiability, slip.currency as string)}</div></div>
                      <div><div className="text-gray-500 text-xs uppercase">Broker / Reinsurer</div><div className="font-medium">{slip.brokerReinsurer}</div></div>
                  </div>
              </div>
          </div>

          {reinsurers.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-3 text-sm">Market Panel</h4>
                  <table className="w-full text-sm text-left">
                      <thead>
                          <tr className="text-gray-500 border-b border-gray-200">
                              <th className="pb-2">Reinsurer</th>
                              <th className="pb-2 text-right">Share %</th>
                              <th className="pb-2 text-right">Comm %</th>
                          </tr>
                      </thead>
                      <tbody>
                          {reinsurers.map((r: any, i: number) => (
                              <tr key={i} className="border-b border-gray-100 last:border-0">
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
        <div className="p-4 text-red-600">
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
                  <h3 className="text-xl font-bold text-gray-800">{clause.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold mt-1 inline-block ${
                      clause.category === 'Exclusion' ? 'bg-red-100 text-red-700' : 
                      clause.category === 'Warranty' ? 'bg-amber-100 text-amber-700' : 
                      'bg-blue-100 text-blue-700'
                  }`}>{clause.category}</span>
              </div>
              {clause.isStandard && <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">Standard</span>}
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 font-serif text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10">
           <h3 className="font-bold text-gray-800 text-lg">{title || 'Details'}</h3>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"><X size={20}/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
            {isPolicy(item) && renderPolicyDetail(item)}
            {isSlip(item) && renderSlipDetail(item)}
            {isClause(item) && renderClauseDetail(item)}
            {!isPolicy(item) && !isSlip(item) && !isClause(item) && (
              <div className="p-4">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(item, null, 2)}
                </pre>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end">
            <button onClick={onClose} className="px-5 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-800 font-bold text-sm transition-colors">Close</button>
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
    </div>
  );
};
