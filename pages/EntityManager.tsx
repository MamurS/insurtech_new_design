
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
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 style={{ color: t.text1, fontSize: 24, fontWeight: 700 }}>Legal Entities</h2>
          <p className="text-sm" style={{ color: t.text4 }}>Manage company registry, counterparties, and insureds.</p>
        </div>
        <button
          onClick={() => navigate('/entities/new')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all"
          style={{ background: t.accent, color: '#fff', boxShadow: t.shadow }}
        >
          <Plus size={18} /> Add Entity
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedEntityForPanel ? '1fr 360px' : '1fr',
          transition: 'grid-template-columns 0.2s ease',
        }}
        className="rounded-xl overflow-hidden"
      >
        {/* Left column: Table */}
        <div className="overflow-hidden" style={{ background: t.bgPanel, boxShadow: t.shadow, border: `1px solid ${t.border}`, borderRadius: selectedEntityForPanel ? '12px 0 0 12px' : '12px' }}>
          <div className="p-4 flex gap-4 items-center" style={{ background: t.bgPanel, borderBottom: `1px solid ${t.border}` }}>
              <div className="relative flex-1 max-w-md">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.text5 }}/>
                  <input
                      type="text"
                      placeholder="Search by name, INN, or code..."
                      className="w-full pl-10 pr-4 py-2 rounded-lg focus:ring-2 outline-none text-sm"
                      style={{ border: `1px solid ${t.border}`, '--tw-ring-color': t.accent } as React.CSSProperties}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
              <div className="text-xs font-medium" style={{ color: t.text4 }}>
                  {filteredEntities.length} Records found
              </div>
          </div>

          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
              <table className="w-full text-left text-sm">
                  <thead className="font-semibold" style={{ background: t.bgInput, color: t.text2, borderBottom: `1px solid ${t.border}`, position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                          <th className="px-6 py-4">Entity Name</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Reg Code (INN)</th>
                          <th className="px-6 py-4">Industry</th>
                          <th className="px-6 py-4">Country</th>
                          <th className="px-6 py-4">City</th>
                          <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                  </thead>
                  <tbody style={{ borderColor: t.bgInput } as React.CSSProperties}>
                      {filteredEntities.map(entity => (
                          <tr
                            key={entity.id}
                            onClick={() => handleRowClick(entity)}
                            className="cursor-pointer transition-colors group"
                            style={{
                              borderBottom: `1px solid ${t.bgInput}`,
                              background: selectedEntityForPanel?.id === entity.id ? t.bgActive : undefined,
                            }}
                          >
                              <td className="px-6 py-4">
                                  <div className="font-bold" style={{ color: t.text1 }}>{entity.fullName}</div>
                                  <div className="text-xs" style={{ color: t.text4 }}>{entity.shortName}</div>
                              </td>
                              <td className="px-6 py-4">
                                  <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: t.bgInput, border: `1px solid ${t.border}`, color: t.text3 }}>{entity.type}</span>
                              </td>
                              <td className="px-6 py-4 font-mono" style={{ color: t.text3 }}>
                                  {entity.regCodeValue}
                              </td>
                              <td className="px-6 py-4">
                                  {entity.sicCode ? (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ background: t.bgInput, border: `1px solid ${t.accent}`, color: t.accent }}>
                                          {getSectionForCode(entity.sicCode)?.title || entity.sicSection || '-'}
                                      </span>
                                  ) : (
                                      <span className="text-xs" style={{ color: t.text5 }}>—</span>
                                  )}
                              </td>
                              <td className="px-6 py-4" style={{ color: t.text3 }}>
                                  <div className="flex items-center gap-1"><MapPin size={12}/> {entity.country}</div>
                              </td>
                              <td className="px-6 py-4" style={{ color: t.text3 }}>
                                  {entity.city || '-'}
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <div className="flex justify-center gap-2">
                                      <button onClick={(e) => { e.stopPropagation(); setSelectedEntity(entity); }} className="p-1.5 rounded" style={{ color: t.accent }} title="View"><Eye size={16}/></button>
                                      <button onClick={(e) => { e.stopPropagation(); navigate(`/entities/edit/${entity.id}`); }} className="p-1.5 rounded" style={{ color: t.accent }} title="Edit"><Edit size={16}/></button>
                                      <button onClick={(e) => handleDelete(e, entity.id)} className="p-1.5 rounded" style={{ color: t.danger }} title="Delete"><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                      {filteredEntities.length === 0 && (
                          <tr>
                              <td colSpan={7} className="py-12 text-center" style={{ color: t.text5 }}>
                                  <Building2 size={48} className="mx-auto mb-4 opacity-20"/>
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
              <button
                onClick={() => {
                  if (selectedEntityForPanel) {
                    setSelectedEntity(selectedEntityForPanel);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: t.bgInput, color: t.text1, border: `1px solid ${t.border}` }}
              >
                <Eye size={14} /> View Full Detail
              </button>
              <button
                onClick={() => {
                  if (selectedEntityForPanel) {
                    navigate(`/entities/edit/${selectedEntityForPanel.id}`);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: t.accent, color: '#fff' }}
              >
                <Edit size={14} /> Edit
              </button>
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
