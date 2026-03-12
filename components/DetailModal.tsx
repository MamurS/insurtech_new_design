
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
        <span style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 14, background: s.background, color: s.color, fontWeight: 500 }}>
            {status || 'DRAFT'}
        </span>
    );
  };

  const renderTerminationModal = () => (
      <div className="animate-in fade-in zoom-in backdrop-blur-sm" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16, animationDuration: '200ms' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ borderRadius: 12, width: '100%', maxWidth: 448, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowLg, border: `1px solid ${t.border}` }}>
              <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, background: t.warningBg, borderBottom: `1px solid ${t.warning}40` }}>
                  <div style={{ padding: 8, borderRadius: 9999, background: t.warningBg, color: t.warning }}><AlertTriangle size={20}/></div>
                  <h3 style={{ color: t.text1, fontWeight: 700 }}>Early Policy Termination</h3>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                      <DatePickerInput label="Termination Date" value={parseDate(terminationData.terminationDate)} onChange={(date) => setTerminationData({...terminationData, terminationDate: toISODateString(date) || ''})}/>
                  </div>
                  <div>
                      <label style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', marginBottom: 4, color: t.text4, fontWeight: 700 }}>Initiated By</label>
                      <select value={terminationData.initiator} onChange={(e) => setTerminationData({...terminationData, initiator: e.target.value as any})} style={{ width: '100%', padding: 8, borderRadius: 8, fontSize: 14, background: t.bgPanel, borderColor: t.border, border: `1px solid ${t.border}`, color: t.text1 }}>
                          <option value="Us">Us (Insurer)</option>
                          <option value="Broker">Broker</option>
                          <option value="Cedant">Cedant / Client</option>
                          <option value="Other">Other</option>
                      </select>
                  </div>
                  <div>
                      <label style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', marginBottom: 4, color: t.text4, fontWeight: 700 }}>Reason for Termination</label>
                      <textarea rows={3} value={terminationData.reason} onChange={(e) => setTerminationData({...terminationData, reason: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 8, fontSize: 14, resize: 'none', background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text1 }}/>
                  </div>
              </div>
              <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, background: t.bgCard, borderTop: `1px solid ${t.border}` }}>
                  <button onClick={() => setShowTerminationConfirm(false)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, color: t.text3, fontWeight: 500 }}>Cancel</button>
                  <button onClick={() => handleStatusChange(PolicyStatus.EARLY_TERMINATION, item as Policy, terminationData)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, background: t.danger, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}>Terminate Policy</button>
              </div>
          </div>
      </div>
  );

  const renderNTUModal = () => (
      <div className="animate-in fade-in zoom-in backdrop-blur-sm" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16, animationDuration: '200ms' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ borderRadius: 12, width: '100%', maxWidth: 448, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowLg, border: `1px solid ${t.border}` }}>
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, background: t.bgCard, borderBottom: `1px solid ${t.border}` }}>
                <div style={{ padding: 8, borderRadius: 9999, background: t.bgHover, color: t.text3 }}><XCircle size={20}/></div>
                <h3 style={{ color: t.text1, fontWeight: 700 }}>Confirm "Not Taken Up"</h3>
            </div>
            <div style={{ padding: 24 }}>
                <p style={{ fontSize: 14, color: t.text3 }}>This means the deal was cancelled by the client/broker before inception.</p>
            </div>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, background: t.bgCard, borderTop: `1px solid ${t.border}` }}>
                <button type="button" onClick={() => setShowNTUConfirm(false)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, color: t.text3, fontWeight: 500 }}>Go Back</button>
                <button type="button" onClick={() => { setShowNTUConfirm(false); handleStatusChange(PolicyStatus.NTU, item as Policy); }} disabled={isProcessing} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, background: t.text2, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}>Confirm NTU</button>
            </div>
        </div>
    </div>
  );

  const renderActivateModal = () => (
    <div className="animate-in fade-in zoom-in backdrop-blur-sm" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16, animationDuration: '200ms' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ borderRadius: 12, width: '100%', maxWidth: 448, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowLg, border: `1px solid ${t.border}` }}>
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, background: t.successBg, borderBottom: `1px solid ${t.success}40` }}>
                <div style={{ padding: 8, borderRadius: 9999, background: t.success + '18', color: t.success }}><CheckCircle size={20}/></div>
                <h3 style={{ color: t.text1, fontWeight: 700 }}>Bind & Activate Policy</h3>
            </div>
            <div style={{ padding: 24 }}>
                {!uploadFile && !(item as Policy)?.signedDocument ? (
                    <div style={{ borderRadius: 8, padding: 12, marginBottom: 16, background: t.warningBg, border: `1px solid ${t.warning}40` }}>
                        <p style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: t.warning, fontWeight: 500 }}><AlertCircle size={16} /> No signed document uploaded</p>
                    </div>
                ) : (
                    <div style={{ borderRadius: 8, padding: 12, marginBottom: 16, background: t.successBg, border: `1px solid ${t.success}40` }}>
                        <p style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: t.success, fontWeight: 500 }}><CheckCircle size={16} /> {uploadFile ? `Document ready: ${uploadFile.name}` : 'Signed document on file'}</p>
                    </div>
                )}
                <p style={{ fontSize: 14, color: t.text3 }}>This will bind the risk and mark the policy as <strong>Active</strong>.</p>
            </div>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, background: t.bgCard, borderTop: `1px solid ${t.border}` }}>
                <button type="button" onClick={() => setShowActivateConfirm(false)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, color: t.text3, fontWeight: 500 }}>Go Back</button>
                <button type="button" onClick={() => { setShowActivateConfirm(false); handleStatusChange(PolicyStatus.ACTIVE, item as Policy); }} disabled={isProcessing} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, background: t.success, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}>Activate Policy</button>
            </div>
        </div>
    </div>
  );

  const renderPolicyDetail = (policy: Policy) => {
    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
        {/* Header Badge */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 14, fontWeight: 700, ...(policy.channel === 'Direct' ? { background: t.accent + '18', color: t.accent } : { background: '#a855f718', color: '#a855f7' }) }}>{policy.channel} Insurance</span>
                <span style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 14, background: t.bgCard, color: t.text2, fontWeight: 700 }}>{policy.status}</span>
                {policy.isDeleted && <span className="animate-pulse" style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 14, background: t.danger, color: '#fff', fontWeight: 700 }}>DELETED</span>}
            </div>
        </div>

        {/* WORKFLOW ACTIONS */}
        {policy.status === PolicyStatus.PENDING && (
            <div style={{ borderRadius: 12, padding: 20, marginBottom: 24, background: t.warningBg, border: `1px solid ${t.warning}40`, boxShadow: t.shadow }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: t.warning, fontWeight: 700 }}><AlertCircle size={18} /> Underwriting Workflow</h4>
                <div style={{ padding: 16, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, background: t.bgPanel, border: `1px solid ${t.warning}40` }}>
                    <label style={{ cursor: 'pointer', paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, background: t.bgCard, color: t.text2, fontWeight: 500 }}><Upload size={16} /> {uploadFile ? uploadFile.name : "Choose PDF..."}<input type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <button onClick={() => setShowNTUConfirm(true)} style={{ width: '100%', paddingTop: 10, paddingBottom: 10, borderRadius: 8, fontSize: 14, background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text2, fontWeight: 700 }}>Mark as NTU</button>
                    <button onClick={() => setShowActivateConfirm(true)} style={{ width: '100%', paddingTop: 10, paddingBottom: 10, borderRadius: 8, fontSize: 14, background: t.success, color: '#fff', fontWeight: 700 }}>Bind & Activate</button>
                </div>
            </div>
        )}

        {/* EARLY TERMINATION BUTTON */}
        {policy.status === PolicyStatus.ACTIVE && (
            <div style={{ borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 20, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                <div style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: t.text3 }}><CheckCircle style={{ color: t.success }} size={18} /><span style={{ color: t.text1, fontWeight: 700 }}>Policy is Active.</span></div>
                <button onClick={() => setShowTerminationConfirm(true)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, background: t.bgPanel, border: `1px solid ${t.warning}40`, color: t.warning, fontWeight: 700 }}><XCircle size={16} /> Early Termination</button>
            </div>
        )}

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h4 style={{ paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8, color: t.text1, borderBottom: `1px solid ${t.border}`, fontWeight: 700 }}><Building2 size={16}/> Core Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: 14 }}>
                    <div><div style={{ color: t.text4 }}>Insured Name</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.insuredName}</div></div>
                    <div><div style={{ color: t.text4 }}>Ref / Policy No</div><div style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 500 }}>{policy.policyNumber}</div></div>
                    {policy.secondaryPolicyNumber && <div><div style={{ color: t.text4 }}>Secondary Ref</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.secondaryPolicyNumber}</div></div>}
                    {policy.agreementNumber && <div><div style={{ color: t.text4 }}>Agreement No</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.agreementNumber}</div></div>}

                    {policy.channel === 'Inward' && <div style={{ gridColumn: 'span 2', padding: 8, borderRadius: 4, background: '#a855f718', border: '1px solid #a855f720' }}><div style={{ fontSize: 12, textTransform: 'uppercase', color: '#a855f7', fontWeight: 700 }}>Cedant</div><div style={{ color: '#a855f7', fontWeight: 500 }}>{policy.cedantName || '-'}</div></div>}
                    <div style={{ gridColumn: 'span 2', padding: 8, borderRadius: 4, background: t.bgCard, border: `1px solid ${t.border}` }}><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Intermediary ({policy.intermediaryType})</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.intermediaryName || 'Direct'}</div></div>

                    {policy.borrower && <div><div style={{ color: t.text4 }}>Borrower</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.borrower}</div></div>}
                    {policy.insuredAddress && <div style={{ gridColumn: 'span 2' }}><div style={{ color: t.text4 }}>Insured Address</div><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text1, fontWeight: 500 }}>{policy.insuredAddress}</div></div>}

                     <div><div style={{ color: t.text4 }}>Industry</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.industry || '-'}</div></div>
                     <div><div style={{ color: t.text4 }}>Territory</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.territory}</div></div>
                     <div><div style={{ color: t.text4 }}>Class</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.classOfInsurance}</div></div>
                     <div><div style={{ color: t.text4 }}>Risk Code</div><div style={{ color: t.text1, fontWeight: 500 }}>{policy.riskCode || '-'}</div></div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 <h4 style={{ paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8, color: t.text1, borderBottom: `1px solid ${t.border}`, fontWeight: 700 }}><Calendar size={16}/> Dates & Terms</h4>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: 14 }}>
                    <div><div style={{ color: t.text4 }}>Inception</div><div style={{ color: t.text1, fontWeight: 500 }}>{formatDate(policy.inceptionDate)}</div></div>
                    <div><div style={{ color: t.text4 }}>Expiry</div><div style={{ color: t.text1, fontWeight: 500 }}>{formatDate(policy.expiryDate)}</div></div>

                    {policy.dateOfSlip && <div><div style={{ color: t.text4 }}>Date of Slip</div><div style={{ color: t.text1, fontWeight: 500 }}>{formatDate(policy.dateOfSlip)}</div></div>}
                    {policy.accountingDate && <div><div style={{ color: t.text4 }}>Accounting Date</div><div style={{ color: t.text1, fontWeight: 500 }}>{formatDate(policy.accountingDate)}</div></div>}

                    <div style={{ gridColumn: 'span 2' }}><div style={{ color: t.text4 }}>Deductible</div><div style={{ padding: 8, borderRadius: 4, fontSize: 12, color: t.text1, background: t.bgCard, fontWeight: 500 }}>{policy.deductible || 'N/A'}</div></div>
                 </div>
            </div>
        </div>

        {/* Financials */}
        <div style={{ padding: 24, borderRadius: 12, background: t.bgCard, border: `1px solid ${t.border}` }}>
             <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: t.text1, fontWeight: 700 }}><DollarSign size={16}/> Financials ({policy.currency})</h4>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, fontSize: 14 }}>
                 <div><div style={{ color: t.text4 }}>Sum Insured</div><div style={{ color: t.text1, fontWeight: 700, fontSize: 15 }}>{formatMoney(policy.sumInsured, policy.currency)}</div></div>
                 <div><div style={{ color: t.text4 }}>Limit of Liability</div><div style={{ color: t.text1, fontWeight: 500 }}>{formatMoney(policy.limitForeignCurrency, policy.currency)}</div></div>
                 <div><div style={{ color: t.text4 }}>Gross Premium</div><div style={{ color: t.success, fontWeight: 700, fontSize: 15 }}>{formatMoney(policy.grossPremium, policy.currency)}</div></div>
                 <div><div style={{ color: t.text4 }}>Net Premium</div><div style={{ color: t.accent, fontWeight: 700, fontSize: 15 }}>{formatMoney(policy.netPremium, policy.currency)}</div></div>
             </div>
             {policy.hasOutwardReinsurance && (
                 <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
                     <h5 style={{ fontSize: 12, textTransform: 'uppercase', marginBottom: 8, color: t.warning, fontWeight: 700 }}>Outward Reinsurance</h5>
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: 14 }}>
                         <div><div style={{ color: t.text4 }}>Market</div><div style={{ fontWeight: 500 }}>{policy.reinsurers && policy.reinsurers.length > 0 ? 'Panel Placement' : policy.reinsurerName || '-'}</div></div>
                         <div><div style={{ color: t.text4 }}>Ceded Share</div><div style={{ fontWeight: 500 }}>{policy.cededShare}%</div></div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <span style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 14, background: t.warning + '18', color: t.warning, fontWeight: 700 }}>Reinsurance Slip</span>
              {getSlipStatusBadge(currentStatus)}
          </div>

          {/* Slip Workflow Actions */}
          <div style={{ borderRadius: 8, padding: 16, marginBottom: 16, background: t.bgCard, border: `1px solid ${t.border}` }}>
            <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text1, fontWeight: 700 }}>
                <Settings size={14} />
                Workflow Actions
            </h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {/* DRAFT status */}
                {(!slip.status || currentStatus === 'DRAFT') && (
                    <button
                        onClick={() => requestSlipStatusChange('PENDING')}
                        style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, background: t.accent, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
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
                            style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, background: t.accent, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
                        >
                            <FileText size={16} />
                            Quote Received
                        </button>
                        <button
                            onClick={() => handleSlipDecline()}
                            style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, background: t.danger, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
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
                            style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, background: t.success, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
                        >
                            <CheckCircle size={16} />
                            Accept & Sign
                        </button>
                        <button
                            onClick={() => requestSlipStatusChange('NTU')}
                            style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, background: t.warning, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
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
                        style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, background: t.accent, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
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
                            style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, background: t.success, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
                        >
                            <CheckCircle size={16} />
                            Confirm Bound
                        </button>
                        <button
                            onClick={() => requestSlipStatusChange('NTU')}
                            style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, background: t.warning, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
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
                        style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, background: t.text3, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
                    >
                        <Archive size={16} />
                        Close Slip
                    </button>
                )}

                {/* DECLINED, NTU, CANCELLED status */}
                {['DECLINED', 'NTU', 'CANCELLED'].includes(currentStatus) && (
                    <button
                        onClick={() => requestSlipStatusChange('PENDING')}
                        style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, background: t.warning, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
                    >
                        <RefreshCw size={16} />
                        Reopen
                    </button>
                )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
              <div style={{ padding: 16, borderRadius: 12, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                  <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: t.text1, fontWeight: 700 }}><FileText size={16}/> Slip Details</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                      <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Slip Number</div><div style={{ fontFamily: "'JetBrains Mono', monospace", color: t.accent, fontWeight: 700, fontSize: 15 }}>{slip.slipNumber}</div></div>
                      <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Date</div><div style={{ fontWeight: 500 }}>{formatDate(slip.date)}</div></div>
                      <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Insured Name</div><div style={{ fontWeight: 500 }}>{slip.insuredName}</div></div>
                  </div>
              </div>
              <div style={{ padding: 16, borderRadius: 12, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                  <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: t.text1, fontWeight: 700 }}><DollarSign size={16}/> Values</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                      <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Limit of Liability</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15 }}>{formatMoney(slip.limitOfLiability, slip.currency as string)}</div></div>
                      <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Broker / Reinsurer</div><div style={{ fontWeight: 500 }}>{slip.brokerReinsurer}</div></div>
                  </div>
              </div>
          </div>

          {reinsurers.length > 0 && (
              <div style={{ padding: 16, borderRadius: 12, background: t.bgCard, border: `1px solid ${t.border}` }}>
                  <h4 style={{ marginBottom: 12, fontSize: 14, color: t.text1, fontWeight: 700 }}>Market Panel</h4>
                  <table style={{ width: '100%', fontSize: 14, textAlign: 'left' }}>
                      <thead>
                          <tr style={{ color: t.text4, borderBottom: `1px solid ${t.border}` }}>
                              <th style={{ paddingBottom: 8 }}>Reinsurer</th>
                              <th style={{ paddingBottom: 8, textAlign: 'right' }}>Share %</th>
                              <th style={{ paddingBottom: 8, textAlign: 'right' }}>Comm %</th>
                          </tr>
                      </thead>
                      <tbody>
                          {reinsurers.map((r: any, i: number) => (
                              <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                                  <td style={{ paddingTop: 8, paddingBottom: 8, fontWeight: 500 }}>{r.name}</td>
                                  <td style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'right' }}>{r.share}%</td>
                                  <td style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'right' }}>{r.commission}%</td>
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
        <div style={{ padding: 16, color: t.danger }}>
          <p>Error displaying slip details. Please try again.</p>
          <pre style={{ fontSize: 12, marginTop: 8 }}>{String(error)}</pre>
        </div>
      );
    }
  };

  const renderClauseDetail = (clause: Clause) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                  <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{clause.title}</h3>
                  <span style={{
                      fontSize: 12, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4, textTransform: 'uppercase', marginTop: 4, display: 'inline-block',
                      ...(clause.category === 'Exclusion' ? { background: t.danger + '18', color: t.danger, fontWeight: 700 } :
                      clause.category === 'Warranty' ? { background: t.warning + '18', color: t.warning, fontWeight: 700 } :
                      { background: t.accent + '18', color: t.accent, fontWeight: 700 })
                  }}>{clause.category}</span>
              </div>
              {clause.isStandard && <span style={{ fontSize: 12, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4, background: t.success + '18', color: t.success, fontWeight: 700 }}>Standard</span>}
          </div>
          <div style={{ padding: 16, borderRadius: 12, fontFamily: 'serif', fontSize: 14, lineHeight: 1.625, whiteSpace: 'pre-wrap', background: t.bgCard, border: `1px solid ${t.border}`, color: t.text1 }}>
              {clause.content}
          </div>
      </div>
  );

  // Type Guards
  const isPolicy = (i: any): i is Policy => 'policyNumber' in i;
  const isSlip = (i: any): i is ReinsuranceSlip => 'slipNumber' in i && !('policyNumber' in i);
  const isClause = (i: any): i is Clause => 'title' in i && 'content' in i;

  return (
    <div className="backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }} onClick={onClose}>
      <div className="animate-in fade-in zoom-in" style={{ borderRadius: 12, width: '100%', maxWidth: 896, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowLg, animationDuration: '200ms' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10, background: t.bgPanel, borderBottom: `1px solid ${t.border}` }}>
           <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{title || 'Details'}</h3>
           <button onClick={onClose} className="transition-colors" style={{ padding: 4, borderRadius: 9999, color: t.text4 }}><X size={20}/></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: t.bgPanel }}>
            {isPolicy(item) && renderPolicyDetail(item)}
            {isSlip(item) && renderSlipDetail(item)}
            {isClause(item) && renderClauseDetail(item)}
            {!isPolicy(item) && !isSlip(item) && !isClause(item) && (
              <div style={{ padding: 16 }}>
                <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: t.text3 }}>
                  {JSON.stringify(item, null, 2)}
                </pre>
              </div>
            )}
        </div>

        {/* Footer */}
        <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end', background: t.bgCard, borderTop: `1px solid ${t.border}` }}>
            <button onClick={onClose} className="transition-colors" style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, background: t.bgHover, color: t.text1, fontWeight: 700 }}>Close</button>
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
            <div className="animate-in fade-in zoom-in backdrop-blur-sm" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16, animationDuration: '200ms' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ borderRadius: 12, width: '100%', maxWidth: 448, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowLg, border: `1px solid ${t.border}` }}>
                    <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, background: t.dangerBg, borderBottom: `1px solid ${t.danger}40` }}>
                        <div style={{ padding: 8, borderRadius: 9999, background: t.danger + '18', color: t.danger }}><XCircle size={20}/></div>
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
                                style={{ width: '100%', padding: 8, borderRadius: 8, fontSize: 14, resize: 'none', background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text1 }}
                            />
                        </div>
                    </div>
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, background: t.bgCard, borderTop: `1px solid ${t.border}` }}>
                        <button onClick={() => setShowDeclineModal(false)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, color: t.text3, fontWeight: 500 }}>Cancel</button>
                        <button onClick={confirmSlipDecline} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, background: t.danger, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}>Decline Slip</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
