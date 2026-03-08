
import React, { useState, useEffect } from 'react';
import { X, Loader2, User, Briefcase, AlertTriangle, Paperclip, File as FileIcon, Trash2 } from 'lucide-react';
import { useCreateTask, useUploadAttachment } from '../hooks/useAgenda';
import { useProfiles } from '../hooks/useUsers';
import { TaskPriority, EntityType } from '../types';
import { DatePickerInput, parseDate, toISODateString } from './DatePickerInput';
import { ContextBar } from './ContextBar';

interface AssignTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Pre-filled entity info if triggered from a detail page
    entityType?: EntityType;
    entityId?: string;
    entityReference?: string; // Policy Number, etc.
    preSelectedUser?: string;
}

const AssignTaskModal: React.FC<AssignTaskModalProps> = ({ 
    isOpen, onClose, entityType, entityId, entityReference, preSelectedUser 
}) => {
    const createTaskMutation = useCreateTask();
    const uploadAttachmentMutation = useUploadAttachment();
    const { data: profiles, isLoading: loadingProfiles } = useProfiles();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [assignedTo, setAssignedTo] = useState(preSelectedUser || '');
    const [errorMsg, setErrorMsg] = useState('');
    
    // File Upload State
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setTitle(entityReference ? `Review: ${entityReference}` : '');
            setDescription('');
            setPriority('MEDIUM');
            setDueDate(null);
            setAssignedTo(preSelectedUser || '');
            setErrorMsg('');
            setSelectedFiles([]);
            setIsSubmitting(false);
            setUploadStatus('');
        }
    }, [isOpen, entityReference, preSelectedUser]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !assignedTo) return;
        setErrorMsg('');
        setIsSubmitting(true);

        try {
            // 1. Create Task
            const taskId = await createTaskMutation.mutateAsync({
                title,
                description,
                priority,
                dueDate: toISODateString(dueDate) || undefined,
                assignedTo,
                entityType: entityType || 'OTHER',
                entityId,
                policyNumber: entityType === 'POLICY' ? entityReference : undefined
            });

            // 2. Upload Files if any
            if (selectedFiles.length > 0 && taskId) {
                setUploadStatus(`Uploading ${selectedFiles.length} attachments...`);
                for (const file of selectedFiles) {
                    await uploadAttachmentMutation.mutateAsync({
                        taskId,
                        file
                    });
                }
            }

            onClose();
        } catch (err: any) {
            console.error("Task creation failed", err);
            setErrorMsg(err.message || "Failed to create task. Please try again.");
        } finally {
            setIsSubmitting(false);
            setUploadStatus('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h3 className="font-bold text-gray-800 text-lg">Create New Task</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>
                
                <ContextBar
                    status="NEW"
                    breadcrumbs={[
                        { label: 'Agenda' },
                        { label: 'Assign New Task' }
                    ]}
                />

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 flex items-center gap-2">
                            <AlertTriangle size={16} className="shrink-0"/>
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {entityReference && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800 flex items-center gap-2">
                            <Briefcase size={16}/>
                            Linked to: <strong>{entityReference}</strong>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Task Title <span className="text-red-500">*</span></label>
                        <input 
                            required
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g., Review slip conditions"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Assign To <span className="text-red-500">*</span></label>
                        {loadingProfiles ? (
                            <div className="text-gray-500 text-sm"><Loader2 className="animate-spin inline mr-2"/> Loading users...</div>
                        ) : (
                            <select 
                                required
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                value={assignedTo}
                                onChange={e => setAssignedTo(e.target.value)}
                            >
                                <option value="">Select User...</option>
                                {profiles?.map(p => (
                                    <option key={p.id} value={p.id}>{p.fullName} ({p.role})</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Priority</label>
                            <select 
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                value={priority}
                                onChange={e => setPriority(e.target.value as TaskPriority)}
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>
                        <DatePickerInput
                            label="Due Date"
                            value={dueDate}
                            onChange={setDueDate}
                            minDate={new Date()}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                        <textarea 
                            rows={3}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Add details here..."
                        />
                    </div>

                    {/* Attachments Section */}
                    <div className="border-t pt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Paperclip size={16}/> Attachments
                        </label>
                        <div className="space-y-2">
                            {selectedFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200 text-sm">
                                    <span className="truncate flex-1 flex items-center gap-2">
                                        <FileIcon size={14} className="text-gray-400"/> {file.name}
                                    </span>
                                    <button type="button" onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            ))}
                            <label className="flex items-center justify-center w-full p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <div className="text-center text-sm text-gray-500">
                                    <span className="text-blue-600 font-medium">+ Add Files</span>
                                </div>
                                <input type="file" className="hidden" multiple onChange={handleFileSelect} />
                            </label>
                        </div>
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-3">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isSubmitting || !title || !assignedTo}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : null}
                            {uploadStatus ? uploadStatus : 'Assign Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AssignTaskModal;
