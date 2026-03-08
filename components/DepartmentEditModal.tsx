
import React, { useState, useEffect } from 'react';
import { Department, Profile } from '../types';
import { UserService } from '../services/userService';
import { useToast } from '../context/ToastContext';
import { X, Save, Building2, Hash, Users, Loader2 } from 'lucide-react';

interface DepartmentEditModalProps {
    department?: Department;
    onClose: () => void;
    onSave: () => void;
    allUsers: Profile[];
}

export const DepartmentEditModal: React.FC<DepartmentEditModalProps> = ({ department, onClose, onSave, allUsers }) => {
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

    const inputClass = "w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900";
    const labelClass = "block text-sm font-bold text-gray-700 mb-1";

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <Building2 size={20} className="text-blue-600"/>
                        {department ? 'Edit Department' : 'Create Department'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className={labelClass}>Department Name <span className="text-red-500">*</span></label>
                            <input 
                                required
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className={inputClass}
                                placeholder="e.g. Underwriting"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Code <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Hash size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                                <input 
                                    required
                                    value={formData.code}
                                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                    className={`${inputClass} pl-8 font-mono`}
                                    placeholder="UW"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Description</label>
                        <textarea 
                            rows={3}
                            value={formData.description || ''}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            className={inputClass}
                            placeholder="Brief description of responsibilities..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Head of Department</label>
                            <select 
                                value={formData.headOfDepartment || ''}
                                onChange={e => setFormData({...formData, headOfDepartment: e.target.value})}
                                className={inputClass}
                            >
                                <option value="">Select Manager...</option>
                                {allUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.fullName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Max Staff Capacity</label>
                            <div className="relative">
                                <Users size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                                <input 
                                    type="number"
                                    value={formData.maxStaff || ''}
                                    onChange={e => setFormData({...formData, maxStaff: Number(e.target.value)})}
                                    className={`${inputClass} pl-8`}
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
                            className="w-5 h-5 text-blue-600 rounded"
                        />
                        <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Department is Active</label>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t">
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm flex items-center gap-2 disabled:opacity-70"
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
