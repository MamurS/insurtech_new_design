
import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { Clause } from '../types';
import { generateClause } from '../services/geminiService';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ContextBar } from '../components/ContextBar';
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';

const ClauseManager: React.FC = () => {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });
  
  // New Clause Form State
  const [newClause, setNewClause] = useState<Omit<Clause, 'id'>>({
    title: '',
    content: '',
    category: 'General',
    isStandard: false
  });

  const [aiPrompt, setAiPrompt] = useState('');

  const refreshClauses = async () => {
    const data = await DB.getClauses();
    setClauses(data);
    setLoading(false);
  };

  useEffect(() => {
    refreshClauses();
  }, []);

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    await DB.deleteClause(deleteConfirm.id);
    setDeleteConfirm({ isOpen: false, id: '' });
    refreshClauses();
  };

  const handleSave = async () => {
    await DB.saveClause({ ...newClause, id: crypto.randomUUID() });
    refreshClauses();
    setShowAddModal(false);
    setNewClause({ title: '', content: '', category: 'General', isStandard: false });
    setAiPrompt('');
  };

  const handleAiDraft = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const generatedText = await generateClause(aiPrompt, newClause.category);
      setNewClause(prev => ({ ...prev, content: generatedText }));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Clause Library</h2>
          <p className="text-gray-500">Manage standard clauses and warranties used in policies.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          Add Clause
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading clauses...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clauses.map(clause => (
            <div key={clause.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  clause.category === 'Exclusion' ? 'bg-red-100 text-red-700' :
                  clause.category === 'Warranty' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {clause.category}
                </span>
                {clause.isStandard && <span className="text-xs text-gray-400 font-medium">Standard</span>}
              </div>
              <h3 className="font-bold text-gray-800 mb-2">{clause.title}</h3>
              <p className="text-sm text-gray-600 flex-1 line-clamp-4 leading-relaxed mb-4">
                {clause.content}
              </p>
              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button 
                  onClick={() => handleDelete(clause.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold p-6 pb-0">New Clause Template</h3>

            <ContextBar
              status="NEW"
              breadcrumbs={[
                { label: 'Clause Library' },
                { label: 'New Clause Template' }
              ]}
            />

            <div className="p-6 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input 
                    className="w-full bg-white border rounded p-2 text-gray-900"
                    value={newClause.title}
                    onChange={e => setNewClause({...newClause, title: e.target.value})}
                    placeholder="e.g., War Exclusion"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select 
                    className="w-full bg-white border rounded p-2 text-gray-900"
                    value={newClause.category}
                    onChange={e => setNewClause({...newClause, category: e.target.value as any})}
                  >
                    <option value="General">General</option>
                    <option value="Exclusion">Exclusion</option>
                    <option value="Condition">Condition</option>
                    <option value="Warranty">Warranty</option>
                  </select>
                </div>
              </div>

              {/* AI Assistant Section */}
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <div className="flex items-center gap-2 mb-2 text-purple-800 font-medium">
                  <Sparkles size={16} />
                  <span>AI Drafting Assistant</span>
                </div>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 bg-white border border-purple-200 rounded p-2 text-sm focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    placeholder="Describe the clause you need (e.g., 'Exclude damage from nuclear explosions')..."
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                  />
                  <button 
                    onClick={handleAiDraft}
                    disabled={isGenerating || !aiPrompt}
                    className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGenerating ? <Loader2 className="animate-spin" size={16}/> : 'Draft'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea 
                  className="w-full bg-white border rounded p-2 h-32 font-serif text-gray-900"
                  value={newClause.content}
                  onChange={e => setNewClause({...newClause, content: e.target.value})}
                  placeholder="Clause text goes here..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="standard"
                  checked={newClause.isStandard}
                  onChange={e => setNewClause({...newClause, isStandard: e.target.checked})}
                />
                <label htmlFor="standard" className="text-sm">Add to all new policies by default</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Clause?"
        message="Are you sure you want to delete this clause template?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '' })}
        variant="danger"
        confirmText="Delete"
      />
    </div>
  );
};

export default ClauseManager;
