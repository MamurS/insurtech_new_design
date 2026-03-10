
import React, { useState, useEffect } from 'react';
import { Department, Profile } from '../types';
import { UserService } from '../services/userService';
import { useToast } from '../context/ToastContext';
import { X, Save, Building2, Hash, Users, Loader2 } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

interface DepartmentEditModalProps {
    department?: Department;
    onClose: () => void;
    onSave: () => void;
    allUsers: Profile[];
}

export const DepartmentEditModal: React.FC<DepartmentEditModalProps> = ({ department, onClose, onSave, allUsers }) => {
    const { t } = useTheme();
    const toast = useToast();
    const [formData, setFormData] = useState<Partial<Department>>({
        name: '',
        code: '',
        description: '',
        headOfDepartment: '',
        maxStaff: 0,
        isActive: true
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (department) {
            setFormData(department);
        }
    }, [department]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await UserService.saveDepartment(formData);
            onSave();
            onClose();
        } catch (error: any) {
            toast.error('Failed to save department: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const inputBaseClass = "w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm";

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="rounded-xl w-full max-w-lg overflow-hidden" style={{ background: t.bgPanel, boxShadow: t.shadowLg }}>
                <div className="p-4 border-b flex justify-between items-center" style={{ background: t.bgCard, borderColor: t.border }}>
                    <h3 className="flex items-center gap-2" style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>
                        <Building2 size={20} style={{ color: t.accent }}/>
                        {department ? 'Edit Department' : 'Create Department'}
                    </h3>
                    <button onClick={onClose} style={{ color: t.text4 }}><X size={20}/></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>Department Name <span style={{ color: t.danger }}>*</span></label>
                            <input
                                required
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className={inputBaseClass}
                                style={{ background: t.bgPanel, borderColor: t.border, color: t.text1 }}
                                placeholder="e.g. Underwriting"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>Code <span style={{ color: t.danger }}>*</span></label>
                            <div className="relative">
                                <Hash size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: t.text4 }}/>
                                <input
                                    required
                                    value={formData.code}
                                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                    className={`${inputBaseClass} pl-8 font-mono`}
                                    style={{ background: t.bgPanel, borderColor: t.border, color: t.text1 }}
                                    placeholder="UW"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>Description</label>
                        <textarea
                            rows={3}
                            value={formData.description || ''}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            className={inputBaseClass}
                            style={{ background: t.bgPanel, borderColor: t.border, color: t.text1 }}
                            placeholder="Brief description of responsibilities..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>Head of Department</label>
                            <select
                                value={formData.headOfDepartment || ''}
                                onChange={e => setFormData({...formData, headOfDepartment: e.target.value})}
                                className={inputBaseClass}
                                style={{ background: t.bgPanel, borderColor: t.border, color: t.text1 }}
                            >
                                <option value="">Select Manager...</option>
                                {allUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.fullName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>Max Staff Capacity</label>
                            <div className="relative">
                                <Users size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: t.text4 }}/>
                                <input
                                    type="number"
                                    value={formData.maxStaff || ''}
                                    onChange={e => setFormData({...formData, maxStaff: Number(e.target.value)})}
                                    className={`${inputBaseClass} pl-8`}
                                    style={{ background: t.bgPanel, borderColor: t.border, color: t.text1 }}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive !== false}
                            onChange={e => setFormData({...formData, isActive: e.target.checked})}
                            className="w-5 h-5 rounded"
                        />
                        <label htmlFor="isActive" className="text-sm font-medium" style={{ color: t.text2 }}>Department is Active</label>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t" style={{ borderColor: t.border }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg font-medium"
                            style={{ color: t.text3 }}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-70"
                            style={{ background: t.accent, color: '#fff', boxShadow: t.shadow }}
                            disabled={loading}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
