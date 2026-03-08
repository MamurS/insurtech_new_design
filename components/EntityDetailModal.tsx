
import React, { useState, useEffect } from 'react';
import { LegalEntity, EntityLog } from '../types';
import { DB } from '../services/db';
import { formatDateTime } from '../utils/dateUtils';
import { X, Building2, Globe, Phone, Mail, MapPin, Landmark, Users, Clock, History } from 'lucide-react';

interface EntityDetailModalProps {
  entity: LegalEntity | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
}

export const EntityDetailModal: React.FC<EntityDetailModalProps> = ({ entity, onClose, onEdit }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [logs, setLogs] = useState<EntityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (activeTab === 'history' && entity) {
      setLoadingLogs(true);
      DB.getEntityLogs(entity.id).then(data => {
        setLogs(data);
        setLoadingLogs(false);
      });
    }
  }, [activeTab, entity]);

  if (!entity) return null;

  const renderDetails = () => (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex justify-between items-start bg-gray-50 p-6 rounded-xl border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{entity.fullName}</h2>
          <p className="text-gray-500 font-medium">{entity.shortName || '-'}</p>
          <div className="flex gap-2 mt-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase">{entity.type}</span>
            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full border border-gray-200">
               {entity.regCodeType}: {entity.regCodeValue}
            </span>
          </div>
        </div>
        {onEdit && (
            <button 
                onClick={() => onEdit(entity.id)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
                Edit Entity
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><MapPin size={18} className="text-blue-500"/> Contact & Address</h3>
          <div className="space-y-3 text-sm">
             <div><span className="text-gray-500 block text-xs uppercase">Country</span> <span className="font-medium text-gray-900">{entity.country}</span></div>
             <div><span className="text-gray-500 block text-xs uppercase">City</span> <span className="font-medium text-gray-900">{entity.city || '-'}</span></div>
             <div><span className="text-gray-500 block text-xs uppercase">Address</span> <span className="font-medium text-gray-900">{entity.address || '-'}</span></div>
             
             <div className="border-t pt-3 mt-3 space-y-2">
                 <div className="flex items-center gap-2"><Phone size={14} className="text-gray-400"/> {entity.phone || '-'}</div>
                 <div className="flex items-center gap-2"><Mail size={14} className="text-gray-400"/> {entity.email || '-'}</div>
                 <div className="flex items-center gap-2"><Globe size={14} className="text-gray-400"/> {entity.website ? <a href={entity.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{entity.website}</a> : '-'}</div>
             </div>
          </div>
        </div>

        {/* Corporate Info */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
           <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Building2 size={18} className="text-blue-500"/> Corporate Details</h3>
           <div className="space-y-3 text-sm">
              <div><span className="text-gray-500 block text-xs uppercase">Director</span> <span className="font-medium text-gray-900">{entity.directorName || '-'}</span></div>
              <div><span className="text-gray-500 block text-xs uppercase">Line of Business</span> <span className="font-medium text-gray-900">{entity.lineOfBusiness || '-'}</span></div>
              <div><span className="text-gray-500 block text-xs uppercase">Shareholders</span> <span className="font-medium text-gray-900">{entity.shareholders || '-'}</span></div>
           </div>
        </div>
      </div>

       {/* Banking Info */}
       <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
           <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Landmark size={18} className="text-blue-500"/> Banking Details</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
               <div><span className="text-gray-500 block text-xs uppercase">Bank Name</span> <span className="font-medium text-gray-900">{entity.bankName || '-'}</span></div>
               <div><span className="text-gray-500 block text-xs uppercase">Account Number</span> <span className="font-mono font-medium text-gray-900 bg-gray-50 px-2 py-1 rounded inline-block">{entity.bankAccount || '-'}</span></div>
               <div><span className="text-gray-500 block text-xs uppercase">MFO / SWIFT / IBAN</span> <span className="font-mono font-medium text-gray-900">{entity.bankMFO || '-'}</span></div>
               <div><span className="text-gray-500 block text-xs uppercase">Bank Address</span> <span className="font-medium text-gray-900">{entity.bankAddress || '-'}</span></div>
           </div>
       </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
         <h3 className="font-bold text-gray-800">Audit Log</h3>
         <button onClick={() => { setLoadingLogs(true); DB.getEntityLogs(entity.id).then(d => { setLogs(d); setLoadingLogs(false); })}} className="text-blue-600 text-sm hover:underline">Refresh</button>
      </div>
      
      {loadingLogs ? (
        <div className="text-center py-8 text-gray-500">Loading history...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-gray-400 italic">No history found.</div>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {logs.map(log => (
                <div key={log.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                    <div className="flex justify-between mb-2">
                        <span className={`font-bold text-xs uppercase px-2 py-0.5 rounded ${
                            log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                        }`}>{log.action}</span>
                        <span className="text-gray-500 text-xs">{formatDateTime(log.timestamp)}</span>
                    </div>
                    <div className="mb-2">
                        <span className="font-medium text-gray-900">{log.userName}</span> <span className="text-gray-500">performed this action.</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-200 font-mono text-xs overflow-x-auto text-gray-600">
                        {log.changes}
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
           <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab('details')}
                className={`pb-1 border-b-2 font-medium transition-colors ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Overview
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`pb-1 border-b-2 font-medium transition-colors flex items-center gap-1 ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <History size={16}/> History
              </button>
           </div>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-white">
            {activeTab === 'details' ? renderDetails() : renderHistory()}
        </div>
        <div className="p-3 border-t bg-gray-50 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-800 font-medium text-sm">Close</button>
        </div>
      </div>
    </div>
  );
};
