
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, borderRadius: 12, background: t.bgCard, borderWidth: 1, borderStyle: 'solid', borderColor: t.border }}>
        <div>
          <h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>{entity.fullName}</h2>
          <p style={{ color: t.text4, fontWeight: 500 }}>{entity.shortName || '-'}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, fontSize: 12, borderRadius: 9999, textTransform: 'uppercase', background: t.accent + '18', color: t.accent, fontWeight: 700 }}>{entity.type}</span>
            <span style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, fontSize: 12, borderRadius: 9999, background: t.bgCard, color: t.text2, borderWidth: 1, borderStyle: 'solid', borderColor: t.bgHover, fontWeight: 700 }}>
               {entity.regCodeType}: {entity.regCodeValue}
            </span>
          </div>
        </div>
        {onEdit && (
            <button
                onClick={() => onEdit(entity.id)}
                className="transition-colors"
                style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, background: t.bgPanel, borderWidth: 1, borderStyle: 'solid', borderColor: t.borderL, color: t.text2, fontWeight: 500 }}
            >
                Edit Entity
            </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        {/* Contact Info */}
        <div style={{ padding: 20, borderRadius: 12, background: t.bgPanel, borderWidth: 1, borderStyle: 'solid', borderColor: t.border, boxShadow: t.shadow }}>
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: t.text1, fontWeight: 700 }}><MapPin size={18} style={{ color: t.accent }}/> Contact & Address</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
             <div><span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Country</span> <span style={{ color: t.text1, fontWeight: 500 }}>{entity.country}</span></div>
             <div><span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>City</span> <span style={{ color: t.text1, fontWeight: 500 }}>{entity.city || '-'}</span></div>
             <div><span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Address</span> <span style={{ color: t.text1, fontWeight: 500 }}>{entity.address || '-'}</span></div>

             <div style={{ paddingTop: 12, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: t.border }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Phone size={14} style={{ color: t.text4 }}/> {entity.phone || '-'}</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={14} style={{ color: t.text4 }}/> {entity.email || '-'}</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Globe size={14} style={{ color: t.text4 }}/> {entity.website ? <a href={entity.website} target="_blank" rel="noreferrer" style={{ color: t.accent }}>{entity.website}</a> : '-'}</div>
             </div>
          </div>
        </div>

        {/* Corporate Info */}
        <div style={{ padding: 20, borderRadius: 12, background: t.bgPanel, borderWidth: 1, borderStyle: 'solid', borderColor: t.border, boxShadow: t.shadow }}>
           <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: t.text1, fontWeight: 700 }}><Building2 size={18} style={{ color: t.accent }}/> Corporate Details</h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              <div><span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Director</span> <span style={{ color: t.text1, fontWeight: 500 }}>{entity.directorName || '-'}</span></div>
              <div><span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Line of Business</span> <span style={{ color: t.text1, fontWeight: 500 }}>{entity.lineOfBusiness || '-'}</span></div>
              <div><span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Shareholders</span> <span style={{ color: t.text1, fontWeight: 500 }}>{entity.shareholders || '-'}</span></div>
           </div>
        </div>
      </div>

       {/* Banking Info */}
       <div style={{ padding: 20, borderRadius: 12, background: t.bgPanel, borderWidth: 1, borderStyle: 'solid', borderColor: t.border, boxShadow: t.shadow }}>
           <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: t.text1, fontWeight: 700 }}><Landmark size={18} style={{ color: t.accent }}/> Banking Details</h3>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: 14 }}>
               <div><span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Bank Name</span> <span style={{ color: t.text1, fontWeight: 500 }}>{entity.bankName || '-'}</span></div>
               <div><span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Account Number</span> <span style={{ fontFamily: "'JetBrains Mono', monospace", paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4, display: 'inline-block', color: t.text1, background: t.bgCard, fontWeight: 500 }}>{entity.bankAccount || '-'}</span></div>
               <div><span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>MFO / SWIFT / IBAN</span> <span style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text1, fontWeight: 500 }}>{entity.bankMFO || '-'}</span></div>
               <div><span style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', color: t.text4 }}>Bank Address</span> <span style={{ color: t.text1, fontWeight: 500 }}>{entity.bankAddress || '-'}</span></div>
           </div>
       </div>
    </div>
  );

  const renderHistory = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
         <h3 style={{ color: t.text1, fontWeight: 700 }}>Audit Log</h3>
         <button onClick={() => { setLoadingLogs(true); DB.getEntityLogs(entity.id).then(d => { setLogs(d); setLoadingLogs(false); })}} style={{ fontSize: 14, color: t.accent }}>Refresh</button>
      </div>

      {loadingLogs ? (
        <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: t.text4 }}>Loading history...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, fontStyle: 'italic', color: t.text4 }}>No history found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 500, overflowY: 'auto', paddingRight: 8 }}>
            {logs.map(log => (
                <div key={log.id} style={{ padding: 16, borderRadius: 8, fontSize: 14, background: t.bgCard, borderWidth: 1, borderStyle: 'solid', borderColor: t.border }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span
                            style={{
                                fontSize: 12,
                                textTransform: 'uppercase',
                                paddingLeft: 8,
                                paddingRight: 8,
                                paddingTop: 2,
                                paddingBottom: 2,
                                borderRadius: 4,
                                ...(log.action === 'CREATE' ? { background: t.success + '18', color: t.success, fontWeight: 700 } :
                                log.action === 'UPDATE' ? { background: t.accent + '18', color: t.accent, fontWeight: 700 } :
                                { background: t.danger + '18', color: t.danger, fontWeight: 700 })
                            }}
                        >{log.action}</span>
                        <span style={{ fontSize: 12, color: t.text4 }}>{formatDateTime(log.timestamp)}</span>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                        <span style={{ color: t.text1, fontWeight: 500 }}>{log.userName}</span> <span style={{ color: t.text4 }}>performed this action.</span>
                    </div>
                    <div style={{ padding: 8, borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, overflowX: 'auto', background: t.bgPanel, borderWidth: 1, borderStyle: 'solid', borderColor: t.border, color: t.text3 }}>
                        {log.changes}
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div style={{ borderRadius: 12, width: '100%', maxWidth: 896, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowLg }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: t.border, background: t.bgCard }}>
           <div style={{ display: 'flex', gap: 16 }}>
              <button
                onClick={() => setActiveTab('details')}
                className="transition-colors"
                style={{ paddingBottom: 4, ...(activeTab === 'details' ? { borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: t.accent, color: t.accent, fontWeight: 500 } : { borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', color: t.text4, fontWeight: 500 }) }}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className="transition-colors"
                style={{ paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 4, ...(activeTab === 'history' ? { borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: t.accent, color: t.accent, fontWeight: 500 } : { borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', color: t.text4, fontWeight: 500 }) }}
              >
                <History size={16}/> History
              </button>
           </div>
           <button onClick={onClose} style={{ color: t.text4 }}><X size={20}/></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: t.bgPanel }}>
            {activeTab === 'details' ? renderDetails() : renderHistory()}
        </div>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: t.border, background: t.bgCard }}>
            <button onClick={onClose} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, background: t.bgHover, color: t.text1, fontWeight: 500 }}>Close</button>
        </div>
      </div>
    </div>
  );
};
