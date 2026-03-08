import React, { useState, useEffect } from 'react';
import { Role, Permission, AuthorityLimit, Currency } from '../types';
import { PermissionService } from '../services/permissionService';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
import { X, Save, Plus, Trash2, CheckSquare, Square } from 'lucide-react';

interface RoleEditModalProps {
    role?: Role;
    onClose: () => void;
    onSave: () => void;
}

export const RoleEditModal: React.FC<RoleEditModalProps> = ({ role, onClose, onSave }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'permissions' | 'limits'>('details');
    const toast = useToast();
    const [formData, setFormData] = useState<Partial<Role>>({
        name: '',
        description: '',
        department: '',
        level: 1,
        isActive: true
    });

    // Permission State
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

    // Limits State
    const [limits, setLimits] = useState<Partial<AuthorityLimit>[]>([]);

    // Confirm dialog for delete limit
    const [deleteLimitConfirm, setDeleteLimitConfirm] = useState<{ show: boolean; index: number; limitId?: string }>({ show: false, index: -1 });

    useEffect(() => {
        const load = async () => {
            const perms = await PermissionService.getPermissions();
            setAllPermissions(perms);

            if (role) {
                setFormData(role);
                const rolePerms = await PermissionService.getRolePermissions(role.id);
                setSelectedPermissions(rolePerms);
                const roleLimits = await PermissionService.getRoleAuthorityLimits(role.id);
                setLimits(roleLimits);
            } else {
                // Default limits template for new role
                setLimits([
                    { id: crypto.randomUUID(), limitType: 'policy_lol', currency: 'USD', maxAmount: 0, requiresApprovalAbove: true, canApproveOthers: false },
                    { id: crypto.randomUUID(), limitType: 'claim_payment', currency: 'USD', maxAmount: 0, requiresApprovalAbove: true, canApproveOthers: false }
                ]);
            }
        };
        load();
    }, [role]);

    const handleSave = async () => {
        try {
            let roleId = role?.id;
            
            // 1. Save Role Details
            if (roleId) {
                await PermissionService.updateRole(roleId, formData);
            } else {
                roleId = await PermissionService.createRole(formData);
            }

            if (!roleId) throw new Error("Role ID missing");

            // 2. Save Permissions
            await PermissionService.updateRolePermissions(roleId, selectedPermissions);

            // 3. Save Limits
            for (const limit of limits) {
                await PermissionService.updateAuthorityLimit({ ...limit, roleId });
            }

            onSave();
            onClose();
        } catch (e) {
            console.error("Failed to save role", e);
            toast.error("Error saving role");
        }
    };

    const confirmDeleteLimit = () => {
        const { index, limitId } = deleteLimitConfirm;
        setLimits(prev => prev.filter((_, i) => i !== index));
        if (limitId) PermissionService.deleteAuthorityLimit(limitId);
        setDeleteLimitConfirm({ show: false, index: -1 });
    };

    const togglePermission = (id: string) => {
        setSelectedPermissions(prev => 
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleLimitChange = (index: number, field: keyof AuthorityLimit, value: any) => {
        const newLimits = [...limits];
        newLimits[index] = { ...newLimits[index], [field]: value };
        setLimits(newLimits);
    };

    // Group permissions by module
    const groupedPermissions = allPermissions.reduce((acc, p) => {
        if (!acc[p.module]) acc[p.module] = [];
        acc[p.module].push(p);
        return acc;
    }, {} as Record<string, Permission[]>);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg">{role ? 'Edit Role' : 'Create New Role'}</h3>
                    <button onClick={onClose}><X className="text-gray-500 hover:text-gray-800" size={20}/></button>
                </div>

                <div className="flex border-b bg-white">
                    {(['details', 'permissions', 'limits'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${
                                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-white">
                    {activeTab === 'details' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Role Name</label>
                                <input 
                                    className="w-full p-2 border rounded" 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                                <textarea 
                                    className="w-full p-2 border rounded" 
                                    value={formData.description} 
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Department</label>
                                    <input 
                                        className="w-full p-2 border rounded" 
                                        value={formData.department} 
                                        onChange={e => setFormData({...formData, department: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Hierarchy Level</label>
                                    <input 
                                        type="number"
                                        className="w-full p-2 border rounded" 
                                        value={formData.level} 
                                        onChange={e => setFormData({...formData, level: Number(e.target.value)})}
                                    />
                                    <span className="text-xs text-gray-500">Lower number = Higher Authority</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <input 
                                    type="checkbox" 
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                                    className="w-5 h-5 text-blue-600 rounded"
                                />
                                <label htmlFor="isActive" className="font-medium text-gray-700">Role is Active</label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'permissions' && (
                        <div className="space-y-6">
                            {Object.entries(groupedPermissions).map(([module, perms]) => {
                                const typedPerms = perms as Permission[];
                                return (
                                <div key={module} className="border rounded-lg overflow-hidden">
                                    <div className="bg-gray-100 px-4 py-2 font-bold text-gray-700 uppercase text-xs flex justify-between items-center">
                                        {module}
                                        <span className="text-xs font-normal text-gray-500">{typedPerms.filter(p => selectedPermissions.includes(p.id)).length}/{typedPerms.length}</span>
                                    </div>
                                    <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
                                        {typedPerms.map(p => {
                                            const isSelected = selectedPermissions.includes(p.id);
                                            return (
                                                <div 
                                                    key={p.id} 
                                                    onClick={() => togglePermission(p.id)}
                                                    className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50'}`}
                                                >
                                                    <div className={`mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                                                        {isSelected ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium">{p.name}</div>
                                                        <div className="text-xs text-gray-500">{p.description}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}

                    {activeTab === 'limits' && (
                        <div className="space-y-6">
                            {limits.map((limit, idx) => (
                                <div key={limit.id || idx} className="border p-4 rounded-xl bg-gray-50">
                                    <div className="flex justify-between mb-4">
                                        <h4 className="font-bold text-gray-800 uppercase text-sm">
                                            {limit.limitType === 'policy_lol' ? 'Policy Limit of Liability' : 'Claim Payment Limit'}
                                        </h4>
                                        <button
                                            className="text-red-500 hover:text-red-700"
                                            onClick={() => setDeleteLimitConfirm({ show: true, index: idx, limitId: limit.id })}
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Max Amount</label>
                                            <input 
                                                type="number" 
                                                className="w-full p-2 border rounded font-mono"
                                                value={limit.maxAmount}
                                                onChange={e => handleLimitChange(idx, 'maxAmount', Number(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Currency</label>
                                            <select 
                                                className="w-full p-2 border rounded"
                                                value={limit.currency}
                                                onChange={e => handleLimitChange(idx, 'currency', e.target.value)}
                                            >
                                                {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox"
                                                checked={limit.canApproveOthers}
                                                onChange={e => handleLimitChange(idx, 'canApproveOthers', e.target.checked)}
                                            />
                                            <span className="text-sm">Can approve requests from lower levels</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox"
                                                checked={limit.requiresApprovalAbove}
                                                onChange={e => handleLimitChange(idx, 'requiresApprovalAbove', e.target.checked)}
                                            />
                                            <span className="text-sm">Requires approval above this limit</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button 
                                onClick={() => setLimits([...limits, { id: crypto.randomUUID(), limitType: 'custom', currency: 'USD', maxAmount: 0, requiresApprovalAbove: true, canApproveOthers: false }])}
                                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 flex items-center justify-center gap-2"
                            >
                                <Plus size={16}/> Add Limit Type
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-medium">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                        <Save size={16}/> Save Role
                    </button>
                </div>

                <ConfirmDialog
                    isOpen={deleteLimitConfirm.show}
                    title="Remove Limit"
                    message="Are you sure you want to remove this limit?"
                    onConfirm={confirmDeleteLimit}
                    onCancel={() => setDeleteLimitConfirm({ show: false, index: -1 })}
                    confirmText="Remove"
                    variant="danger"
                />
            </div>
        </div>
    );
};