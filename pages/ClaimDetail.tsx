import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ClaimTransactionType } from '../types';
import { useClaimDetail, useAddTransaction } from '../hooks/useClaims';
import { formatDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ArrowLeft, FileText, Plus, Wallet, Loader2, CheckCircle, XCircle, RefreshCw, Settings } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useTheme } from '../theme/useTheme';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const ClaimDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTheme();
  const [statusConfirm, setStatusConfirm] = useState<{ isOpen: boolean; status: string; message: string }>({ isOpen: false, status: '', message: '' });
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // React Query Hooks
  const { data: claim, isLoading: loading, error, refetch } = useClaimDetail(id);
  const addTransactionMutation = useAddTransaction();

  // Transaction Form State
  const [showTransModal, setShowTransModal] = useState(false);
  const [newTrans, setNewTrans] = useState({
      type: 'RESERVE_SET' as ClaimTransactionType,
      amount: 0,
      share: 100,
      notes: ''
  });

  const requestStatusChange = (newStatus: string) => {
    if (!supabase || !claim) return;

    const confirmMessage = newStatus === 'CLOSED'
        ? 'Are you sure you want to close this claim?'
        : newStatus === 'DENIED'
        ? 'Are you sure you want to deny this claim?'
        : 'Are you sure you want to reopen this claim?';

    setStatusConfirm({ isOpen: true, status: newStatus, message: confirmMessage });
  };

  const performStatusChange = async (newStatus: string) => {
    if (!supabase || !claim) return;

    try {
        const updateData: any = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        // Set or clear closed_date based on status
        if (newStatus === 'CLOSED' || newStatus === 'DENIED') {
            updateData.closed_date = new Date().toISOString().split('T')[0];
        } else if (newStatus === 'REOPENED') {
            updateData.closed_date = null;
        }

        const { error } = await supabase
            .from('claims')
            .update(updateData)
            .eq('id', claim.id);

        if (error) throw error;

        // SUCCESS - Now refresh the UI
        toast.success(`Claim ${newStatus.toLowerCase()} successfully`);

        // Force page reload to show updated data
        window.location.reload();

    } catch (error: any) {
        console.error('Error updating claim status:', error);
        toast.error('Failed to update claim: ' + (error.message || 'Unknown error'));
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    requestStatusChange(newStatus);
  };

  const handleAddTransaction = () => {
      if (!claim || !id) return;

      addTransactionMutation.mutate({
          claimId: id,
          transactionType: newTrans.type,
          amount100pct: newTrans.amount,
          ourSharePercentage: newTrans.share,
          currency: claim.policyContext?.currency || 'USD',
          notes: newTrans.notes,
          transactionDate: new Date().toISOString()
      }, {
          onSuccess: () => {
              setShowTransModal(false);
              // Reset form
              setNewTrans(prev => ({ ...prev, amount: 0, notes: '' }));
          },
          onError: (err) => {
              toast.error("Error adding transaction: " + err.message);
          }
      });
  };

  // Status badge style helper
  const getStatusBadgeStyle = (status: string, liabilityType?: string) => {
    if (status === 'CLOSED') return { backgroundColor: t.successBg, color: t.success };
    if (status === 'DENIED') return { backgroundColor: t.dangerBg, color: t.danger };
    if (liabilityType === 'ACTIVE') return { backgroundColor: t.accentMuted, color: t.accent };
    return { backgroundColor: t.bgInput, color: t.text2 };
  };

  // Transaction type badge style helper
  const getTransBadgeStyle = (type: string) => {
    if (['PAYMENT', 'LEGAL_FEE', 'ADJUSTER_FEE'].includes(type)) return { backgroundColor: t.successBg, color: t.success };
    if (['RESERVE_SET', 'RESERVE_ADJUST'].includes(type)) return { backgroundColor: t.accentMuted, color: t.accent };
    return { backgroundColor: t.bgInput, color: t.text1 };
  };

  if (loading) return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <Loader2 className="animate-spin" size={32} style={{ color: t.accent }} />
      </div>
  );

  if (error || !claim) return (
      <div style={{ padding: 32, textAlign: 'center', color: t.danger }}>
          Error loading claim details. <button onClick={() => window.location.reload()} style={{ textDecoration: 'underline' }}>Retry</button>
      </div>
  );

  const policy = claim.policyContext || { policyNumber: 'N/A', insuredName: 'N/A', currency: 'USD' };

  // Strict Financial Calculations based on transaction history
  const transactions = claim.transactions || [];

  // Incurred: RESERVE_SET, RESERVE_ADJUST, IMPORT_BALANCE
  const totalIncurredTransactions = transactions.filter(t =>
      ['RESERVE_SET', 'RESERVE_ADJUST', 'IMPORT_BALANCE'].includes(t.transactionType)
  );
  const totalIncurred = totalIncurredTransactions.reduce((acc, t) => acc + t.amount100pct, 0);
  const totalIncurredOurShare = totalIncurredTransactions.reduce((acc, t) => acc + t.amountOurShare, 0);

  // Paid: PAYMENT, LEGAL_FEE, ADJUSTER_FEE
  const totalPaidTransactions = transactions.filter(t =>
      ['PAYMENT', 'LEGAL_FEE', 'ADJUSTER_FEE'].includes(t.transactionType)
  );
  const totalPaid = totalPaidTransactions.reduce((acc, t) => acc + t.amount100pct, 0);
  const totalPaidOurShare = totalPaidTransactions.reduce((acc, t) => acc + t.amountOurShare, 0);

  // Recoveries
  const totalRecoveryTransactions = transactions.filter(t => t.transactionType === 'RECOVERY');
  const totalRecovery = totalRecoveryTransactions.reduce((acc, t) => acc + t.amount100pct, 0);
  const totalRecoveryOurShare = totalRecoveryTransactions.reduce((acc, t) => acc + t.amountOurShare, 0);

  // Outstanding Calculation: Incurred - Paid + Recoveries
  const outstanding = totalIncurred - totalPaid + totalRecovery;
  const outstandingOurShare = totalIncurredOurShare - totalPaidOurShare + totalRecoveryOurShare;

  // Format Helper
  const formatMoney = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 80 }}>
       {/* Header */}
       <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
           <Button variant="ghost" onClick={() => navigate('/claims')} style={{ padding: 8 }}>
             <ArrowLeft size={20}/>
           </Button>
           <div>
               <h2 style={{ display: 'flex', alignItems: 'center', gap: 12, color: t.text1, fontSize: 24, fontWeight: 700 }}>
                   {claim.claimNumber}
                   <span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: 14, borderRadius: 9999, ...getStatusBadgeStyle(claim.status, claim.liabilityType) }}>
                       {claim.status === 'OPEN' ? (claim.liabilityType === 'ACTIVE' ? 'ACTIVE' : 'INFO') : claim.status}
                   </span>
               </h2>
               <p style={{ color: t.text4 }}>Policy: <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: t.accent }}>{policy.policyNumber}</span> • {policy.insuredName}</p>
           </div>
       </div>

       {/* Claim Actions Section */}
       <div style={{ borderRadius: 8, padding: 16, backgroundColor: t.bgInput, border: `1px solid ${t.border}` }}>
            <h3 style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, textTransform: 'uppercase', color: t.text1 }}>
                <Settings size={16} />
                Workflow Actions
            </h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {claim.status === 'OPEN' && (
                    <>
                        <Button variant="primary" icon={<CheckCircle size={16} />} onClick={() => handleStatusChange('CLOSED')} style={{ background: t.success }}>
                            Close Claim
                        </Button>
                        <Button variant="primary" icon={<XCircle size={16} />} onClick={() => handleStatusChange('DENIED')} style={{ background: t.danger }}>
                            Deny Claim
                        </Button>
                    </>
                )}

                {(claim.status === 'CLOSED' || claim.status === 'DENIED') && (
                    <Button variant="primary" icon={<RefreshCw size={16} />} onClick={() => handleStatusChange('REOPENED')} style={{ background: t.warning }}>
                        Reopen Claim
                    </Button>
                )}

                {claim.status === 'REOPENED' && (
                    <>
                        <Button variant="primary" icon={<CheckCircle size={16} />} onClick={() => handleStatusChange('CLOSED')} style={{ background: t.success }}>
                            Close Claim
                        </Button>
                        <Button variant="primary" icon={<XCircle size={16} />} onClick={() => handleStatusChange('DENIED')} style={{ background: t.danger }}>
                            Deny Claim
                        </Button>
                    </>
                )}
            </div>
       </div>

       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
           {/* Left: Metadata */}
           <div style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ padding: 24, borderRadius: 12, backgroundColor: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: t.text1 }}><FileText size={18}/> Claim Details</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                        <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Status</div><div style={{ fontWeight: 500 }}>{claim.status}</div></div>
                        <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Loss Date</div><div style={{ fontWeight: 500 }}>{formatDate(claim.lossDate)}</div></div>
                        <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Report Date</div><div style={{ fontWeight: 500 }}>{formatDate(claim.reportDate)}</div></div>
                        {claim.closedDate && <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Closed Date</div><div style={{ fontWeight: 500 }}>{formatDate(claim.closedDate)}</div></div>}
                        <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Description</div><div style={{ fontWeight: 500 }}>{claim.description || '-'}</div></div>
                        <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Claimant</div><div style={{ fontWeight: 500 }}>{claim.claimantName || '-'}</div></div>
                        <div><div style={{ fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Country</div><div style={{ fontWeight: 500 }}>{claim.locationCountry || '-'}</div></div>
                    </div>
                </div>

                {claim.liabilityType === 'INFORMATIONAL' && (
                    <div style={{ padding: 24, borderRadius: 12, backgroundColor: t.warningBg, border: `1px solid ${t.warning}`, color: t.warning }}>
                        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Informational Only</h3>
                        <p style={{ fontSize: 14, marginBottom: 8 }}>This claim is tracked for record-keeping. Financials are imported in bulk.</p>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700 }}>{formatMoney(claim.importedTotalIncurred || 0)} {policy.currency}</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>Imported Incurred Estimate</div>
                    </div>
                )}
           </div>

           {/* Right: Ledger */}
           <div style={{ gridColumn: 'span 2' }}>
               <div style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                   <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.bgInput, borderBottom: `1px solid ${t.border}` }}>
                       <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: t.text1 }}><Wallet size={18}/> Financial Ledger</h3>
                       {claim.liabilityType === 'ACTIVE' && claim.status !== 'CLOSED' && claim.status !== 'DENIED' && (
                           <Button variant="primary" size="sm" icon={<Plus size={16}/>} onClick={() => setShowTransModal(true)}>
                               Add Transaction
                           </Button>
                       )}
                   </div>

                   {claim.liabilityType === 'ACTIVE' && (
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: 16, textAlign: 'center', backgroundColor: t.accentMuted, borderBottom: `1px solid ${t.border}` }}>
                           <div>
                               <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: t.accent }}>Incurred (Our Share)</div>
                               <div style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{formatMoney(totalIncurredOurShare)} {policy.currency}</div>
                           </div>
                           <div>
                               <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: t.success }}>Paid (Our Share)</div>
                               <div style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{formatMoney(totalPaidOurShare)} {policy.currency}</div>
                           </div>
                           <div>
                               <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: t.danger }}>Outstanding (Our Share)</div>
                               <div style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{formatMoney(outstandingOurShare)} {policy.currency}</div>
                           </div>
                       </div>
                   )}

                   <div style={{ overflowX: 'auto' }}>
                       <table style={{ width: '100%', textAlign: 'left', fontSize: 14, whiteSpace: 'nowrap' }}>
                           <thead style={{ fontWeight: 600, backgroundColor: t.bgInput, color: t.text1, borderBottom: `1px solid ${t.border}` }}>
                               <tr>
                                   <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}>Date</th>
                                   <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}>Type</th>
                                   <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>Amount (100%)</th>
                                   <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>Our Share</th>
                                   <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}>Notes</th>
                               </tr>
                           </thead>
                           <tbody>
                               {transactions.map(tx => (
                                   <tr
                                     key={tx.id}
                                     style={{ backgroundColor: hoveredRow === tx.id ? t.bgInput : 'transparent', borderBottom: `1px solid ${t.borderL}` }}
                                     onMouseEnter={() => setHoveredRow(tx.id)}
                                     onMouseLeave={() => setHoveredRow(null)}
                                   >
                                       <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, color: t.text4 }}>{formatDate(tx.transactionDate)}</td>
                                       <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}>
                                           <span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4, fontSize: 12, fontWeight: 700, ...getTransBadgeStyle(tx.transactionType) }}>
                                               {tx.transactionType}
                                           </span>
                                       </td>
                                       <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(tx.amount100pct)}</td>
                                       <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: t.text2 }}>{formatMoney(tx.amountOurShare)}</td>
                                       <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200, color: t.text4 }}>{tx.notes}</td>
                                   </tr>
                               ))}
                               {transactions.length === 0 && (
                                   <tr>
                                       <td colSpan={5} style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center', fontStyle: 'italic', color: t.text5 }}>No transactions recorded.</td>
                                   </tr>
                               )}
                           </tbody>
                       </table>
                   </div>
               </div>
           </div>
       </div>

       {/* Add Transaction Modal */}
       {showTransModal && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.5)' }}>
               <div className="animate-in fade-in zoom-in" style={{ borderRadius: 12, width: '100%', maxWidth: 448, padding: 24, backgroundColor: t.bgPanel, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                   <h3 style={{ marginBottom: 16, color: t.text1, fontSize: 15, fontWeight: 700 }}>Add Financial Transaction</h3>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                       <div>
                           <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 4, color: t.text1 }}>Type</label>
                           <select
                                style={{ width: '100%', padding: 8, borderRadius: 4, border: `1px solid ${t.border}`, backgroundColor: t.bgInput, color: t.text1 }}
                                value={newTrans.type}
                                onChange={e => setNewTrans({...newTrans, type: e.target.value as ClaimTransactionType})}
                           >
                               <option value="RESERVE_SET">Set Reserve (Incurred)</option>
                               <option value="RESERVE_ADJUST">Adjust Reserve (+/-)</option>
                               <option value="PAYMENT">Indemnity Payment</option>
                               <option value="LEGAL_FEE">Legal Fee Payment</option>
                               <option value="ADJUSTER_FEE">Adjuster Fee Payment</option>
                               <option value="RECOVERY">Recovery / Subrogation</option>
                           </select>
                       </div>
                       <div>
                           <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 4, color: t.text1 }}>Amount (100% Gross)</label>
                           <Input
                                type="number"
                                value={newTrans.amount}
                                onChange={(val) => setNewTrans({...newTrans, amount: Number(val)})}
                           />
                       </div>
                       <div>
                           <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 4, color: t.text1 }}>Our Share %</label>
                           <Input
                                type="number"
                                value={newTrans.share}
                                onChange={(val) => setNewTrans({...newTrans, share: Number(val)})}
                           />
                       </div>
                       <div>
                           <label style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 4, color: t.text1 }}>Notes</label>
                           <textarea
                                style={{ width: '100%', padding: 8, borderRadius: 4, border: `1px solid ${t.border}`, backgroundColor: t.bgInput, color: t.text1 }}
                                value={newTrans.notes}
                                onChange={e => setNewTrans({...newTrans, notes: e.target.value})}
                           />
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16 }}>
                           <Button variant="ghost" onClick={() => setShowTransModal(false)} disabled={addTransactionMutation.isPending}>
                               Cancel
                           </Button>
                           <Button variant="primary" onClick={handleAddTransaction} disabled={addTransactionMutation.isPending} icon={addTransactionMutation.isPending ? <Loader2 className="animate-spin" size={16}/> : undefined}>
                               Save
                           </Button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       <ConfirmDialog
         isOpen={statusConfirm.isOpen}
         title="Confirm Status Change"
         message={statusConfirm.message}
         onConfirm={() => { setStatusConfirm({ isOpen: false, status: '', message: '' }); performStatusChange(statusConfirm.status); }}
         onCancel={() => setStatusConfirm({ isOpen: false, status: '', message: '' })}
         variant="warning"
         confirmText="Confirm"
       />
    </div>
  );
};

export default ClaimDetail;
