import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../services/db';
import { LegalEntity } from '../types';
import { EntityDetailModal } from '../components/EntityDetailModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import SidePanel, { PanelField } from '../components/ui/SidePanel';
import { Plus, Search, Building2, MapPin, Eye, Edit, Trash2 } from 'lucide-react';
import { getSectionForCode } from '../data/sicCodes';
import { useTheme } from '../theme/useTheme';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const EntityManager: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTheme();
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<LegalEntity | null>(null);
  const [selectedEntityForPanel, setSelectedEntityForPanel] = useState<LegalEntity | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });

  const loadData = async () => {
    setLoading(true);
    const data = await DB.getLegalEntities();
    setEntities(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    await DB.deleteLegalEntity(deleteConfirm.id);
    setDeleteConfirm({ isOpen: false, id: '' });
    loadData();
  };

  const filteredEntities = entities.filter(e =>
    e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.regCodeValue.includes(searchTerm) ||
    e.shortName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRowClick = (entity: LegalEntity) => {
    if (selectedEntityForPanel?.id === entity.id) {
      setSelectedEntityForPanel(null);
    } else {
      setSelectedEntityForPanel(entity);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>Legal Entities</h2>
          <p style={{ color: t.text4, fontSize: 14 }}>Manage company registry, counterparties, and insureds.</p>
        </div>
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => navigate('/entities/new')}>
          Add Entity
        </Button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedEntityForPanel ? '1fr 360px' : '1fr',
          transition: 'grid-template-columns 0.2s ease',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Left column: Table */}
        <div style={{ overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadow, border: `1px solid ${t.border}`, borderRadius: selectedEntityForPanel ? '12px 0 0 12px' : '12px' }}>
          <div style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center', background: t.bgPanel, borderBottom: `1px solid ${t.border}` }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 448 }}>
                  <Search size={18} className="-translate-y-1/2" style={{ color: t.text5, position: 'absolute', left: 12, top: '50%', zIndex: 1 }}/>
                  <Input
                      type="text"
                      placeholder="Search by name, INN, or code..."
                      value={searchTerm}
                      onChange={(val) => setSearchTerm(val)}
                      style={{ paddingLeft: 40 }}
                  />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.text4 }}>
                  {filteredEntities.length} Records found
              </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', fontSize: 14 }}>
                  <thead style={{ fontWeight: 600, background: t.bgInput, color: t.text2, borderBottom: `1px solid ${t.border}`, position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                          <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Entity Name</th>
                          <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Type</th>
                          <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Reg Code (INN)</th>
                          <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Industry</th>
                          <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>Country</th>
                          <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>City</th>
                          <th style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>Actions</th>
                      </tr>
                  </thead>
                  <tbody style={{ borderColor: t.bgInput } as React.CSSProperties}>
                      {filteredEntities.map(entity => (
                          <tr
                            key={entity.id}
                            onClick={() => handleRowClick(entity)}
                            className="transition-colors group"
                            style={{
                              cursor: 'pointer',
                              borderBottom: `1px solid ${t.bgInput}`,
                              background: selectedEntityForPanel?.id === entity.id ? t.bgActive : undefined,
                            }}
                          >
                              <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>
                                  <div style={{ fontWeight: 700, color: t.text1 }}>{entity.fullName}</div>
                                  <div style={{ fontSize: 12, color: t.text4 }}>{entity.shortName}</div>
                              </td>
                              <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>
                                  <span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4, fontSize: 12, fontWeight: 500, background: t.bgInput, border: `1px solid ${t.border}`, color: t.text3 }}>{entity.type}</span>
                              </td>
                              <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, fontFamily: "'JetBrains Mono', monospace", color: t.text3 }}>
                                  {entity.regCodeValue}
                              </td>
                              <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 }}>
                                  {entity.sicCode ? (
                                      <span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', background: t.bgInput, border: `1px solid ${t.accent}`, color: t.accent }}>
                                          {getSectionForCode(entity.sicCode)?.title || entity.sicSection || '-'}
                                      </span>
                                  ) : (
                                      <span style={{ fontSize: 12, color: t.text5 }}>—</span>
                                  )}
                              </td>
                              <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, color: t.text3 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12}/> {entity.country}</div>
                              </td>
                              <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, color: t.text3 }}>
                                  {entity.city || '-'}
                              </td>
                              <td style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>
                                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedEntity(entity); }} title="View" style={{ padding: 6, border: 'none', color: t.accent }}><Eye size={16}/></Button>
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/entities/edit/${entity.id}`); }} title="Edit" style={{ padding: 6, border: 'none', color: t.accent }}><Edit size={16}/></Button>
                                      <Button variant="ghost" size="sm" onClick={(e) => handleDelete(e, entity.id)} title="Delete" style={{ padding: 6, border: 'none', color: t.danger }}><Trash2 size={16}/></Button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                      {filteredEntities.length === 0 && (
                          <tr>
                              <td colSpan={7} style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: t.text5 }}>
                                  <Building2 size={48} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 16, opacity: 0.2 }}/>
                                  No entities found.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
        </div>

        {/* Right column: Side Panel */}
        <SidePanel
          open={!!selectedEntityForPanel}
          onClose={() => setSelectedEntityForPanel(null)}
          title={selectedEntityForPanel?.fullName || ''}
          subtitle={selectedEntityForPanel?.shortName}
          footer={
            <>
              <Button variant="ghost" icon={<Eye size={14} />} onClick={() => { if (selectedEntityForPanel) setSelectedEntity(selectedEntityForPanel); }} style={{ flex: 1, justifyContent: 'center' }}>
                View Full Detail
              </Button>
              <Button variant="primary" icon={<Edit size={14} />} onClick={() => { if (selectedEntityForPanel) navigate(`/entities/edit/${selectedEntityForPanel.id}`); }} style={{ flex: 1, justifyContent: 'center' }}>
                Edit
              </Button>
            </>
          }
        >
          {selectedEntityForPanel && (
            <>
              <PanelField label="Full Name" value={selectedEntityForPanel.fullName} />
              <PanelField label="Short Name" value={selectedEntityForPanel.shortName} />
              <PanelField label="Type" value={selectedEntityForPanel.type} />
              <PanelField label="Country" value={selectedEntityForPanel.country} />
              <PanelField label="City" value={selectedEntityForPanel.city} />
              <PanelField label="Address" value={selectedEntityForPanel.address} />
              <PanelField label={selectedEntityForPanel.regCodeType || 'Registration Number'} value={selectedEntityForPanel.regCodeValue} />
              <PanelField label="Industry (SIC)" value={
                selectedEntityForPanel.sicCode
                  ? `${selectedEntityForPanel.sicCode} — ${getSectionForCode(selectedEntityForPanel.sicCode)?.title || selectedEntityForPanel.sicSection || ''}`
                  : undefined
              } />
              <PanelField label="Phone" value={selectedEntityForPanel.phone} />
              <PanelField label="Email" value={selectedEntityForPanel.email} />
              <PanelField label="Website" value={selectedEntityForPanel.website} />
              <PanelField label="Director" value={selectedEntityForPanel.directorName} />
            </>
          )}
        </SidePanel>
      </div>

      <EntityDetailModal
        entity={selectedEntity}
        onClose={() => setSelectedEntity(null)}
        onEdit={(id) => { setSelectedEntity(null); navigate(`/entities/edit/${id}`); }}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Entity?"
        message="Are you sure you want to delete this legal entity? It will be moved to the Admin Recycle Bin."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '' })}
        variant="danger"
        confirmText="Delete"
      />

    </div>
  );
};

export default EntityManager;
