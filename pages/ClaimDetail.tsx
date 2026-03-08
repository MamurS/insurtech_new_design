
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ClaimTransactionType } from '../types';
import { useClaimDetail, useAddTransaction } from '../hooks/useClaims';
import { formatDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ArrowLeft, FileText, Plus, Wallet, Loader2, CheckCircle, XCircle, RefreshCw, Settings } from 'lucide-react';
import { supabase } from '../services/supabase';

const ClaimDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [statusConfirm, setStatusConfirm] = useState<{ isOpen: boolean; status: string; message: string }>({ isOpen: false, status: '', message: '' });
  
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

  if (loading) return (
      <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
  );

  if (error || !claim) return (
      <div className="p-8 text-center text-red-500">
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
           <button onClick={() => navigate('/claims')} className="p-2 bg-white border rounded-lg hover:bg-gray-50"><ArrowLeft size={20}/></button>
           <div>
               <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                   {claim.claimNumber}
                   <span className={`px-2 py-1 text-sm rounded-full ${
                       claim.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                       claim.status === 'DENIED' ? 'bg-red-100 text-red-800' :
                       claim.liabilityType === 'ACTIVE' ? 'bg-blue-100 text-blue-800' : 
                       'bg-gray-100 text-gray-600'
                   }`}>
                       {claim.status === 'OPEN' ? (claim.liabilityType === 'ACTIVE' ? 'ACTIVE' : 'INFO') : claim.status}
                   </span>
               </h2>
               <p className="text-gray-500">Policy: <span className="font-mono font-bold text-blue-600">{policy.policyNumber}</span> • {policy.insuredName}</p>
           </div>
       </div>

       {/* Claim Actions Section */}
       <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase">
                <Settings size={16} />
                Workflow Actions
            </h3>
            
            <div className="flex flex-wrap gap-2">
                {claim.status === 'OPEN' && (
                    <>
                        <button 
                            onClick={() => handleStatusChange('CLOSED')}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-bold shadow-sm transition-colors"
                        >
                            <CheckCircle size={16} />
                            Close Claim
                        </button>
                        <button 
                            onClick={() => handleStatusChange('DENIED')}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-bold shadow-sm transition-colors"
                        >
                            <XCircle size={16} />
                            Deny Claim
                        </button>
                    </>
                )}
                
                {(claim.status === 'CLOSED' || claim.status === 'DENIED') && (
                    <button 
                        onClick={() => handleStatusChange('REOPENED')}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 text-sm font-bold shadow-sm transition-colors"
                    >
                        <RefreshCw size={16} />
                        Reopen Claim
                    </button>
                )}
                
                {claim.status === 'REOPENED' && (
                    <>
                        <button 
                            onClick={() => handleStatusChange('CLOSED')}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-bold shadow-sm transition-colors"
                        >
                            <CheckCircle size={16} />
                            Close Claim
                        </button>
                        <button 
                            onClick={() => handleStatusChange('DENIED')}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-bold shadow-sm transition-colors"
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
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText size={18}/> Claim Details</h3>
                    <div className="space-y-3 text-sm">
                        <div><div className="text-xs text-gray-500 uppercase">Status</div><div className="font-medium">{claim.status}</div></div>
                        <div><div className="text-xs text-gray-500 uppercase">Loss Date</div><div className="font-medium">{formatDate(claim.lossDate)}</div></div>
                        <div><div className="text-xs text-gray-500 uppercase">Report Date</div><div className="font-medium">{formatDate(claim.reportDate)}</div></div>
                        {claim.closedDate && <div><div className="text-xs text-gray-500 uppercase">Closed Date</div><div className="font-medium">{formatDate(claim.closedDate)}</div></div>}
                        <div><div className="text-xs text-gray-500 uppercase">Description</div><div className="font-medium">{claim.description || '-'}</div></div>
                        <div><div className="text-xs text-gray-500 uppercase">Claimant</div><div className="font-medium">{claim.claimantName || '-'}</div></div>
                        <div><div className="text-xs text-gray-500 uppercase">Country</div><div className="font-medium">{claim.locationCountry || '-'}</div></div>
                    </div>
                </div>

                {claim.liabilityType === 'INFORMATIONAL' && (
                    <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 text-amber-900">
                        <h3 className="font-bold mb-2">Informational Only</h3>
                        <p className="text-sm mb-2">This claim is tracked for record-keeping. Financials are imported in bulk.</p>
                        <div className="font-mono text-xl font-bold">{formatMoney(claim.importedTotalIncurred || 0)} {policy.currency}</div>
                        <div className="text-xs opacity-75">Imported Incurred Estimate</div>
                    </div>
                )}
           </div>

           {/* Right: Ledger */}
           <div className="md:col-span-2">
               <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                   <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                       <h3 className="font-bold text-gray-800 flex items-center gap-2"><Wallet size={18}/> Financial Ledger</h3>
                       {claim.liabilityType === 'ACTIVE' && claim.status !== 'CLOSED' && claim.status !== 'DENIED' && (
                           <button 
                             onClick={() => setShowTransModal(true)}
                             className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm"
                           >
                               <Plus size={16}/> Add Transaction
                           </button>
                       )}
                   </div>

                   {claim.liabilityType === 'ACTIVE' && (
                       <div className="grid grid-cols-3 bg-blue-50 border-b border-blue-100 p-4 text-center">
                           <div>
                               <div className="text-xs text-blue-600 uppercase font-bold">Incurred (Our Share)</div>
                               <div className="text-xl font-bold text-blue-900">{formatMoney(totalIncurredOurShare)} {policy.currency}</div>
                           </div>
                           <div>
                               <div className="text-xs text-green-600 uppercase font-bold">Paid (Our Share)</div>
                               <div className="text-xl font-bold text-green-900">{formatMoney(totalPaidOurShare)} {policy.currency}</div>
                           </div>
                           <div>
                               <div className="text-xs text-red-600 uppercase font-bold">Outstanding (Our Share)</div>
                               <div className="text-xl font-bold text-red-900">{formatMoney(outstandingOurShare)} {policy.currency}</div>
                           </div>
                       </div>
                   )}

                   <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm whitespace-nowrap">
                           <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                               <tr>
                                   <th className="px-6 py-3">Date</th>
                                   <th className="px-6 py-3">Type</th>
                                   <th className="px-6 py-3 text-right">Amount (100%)</th>
                                   <th className="px-6 py-3 text-right">Our Share</th>
                                   <th className="px-6 py-3">Notes</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {transactions.map(t => (
                                   <tr key={t.id} className="hover:bg-gray-50">
                                       <td className="px-6 py-3 text-gray-500">{formatDate(t.transactionDate)}</td>
                                       <td className="px-6 py-3">
                                           <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                               ['PAYMENT', 'LEGAL_FEE', 'ADJUSTER_FEE'].includes(t.transactionType) ? 'bg-green-100 text-green-800' :
                                               ['RESERVE_SET', 'RESERVE_ADJUST'].includes(t.transactionType) ? 'bg-blue-100 text-blue-800' :
                                               'bg-gray-100 text-gray-800'
                                           }`}>
                                               {t.transactionType}
                                           </span>
                                       </td>
                                       <td className="px-6 py-3 text-right font-mono">{formatMoney(t.amount100pct)}</td>
                                       <td className="px-6 py-3 text-right font-mono text-gray-600">{formatMoney(t.amountOurShare)}</td>
                                       <td className="px-6 py-3 text-gray-500 italic truncate max-w-[200px]">{t.notes}</td>
                                   </tr>
                               ))}
                               {transactions.length === 0 && (
                                   <tr>
                                       <td colSpan={5} className="py-8 text-center text-gray-400 italic">No transactions recorded.</td>
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
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                   <h3 className="font-bold text-lg mb-4">Add Financial Transaction</h3>
                   <div className="space-y-4">
                       <div>
                           <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                           <select 
                                className="w-full p-2 border rounded"
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
                           <label className="block text-sm font-bold text-gray-700 mb-1">Amount (100% Gross)</label>
                           <input 
                                type="number" 
                                className="w-full p-2 border rounded font-mono"
                                value={newTrans.amount}
                                onChange={e => setNewTrans({...newTrans, amount: Number(e.target.value)})}
                           />
                       </div>
                       <div>
                           <label className="block text-sm font-bold text-gray-700 mb-1">Our Share %</label>
                           <input 
                                type="number" 
                                className="w-full p-2 border rounded"
                                value={newTrans.share}
                                onChange={e => setNewTrans({...newTrans, share: Number(e.target.value)})}
                           />
                       </div>
                       <div>
                           <label className="block text-sm font-bold text-gray-700 mb-1">Notes</label>
                           <textarea 
                                className="w-full p-2 border rounded"
                                value={newTrans.notes}
                                onChange={e => setNewTrans({...newTrans, notes: e.target.value})}
                           />
                       </div>
                       <div className="flex justify-end gap-2 pt-4">
                           <button 
                                onClick={() => setShowTransModal(false)} 
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                disabled={addTransactionMutation.isPending}
                            >
                                Cancel
                            </button>
                           <button 
                                onClick={handleAddTransaction} 
                                disabled={addTransactionMutation.isPending}
                                className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 flex items-center gap-2"
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
