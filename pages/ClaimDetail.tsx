
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

const ClaimDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTheme();
  const [statusConfirm, setStatusConfirm] = useState<{ isOpen: boolean; status: string; message: string }>({ isOpen: false, status: '', message: '' });
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredBackBtn, setHoveredBackBtn] = useState(false);
  const [hoveredCloseBtn, setHoveredCloseBtn] = useState(false);
  const [hoveredDenyBtn, setHoveredDenyBtn] = useState(false);
  const [hoveredReopenBtn, setHoveredReopenBtn] = useState(false);
  const [hoveredCloseBtn2, setHoveredCloseBtn2] = useState(false);
  const [hoveredDenyBtn2, setHoveredDenyBtn2] = useState(false);
  const [hoveredAddTransBtn, setHoveredAddTransBtn] = useState(false);
  const [hoveredCancelBtn, setHoveredCancelBtn] = useState(false);
  const [hoveredSaveBtn, setHoveredSaveBtn] = useState(false);

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
      <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin" size={32} style={{ color: t.accent }} />
      </div>
  );

  if (error || !claim) return (
      <div className="p-8 text-center" style={{ color: t.danger }}>
          Error loading claim details. <button onClick={() => window.location.reload()} className="underline">Retry</button>
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
    <div className="space-y-6 pb-20">
       {/* Header */}
       <div className="flex items-center gap-4">
           <button
             onClick={() => navigate('/claims')}
             className="p-2 rounded-lg"
             style={{ backgroundColor: hoveredBackBtn ? t.bgInput : t.bgPanel, border: `1px solid ${t.border}` }}
             onMouseEnter={() => setHoveredBackBtn(true)}
             onMouseLeave={() => setHoveredBackBtn(false)}
           >
             <ArrowLeft size={20}/>
           </button>
           <div>
               <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: t.text1 }}>
                   {claim.claimNumber}
                   <span className="px-2 py-1 text-sm rounded-full" style={getStatusBadgeStyle(claim.status, claim.liabilityType)}>
                       {claim.status === 'OPEN' ? (claim.liabilityType === 'ACTIVE' ? 'ACTIVE' : 'INFO') : claim.status}
                   </span>
               </h2>
               <p style={{ color: t.text4 }}>Policy: <span className="font-mono font-bold" style={{ color: t.accent }}>{policy.policyNumber}</span> • {policy.insuredName}</p>
           </div>
       </div>

       {/* Claim Actions Section */}
       <div className="rounded-lg p-4" style={{ backgroundColor: t.bgInput, border: `1px solid ${t.border}` }}>
            <h3 className="font-bold mb-3 flex items-center gap-2 text-sm uppercase" style={{ color: t.text1 }}>
                <Settings size={16} />
                Workflow Actions
            </h3>

            <div className="flex flex-wrap gap-2">
                {claim.status === 'OPEN' && (
                    <>
                        <button
                            onClick={() => handleStatusChange('CLOSED')}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"
                            style={{ backgroundColor: hoveredCloseBtn ? t.success : t.success, opacity: hoveredCloseBtn ? 0.85 : 1, color: '#fff', boxShadow: t.shadow }}
                            onMouseEnter={() => setHoveredCloseBtn(true)}
                            onMouseLeave={() => setHoveredCloseBtn(false)}
                        >
                            <CheckCircle size={16} />
                            Close Claim
                        </button>
                        <button
                            onClick={() => handleStatusChange('DENIED')}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"
                            style={{ backgroundColor: t.danger, opacity: hoveredDenyBtn ? 0.85 : 1, color: '#fff', boxShadow: t.shadow }}
                            onMouseEnter={() => setHoveredDenyBtn(true)}
                            onMouseLeave={() => setHoveredDenyBtn(false)}
                        >
                            <XCircle size={16} />
                            Deny Claim
                        </button>
                    </>
                )}

                {(claim.status === 'CLOSED' || claim.status === 'DENIED') && (
                    <button
                        onClick={() => handleStatusChange('REOPENED')}
                        className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"
                        style={{ backgroundColor: t.warning, opacity: hoveredReopenBtn ? 0.85 : 1, color: '#fff', boxShadow: t.shadow }}
                        onMouseEnter={() => setHoveredReopenBtn(true)}
                        onMouseLeave={() => setHoveredReopenBtn(false)}
                    >
                        <RefreshCw size={16} />
                        Reopen Claim
                    </button>
                )}

                {claim.status === 'REOPENED' && (
                    <>
                        <button
                            onClick={() => handleStatusChange('CLOSED')}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"
                            style={{ backgroundColor: t.success, opacity: hoveredCloseBtn2 ? 0.85 : 1, color: '#fff', boxShadow: t.shadow }}
                            onMouseEnter={() => setHoveredCloseBtn2(true)}
                            onMouseLeave={() => setHoveredCloseBtn2(false)}
                        >
                            <CheckCircle size={16} />
                            Close Claim
                        </button>
                        <button
                            onClick={() => handleStatusChange('DENIED')}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"
                            style={{ backgroundColor: t.danger, opacity: hoveredDenyBtn2 ? 0.85 : 1, color: '#fff', boxShadow: t.shadow }}
                            onMouseEnter={() => setHoveredDenyBtn2(true)}
                            onMouseLeave={() => setHoveredDenyBtn2(false)}
                        >
                            <XCircle size={16} />
                            Deny Claim
                        </button>
                    </>
                )}
            </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Left: Metadata */}
           <div className="md:col-span-1 space-y-6">
                <div className="p-6 rounded-xl" style={{ backgroundColor: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                    <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: t.text1 }}><FileText size={18}/> Claim Details</h3>
                    <div className="space-y-3 text-sm">
                        <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Status</div><div className="font-medium">{claim.status}</div></div>
                        <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Loss Date</div><div className="font-medium">{formatDate(claim.lossDate)}</div></div>
                        <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Report Date</div><div className="font-medium">{formatDate(claim.reportDate)}</div></div>
                        {claim.closedDate && <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Closed Date</div><div className="font-medium">{formatDate(claim.closedDate)}</div></div>}
                        <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Description</div><div className="font-medium">{claim.description || '-'}</div></div>
                        <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Claimant</div><div className="font-medium">{claim.claimantName || '-'}</div></div>
                        <div><div className="text-xs uppercase" style={{ color: t.text4 }}>Country</div><div className="font-medium">{claim.locationCountry || '-'}</div></div>
                    </div>
                </div>

                {claim.liabilityType === 'INFORMATIONAL' && (
                    <div className="p-6 rounded-xl" style={{ backgroundColor: t.warningBg, border: `1px solid ${t.warning}`, color: t.warning }}>
                        <h3 className="font-bold mb-2">Informational Only</h3>
                        <p className="text-sm mb-2">This claim is tracked for record-keeping. Financials are imported in bulk.</p>
                        <div className="font-mono text-xl font-bold">{formatMoney(claim.importedTotalIncurred || 0)} {policy.currency}</div>
                        <div className="text-xs" style={{ opacity: 0.75 }}>Imported Incurred Estimate</div>
                    </div>
                )}
           </div>

           {/* Right: Ledger */}
           <div className="md:col-span-2">
               <div className="rounded-xl overflow-hidden" style={{ backgroundColor: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                   <div className="p-4 flex justify-between items-center" style={{ backgroundColor: t.bgInput, borderBottom: `1px solid ${t.border}` }}>
                       <h3 className="font-bold flex items-center gap-2" style={{ color: t.text1 }}><Wallet size={18}/> Financial Ledger</h3>
                       {claim.liabilityType === 'ACTIVE' && claim.status !== 'CLOSED' && claim.status !== 'DENIED' && (
                           <button
                             onClick={() => setShowTransModal(true)}
                             className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold"
                             style={{ backgroundColor: hoveredAddTransBtn ? t.accent : t.accent, opacity: hoveredAddTransBtn ? 0.85 : 1, color: '#fff', boxShadow: t.shadow }}
                             onMouseEnter={() => setHoveredAddTransBtn(true)}
                             onMouseLeave={() => setHoveredAddTransBtn(false)}
                           >
                               <Plus size={16}/> Add Transaction
                           </button>
                       )}
                   </div>

                   {claim.liabilityType === 'ACTIVE' && (
                       <div className="grid grid-cols-3 p-4 text-center" style={{ backgroundColor: t.accentMuted, borderBottom: `1px solid ${t.border}` }}>
                           <div>
                               <div className="text-xs uppercase font-bold" style={{ color: t.accent }}>Incurred (Our Share)</div>
                               <div className="text-xl font-bold" style={{ color: t.text1 }}>{formatMoney(totalIncurredOurShare)} {policy.currency}</div>
                           </div>
                           <div>
                               <div className="text-xs uppercase font-bold" style={{ color: t.success }}>Paid (Our Share)</div>
                               <div className="text-xl font-bold" style={{ color: t.text1 }}>{formatMoney(totalPaidOurShare)} {policy.currency}</div>
                           </div>
                           <div>
                               <div className="text-xs uppercase font-bold" style={{ color: t.danger }}>Outstanding (Our Share)</div>
                               <div className="text-xl font-bold" style={{ color: t.text1 }}>{formatMoney(outstandingOurShare)} {policy.currency}</div>
                           </div>
                       </div>
                   )}

                   <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm whitespace-nowrap">
                           <thead className="font-semibold" style={{ backgroundColor: t.bgInput, color: t.text1, borderBottom: `1px solid ${t.border}` }}>
                               <tr>
                                   <th className="px-6 py-3">Date</th>
                                   <th className="px-6 py-3">Type</th>
                                   <th className="px-6 py-3 text-right">Amount (100%)</th>
                                   <th className="px-6 py-3 text-right">Our Share</th>
                                   <th className="px-6 py-3">Notes</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y" style={{ borderColor: t.borderL }}>
                               {transactions.map(tx => (
                                   <tr
                                     key={tx.id}
                                     style={{ backgroundColor: hoveredRow === tx.id ? t.bgInput : 'transparent' }}
                                     onMouseEnter={() => setHoveredRow(tx.id)}
                                     onMouseLeave={() => setHoveredRow(null)}
                                   >
                                       <td className="px-6 py-3" style={{ color: t.text4 }}>{formatDate(tx.transactionDate)}</td>
                                       <td className="px-6 py-3">
                                           <span className="px-2 py-0.5 rounded text-xs font-bold" style={getTransBadgeStyle(tx.transactionType)}>
                                               {tx.transactionType}
                                           </span>
                                       </td>
                                       <td className="px-6 py-3 text-right font-mono">{formatMoney(tx.amount100pct)}</td>
                                       <td className="px-6 py-3 text-right font-mono" style={{ color: t.text2 }}>{formatMoney(tx.amountOurShare)}</td>
                                       <td className="px-6 py-3 italic truncate max-w-[200px]" style={{ color: t.text4 }}>{tx.notes}</td>
                                   </tr>
                               ))}
                               {transactions.length === 0 && (
                                   <tr>
                                       <td colSpan={5} className="py-8 text-center italic" style={{ color: t.text5 }}>No transactions recorded.</td>
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
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
               <div className="rounded-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200" style={{ backgroundColor: t.bgPanel, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                   <h3 className="font-bold text-lg mb-4" style={{ color: t.text1 }}>Add Financial Transaction</h3>
                   <div className="space-y-4">
                       <div>
                           <label className="block text-sm font-bold mb-1" style={{ color: t.text1 }}>Type</label>
                           <select
                                className="w-full p-2 rounded"
                                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgInput, color: t.text1 }}
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
                           <label className="block text-sm font-bold mb-1" style={{ color: t.text1 }}>Amount (100% Gross)</label>
                           <input
                                type="number"
                                className="w-full p-2 rounded font-mono"
                                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgInput, color: t.text1 }}
                                value={newTrans.amount}
                                onChange={e => setNewTrans({...newTrans, amount: Number(e.target.value)})}
                           />
                       </div>
                       <div>
                           <label className="block text-sm font-bold mb-1" style={{ color: t.text1 }}>Our Share %</label>
                           <input
                                type="number"
                                className="w-full p-2 rounded"
                                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgInput, color: t.text1 }}
                                value={newTrans.share}
                                onChange={e => setNewTrans({...newTrans, share: Number(e.target.value)})}
                           />
                       </div>
                       <div>
                           <label className="block text-sm font-bold mb-1" style={{ color: t.text1 }}>Notes</label>
                           <textarea
                                className="w-full p-2 rounded"
                                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgInput, color: t.text1 }}
                                value={newTrans.notes}
                                onChange={e => setNewTrans({...newTrans, notes: e.target.value})}
                           />
                       </div>
                       <div className="flex justify-end gap-2 pt-4">
                           <button
                                onClick={() => setShowTransModal(false)}
                                className="px-4 py-2 rounded"
                                style={{ color: t.text2, backgroundColor: hoveredCancelBtn ? t.bgInput : 'transparent' }}
                                onMouseEnter={() => setHoveredCancelBtn(true)}
                                onMouseLeave={() => setHoveredCancelBtn(false)}
                                disabled={addTransactionMutation.isPending}
                            >
                                Cancel
                            </button>
                           <button
                                onClick={handleAddTransaction}
                                disabled={addTransactionMutation.isPending}
                                className="px-4 py-2 font-bold rounded flex items-center gap-2"
                                style={{ backgroundColor: t.accent, opacity: hoveredSaveBtn ? 0.85 : 1, color: '#fff' }}
                                onMouseEnter={() => setHoveredSaveBtn(true)}
                                onMouseLeave={() => setHoveredSaveBtn(false)}
                            >
                                {addTransactionMutation.isPending && <Loader2 className="animate-spin" size={16}/>}
                                Save
                            </button>
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
