
import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { LegalEntity } from '../types';
import { EntityDetailModal } from '../components/EntityDetailModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormModal } from '../components/FormModal';
import { EntityFormContent } from '../components/EntityFormContent';
import { Plus, Search, Building2, MapPin, Eye, Edit, Trash2 } from 'lucide-react';
import { getSectionForCode } from '../data/sicCodes';
import { useTheme } from '../theme/useTheme';

const EntityManager: React.FC = () => {
  const { t } = useTheme();
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<LegalEntity | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });

  // Modal State
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: t.text1 }}>Legal Entities</h2>
          <p className="text-sm" style={{ color: t.text4 }}>Manage company registry, counterparties, and insureds.</p>
        </div>
        <button
          onClick={() => { setEditingEntityId(null); setShowEntityModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all"
          style={{ background: t.accent, color: '#fff', boxShadow: t.shadow }}
        >
          <Plus size={18} /> Add Entity
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: t.bgPanel, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
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

        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="font-semibold" style={{ background: t.bgInput, color: t.text2, borderBottom: `1px solid ${t.border}` }}>
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
                        <tr key={entity.id} onClick={() => setSelectedEntity(entity)} className="cursor-pointer transition-colors group" style={{ borderBottom: `1px solid ${t.bgInput}` }}>
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
                                    <button onClick={(e) => { e.stopPropagation(); setEditingEntityId(entity.id); setShowEntityModal(true); }} className="p-1.5 rounded" style={{ color: t.accent }} title="Edit"><Edit size={16}/></button>
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

      <EntityDetailModal
        entity={selectedEntity}
        onClose={() => setSelectedEntity(null)}
        onEdit={(id) => { setSelectedEntity(null); setEditingEntityId(id); setShowEntityModal(true); }}
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

      {/* Entity Form Modal */}
      <FormModal
        isOpen={showEntityModal}
        onClose={() => { setShowEntityModal(false); setEditingEntityId(null); }}
        title={editingEntityId ? 'Edit Legal Entity' : 'New Legal Entity'}
        subtitle={editingEntityId ? 'Edit entity details' : 'Add a new legal entity to the registry'}
      >
        <EntityFormContent
          id={editingEntityId || undefined}
          onSave={() => { setShowEntityModal(false); setEditingEntityId(null); loadData(); }}
          onCancel={() => { setShowEntityModal(false); setEditingEntityId(null); }}
        />
      </FormModal>
    </div>
  );
};

export default EntityManager;
