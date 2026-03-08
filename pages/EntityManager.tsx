
import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { LegalEntity } from '../types';
import { EntityDetailModal } from '../components/EntityDetailModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormModal } from '../components/FormModal';
import { EntityFormContent } from '../components/EntityFormContent';
import { Plus, Search, Building2, MapPin, Eye, Edit, Trash2 } from 'lucide-react';
import { getSectionForCode } from '../data/sicCodes';

const EntityManager: React.FC = () => {
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
          <h2 className="text-2xl font-bold text-gray-800">Legal Entities</h2>
          <p className="text-gray-500 text-sm">Manage company registry, counterparties, and insureds.</p>
        </div>
        <button
          onClick={() => { setEditingEntityId(null); setShowEntityModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-sm"
        >
          <Plus size={18} /> Add Entity
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input 
                    type="text" 
                    placeholder="Search by name, INN, or code..." 
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="text-xs text-gray-500 font-medium">
                {filteredEntities.length} Records found
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
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
                <tbody className="divide-y divide-gray-100">
                    {filteredEntities.map(entity => (
                        <tr key={entity.id} onClick={() => setSelectedEntity(entity)} className="hover:bg-blue-50 cursor-pointer transition-colors group">
                            <td className="px-6 py-4">
                                <div className="font-bold text-gray-900">{entity.fullName}</div>
                                <div className="text-xs text-gray-500">{entity.shortName}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium border border-gray-200 text-gray-600">{entity.type}</span>
                            </td>
                            <td className="px-6 py-4 font-mono text-gray-600">
                                {entity.regCodeValue}
                            </td>
                            <td className="px-6 py-4">
                                {entity.sicCode ? (
                                    <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs font-medium text-blue-700 whitespace-nowrap">
                                        {getSectionForCode(entity.sicCode)?.title || entity.sicSection || '-'}
                                    </span>
                                ) : (
                                    <span className="text-gray-300 text-xs">—</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-gray-600">
                                <div className="flex items-center gap-1"><MapPin size={12}/> {entity.country}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-600">
                                {entity.city || '-'}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); setSelectedEntity(entity); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="View"><Eye size={16}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); setEditingEntityId(entity.id); setShowEntityModal(true); }} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded" title="Edit"><Edit size={16}/></button>
                                    <button onClick={(e) => handleDelete(e, entity.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Delete"><Trash2 size={16}/></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredEntities.length === 0 && (
                        <tr>
                            <td colSpan={7} className="py-12 text-center text-gray-400">
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
