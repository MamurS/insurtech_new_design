
import React, { useState, useEffect } from 'react';
import { LegalEntity, EntityLog } from '../types';
import { DB } from '../services/db';
import { formatDateTime } from '../utils/dateUtils';
import { X, Building2, Globe, Phone, Mail, MapPin, Landmark, Users, Clock, History } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

interface EntityDetailModalProps {
  entity: LegalEntity | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
}

export const EntityDetailModal: React.FC<EntityDetailModalProps> = ({ entity, onClose, onEdit }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [logs, setLogs] = useState<EntityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const { t } = useTheme();

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
      <div className="flex justify-between items-start p-6 rounded-xl" style={{ background: t.bgCard, borderWidth: 1, borderStyle: 'solid', borderColor: t.border }}>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: t.text1 }}>{entity.fullName}</h2>
          <p className="font-medium" style={{ color: t.text4 }}>{entity.shortName || '-'}</p>
          <div className="flex gap-2 mt-2">
            <span className="px-3 py-1 text-xs font-bold rounded-full uppercase" style={{ background: t.accent + '18', color: t.accent }}>{entity.type}</span>
            <span className="px-3 py-1 text-xs font-bold rounded-full" style={{ background: t.bgCard, color: t.text2, borderWidth: 1, borderStyle: 'solid', borderColor: t.bgHover }}>
               {entity.regCodeType}: {entity.regCodeValue}
            </span>
          </div>
        </div>
        {onEdit && (
            <button
                onClick={() => onEdit(entity.id)}
                className="px-4 py-2 font-medium rounded-lg transition-colors text-sm"
                style={{ background: t.bgPanel, borderWidth: 1, borderStyle: 'solid', borderColor: t.borderL, color: t.text2 }}
            >
                Edit Entity
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="p-5 rounded-xl" style={{ background: t.bgPanel, borderWidth: 1, borderStyle: 'solid', borderColor: t.border, boxShadow: t.shadow }}>
          <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: t.text1 }}><MapPin size={18} style={{ color: t.accent }}/> Contact & Address</h3>
          <div className="space-y-3 text-sm">
             <div><span className="block text-xs uppercase" style={{ color: t.text4 }}>Country</span> <span className="font-medium" style={{ color: t.text1 }}>{entity.country}</span></div>
             <div><span className="block text-xs uppercase" style={{ color: t.text4 }}>City</span> <span className="font-medium" style={{ color: t.text1 }}>{entity.city || '-'}</span></div>
             <div><span className="block text-xs uppercase" style={{ color: t.text4 }}>Address</span> <span className="font-medium" style={{ color: t.text1 }}>{entity.address || '-'}</span></div>

             <div className="pt-3 mt-3 space-y-2" style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: t.border }}>
                 <div className="flex items-center gap-2"><Phone size={14} style={{ color: t.text4 }}/> {entity.phone || '-'}</div>
                 <div className="flex items-center gap-2"><Mail size={14} style={{ color: t.text4 }}/> {entity.email || '-'}</div>
                 <div className="flex items-center gap-2"><Globe size={14} style={{ color: t.text4 }}/> {entity.website ? <a href={entity.website} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: t.accent }}>{entity.website}</a> : '-'}</div>
             </div>
          </div>
        </div>

        {/* Corporate Info */}
        <div className="p-5 rounded-xl" style={{ background: t.bgPanel, borderWidth: 1, borderStyle: 'solid', borderColor: t.border, boxShadow: t.shadow }}>
           <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: t.text1 }}><Building2 size={18} style={{ color: t.accent }}/> Corporate Details</h3>
           <div className="space-y-3 text-sm">
              <div><span className="block text-xs uppercase" style={{ color: t.text4 }}>Director</span> <span className="font-medium" style={{ color: t.text1 }}>{entity.directorName || '-'}</span></div>
              <div><span className="block text-xs uppercase" style={{ color: t.text4 }}>Line of Business</span> <span className="font-medium" style={{ color: t.text1 }}>{entity.lineOfBusiness || '-'}</span></div>
              <div><span className="block text-xs uppercase" style={{ color: t.text4 }}>Shareholders</span> <span className="font-medium" style={{ color: t.text1 }}>{entity.shareholders || '-'}</span></div>
           </div>
        </div>
      </div>

       {/* Banking Info */}
       <div className="p-5 rounded-xl" style={{ background: t.bgPanel, borderWidth: 1, borderStyle: 'solid', borderColor: t.border, boxShadow: t.shadow }}>
           <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: t.text1 }}><Landmark size={18} style={{ color: t.accent }}/> Banking Details</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
               <div><span className="block text-xs uppercase" style={{ color: t.text4 }}>Bank Name</span> <span className="font-medium" style={{ color: t.text1 }}>{entity.bankName || '-'}</span></div>
               <div><span className="block text-xs uppercase" style={{ color: t.text4 }}>Account Number</span> <span className="font-mono font-medium px-2 py-1 rounded inline-block" style={{ color: t.text1, background: t.bgCard }}>{entity.bankAccount || '-'}</span></div>
               <div><span className="block text-xs uppercase" style={{ color: t.text4 }}>MFO / SWIFT / IBAN</span> <span className="font-mono font-medium" style={{ color: t.text1 }}>{entity.bankMFO || '-'}</span></div>
               <div><span className="block text-xs uppercase" style={{ color: t.text4 }}>Bank Address</span> <span className="font-medium" style={{ color: t.text1 }}>{entity.bankAddress || '-'}</span></div>
           </div>
       </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
         <h3 className="font-bold" style={{ color: t.text1 }}>Audit Log</h3>
         <button onClick={() => { setLoadingLogs(true); DB.getEntityLogs(entity.id).then(d => { setLogs(d); setLoadingLogs(false); })}} className="text-sm hover:underline" style={{ color: t.accent }}>Refresh</button>
      </div>

      {loadingLogs ? (
        <div className="text-center py-8" style={{ color: t.text4 }}>Loading history...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 italic" style={{ color: t.text4 }}>No history found.</div>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {logs.map(log => (
                <div key={log.id} className="p-4 rounded-lg text-sm" style={{ background: t.bgCard, borderWidth: 1, borderStyle: 'solid', borderColor: t.border }}>
                    <div className="flex justify-between mb-2">
                        <span
                            className="font-bold text-xs uppercase px-2 py-0.5 rounded"
                            style={
                                log.action === 'CREATE' ? { background: t.success + '18', color: t.success } :
                                log.action === 'UPDATE' ? { background: t.accent + '18', color: t.accent } :
                                { background: t.danger + '18', color: t.danger }
                            }
                        >{log.action}</span>
                        <span className="text-xs" style={{ color: t.text4 }}>{formatDateTime(log.timestamp)}</span>
                    </div>
                    <div className="mb-2">
                        <span className="font-medium" style={{ color: t.text1 }}>{log.userName}</span> <span style={{ color: t.text4 }}>performed this action.</span>
                    </div>
                    <div className="p-2 rounded font-mono text-xs overflow-x-auto" style={{ background: t.bgPanel, borderWidth: 1, borderStyle: 'solid', borderColor: t.border, color: t.text3 }}>
                        {log.changes}
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" style={{ background: t.bgPanel, boxShadow: t.shadowLg }} onClick={e => e.stopPropagation()}>
        <div className="p-4 flex justify-between items-center" style={{ borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: t.border, background: t.bgCard }}>
           <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('details')}
                className="pb-1 font-medium transition-colors"
                style={activeTab === 'details' ? { borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: t.accent, color: t.accent } : { borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', color: t.text4 }}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className="pb-1 font-medium transition-colors flex items-center gap-1"
                style={activeTab === 'history' ? { borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: t.accent, color: t.accent } : { borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', color: t.text4 }}
              >
                <History size={16}/> History
              </button>
           </div>
           <button onClick={onClose} style={{ color: t.text4 }}><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6" style={{ background: t.bgPanel }}>
            {activeTab === 'details' ? renderDetails() : renderHistory()}
        </div>
        <div className="p-3 flex justify-end" style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: t.border, background: t.bgCard }}>
            <button onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-sm" style={{ background: t.bgHover, color: t.text1 }}>Close</button>
        </div>
      </div>
    </div>
  );
};
