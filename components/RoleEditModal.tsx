import React, { useState, useEffect } from 'react';
import { Role, Permission, AuthorityLimit, Currency } from '../types';
import { PermissionService } from '../services/permissionService';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
import { X, Save, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

interface RoleEditModalProps {
    role?: Role;
    onClose: () => void;
    onSave: () => void;
}

export const RoleEditModal: React.FC<RoleEditModalProps> = ({ role, onClose, onSave }) => {
    const { t } = useTheme();
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
        <div className="backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
            <div style={{ borderRadius: 12, width: '100%', maxWidth: 672, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowLg }}>
                <div style={{ padding: 16, borderBottom: '1px solid', borderColor: t.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.bgCard }}>
                    <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{role ? 'Edit Role' : 'Create New Role'}</h3>
                    <button onClick={onClose}><X style={{ color: t.text4 }} size={20}/></button>
                </div>

                <div style={{ display: 'flex', borderBottom: '1px solid', borderColor: t.border, background: t.bgPanel }}>
                    {(['details', 'permissions', 'limits'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className="transition-colors"
                            style={{
                                flex: 1,
                                paddingTop: 12,
                                paddingBottom: 12,
                                fontSize: 14,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '2px solid',
                                borderColor: activeTab === tab ? t.accent : 'transparent',
                                color: activeTab === tab ? t.accent : t.text4,
                                fontWeight: 700
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: t.bgPanel }}>
                    {activeTab === 'details' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, marginBottom: 4, color: t.text2, fontWeight: 700 }}>Role Name</label>
                                <input
                                    style={{ width: '100%', padding: 8, border: '1px solid', borderRadius: 4, borderColor: t.border, background: t.bgPanel, color: t.text1 }}
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, marginBottom: 4, color: t.text2, fontWeight: 700 }}>Description</label>
                                <textarea
                                    style={{ width: '100%', padding: 8, border: '1px solid', borderRadius: 4, borderColor: t.border, background: t.bgPanel, color: t.text1 }}
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, marginBottom: 4, color: t.text2, fontWeight: 700 }}>Department</label>
                                    <input
                                        style={{ width: '100%', padding: 8, border: '1px solid', borderRadius: 4, borderColor: t.border, background: t.bgPanel, color: t.text1 }}
                                        value={formData.department}
                                        onChange={e => setFormData({...formData, department: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, marginBottom: 4, color: t.text2, fontWeight: 700 }}>Hierarchy Level</label>
                                    <input
                                        type="number"
                                        style={{ width: '100%', padding: 8, border: '1px solid', borderRadius: 4, borderColor: t.border, background: t.bgPanel, color: t.text1 }}
                                        value={formData.level}
                                        onChange={e => setFormData({...formData, level: Number(e.target.value)})}
                                    />
                                    <span style={{ fontSize: 12, color: t.text4 }}>Lower number = Higher Authority</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                                    style={{ width: 20, height: 20, borderRadius: 4 }}
                                />
                                <label htmlFor="isActive" style={{ color: t.text2, fontWeight: 500 }}>Role is Active</label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'permissions' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {Object.entries(groupedPermissions).map(([module, perms]) => {
                                const typedPerms = perms as Permission[];
                                return (
                                <div key={module} style={{ border: '1px solid', borderRadius: 8, overflow: 'hidden', borderColor: t.border }}>
                                    <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, textTransform: 'uppercase', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.bgCard, color: t.text2, fontWeight: 700 }}>
                                        {module}
                                        <span style={{ fontSize: 12, fontWeight: 400, color: t.text4 }}>{typedPerms.filter(p => selectedPermissions.includes(p.id)).length}/{typedPerms.length}</span>
                                    </div>
                                    <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, background: t.bgPanel }}>
                                        {typedPerms.map(p => {
                                            const isSelected = selectedPermissions.includes(p.id);
                                            return (
                                                <div
                                                    key={p.id}
                                                    onClick={() => togglePermission(p.id)}
                                                    className="transition-colors"
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: 8,
                                                        padding: 8,
                                                        borderRadius: 4,
                                                        cursor: 'pointer',
                                                        ...(isSelected ? { background: t.accent + '18', color: t.accent } : {})
                                                    }}
                                                >
                                                    <div style={{ marginTop: 2, color: isSelected ? t.accent : t.text4 }}>
                                                        {isSelected ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                                                        <div style={{ fontSize: 12, color: t.text4 }}>{p.description}</div>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {limits.map((limit, idx) => (
                                <div key={limit.id || idx} style={{ border: '1px solid', padding: 16, borderRadius: 12, background: t.bgCard, borderColor: t.border }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h4 style={{ textTransform: 'uppercase', fontSize: 14, color: t.text1, fontWeight: 700 }}>
                                            {limit.limitType === 'policy_lol' ? 'Policy Limit of Liability' : 'Claim Payment Limit'}
                                        </h4>
                                        <button
                                            style={{ color: t.danger }}
                                            onClick={() => setDeleteLimitConfirm({ show: true, index: idx, limitId: limit.id })}
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: t.text4, fontWeight: 700 }}>Max Amount</label>
                                            <input
                                                type="number"
                                                style={{ width: '100%', padding: 8, border: '1px solid', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", borderColor: t.border, background: t.bgPanel, color: t.text1 }}
                                                value={limit.maxAmount}
                                                onChange={e => handleLimitChange(idx, 'maxAmount', Number(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: t.text4, fontWeight: 700 }}>Currency</label>
                                            <select
                                                style={{ width: '100%', padding: 8, border: '1px solid', borderRadius: 4, borderColor: t.border, background: t.bgPanel, color: t.text1 }}
                                                value={limit.currency}
                                                onChange={e => handleLimitChange(idx, 'currency', e.target.value)}
                                            >
                                                {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input
                                                type="checkbox"
                                                checked={limit.canApproveOthers}
                                                onChange={e => handleLimitChange(idx, 'canApproveOthers', e.target.checked)}
                                            />
                                            <span style={{ fontSize: 14, color: t.text2 }}>Can approve requests from lower levels</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input
                                                type="checkbox"
                                                checked={limit.requiresApprovalAbove}
                                                onChange={e => handleLimitChange(idx, 'requiresApprovalAbove', e.target.checked)}
                                            />
                                            <span style={{ fontSize: 14, color: t.text2 }}>Requires approval above this limit</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => setLimits([...limits, { id: crypto.randomUUID(), limitType: 'custom', currency: 'USD', maxAmount: 0, requiresApprovalAbove: true, canApproveOthers: false }])}
                                style={{ width: '100%', paddingTop: 8, paddingBottom: 8, border: '2px dashed', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderColor: t.borderL, color: t.text4 }}
                            >
                                <Plus size={16}/> Add Limit Type
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ padding: 16, borderTop: '1px solid', borderColor: t.border, display: 'flex', justifyContent: 'flex-end', gap: 12, background: t.bgCard }}>
                    <button onClick={onClose} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 4, color: t.text3, fontWeight: 500 }}>Cancel</button>
                    <button onClick={handleSave} style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 8, paddingBottom: 8, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, background: t.accent, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}>
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
