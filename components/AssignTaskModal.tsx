
import React, { useState, useEffect } from 'react';
import { X, Loader2, User, Briefcase, AlertTriangle, Paperclip, File as FileIcon, Trash2 } from 'lucide-react';
import { useCreateTask, useUploadAttachment } from '../hooks/useAgenda';
import { useProfiles } from '../hooks/useUsers';
import { TaskPriority, EntityType } from '../types';
import { DatePickerInput, parseDate, toISODateString } from './DatePickerInput';
import { ContextBar } from './ContextBar';
import { useTheme } from '../theme/useTheme';

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
    const { t } = useTheme();

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

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13 };
    const selectStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text1, fontSize: 13 };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-200" style={{ background: t.bgPanel, borderRadius: 12, boxShadow: t.shadowLg }}>
                <div className="p-5 flex justify-between items-center rounded-t-xl" style={{ background: t.bgInput, borderBottom: `1px solid ${t.border}` }}>
                    <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>Create New Task</h3>
                    <button onClick={onClose} style={{ color: t.text4 }}><X size={20}/></button>
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
                        <div className="p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: t.dangerBg, color: t.danger, border: `1px solid ${t.danger}30` }}>
                            <AlertTriangle size={16} className="shrink-0"/>
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {entityReference && (
                        <div className="p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: `${t.accent}18`, color: t.accent, border: `1px solid ${t.accent}30` }}>
                            <Briefcase size={16}/>
                            Linked to: <strong>{entityReference}</strong>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm mb-1" style={{ color: t.text2, fontWeight: 700 }}>Task Title <span style={{ color: t.danger }}>*</span></label>
                        <input
                            required
                            style={inputStyle}
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g., Review slip conditions"
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1" style={{ color: t.text2, fontWeight: 700 }}>Assign To <span style={{ color: t.danger }}>*</span></label>
                        {loadingProfiles ? (
                            <div className="text-sm" style={{ color: t.text4 }}><Loader2 className="animate-spin inline mr-2"/> Loading users...</div>
                        ) : (
                            <select
                                required
                                style={selectStyle}
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
                            <label className="block text-sm mb-1" style={{ color: t.text2, fontWeight: 700 }}>Priority</label>
                            <select
                                style={selectStyle}
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
                        <label className="block text-sm mb-1" style={{ color: t.text2, fontWeight: 700 }}>Description</label>
                        <textarea
                            rows={3}
                            style={{ ...inputStyle, resize: 'none' }}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Add details here..."
                        />
                    </div>

                    {/* Attachments Section */}
                    <div className="pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
                        <label className="block text-sm mb-2 flex items-center gap-2" style={{ color: t.text2, fontWeight: 700 }}>
                            <Paperclip size={16}/> Attachments
                        </label>
                        <div className="space-y-2">
                            {selectedFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded text-sm" style={{ background: t.bgInput, border: `1px solid ${t.border}` }}>
                                    <span className="truncate flex-1 flex items-center gap-2">
                                        <FileIcon size={14} style={{ color: t.text4 }}/> {file.name}
                                    </span>
                                    <button type="button" onClick={() => removeFile(idx)} style={{ color: t.text4 }}>
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            ))}
                            <label className="flex items-center justify-center w-full p-3 rounded-lg cursor-pointer transition-colors" style={{ border: `2px dashed ${t.borderL}` }}>
                                <div className="text-center text-sm" style={{ color: t.text4 }}>
                                    <span style={{ color: t.accent, fontWeight: 500 }}>+ Add Files</span>
                                </div>
                                <input type="file" className="hidden" multiple onChange={handleFileSelect} />
                            </label>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3" style={{ borderTop: `1px solid ${t.border}` }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm"
                            style={{ color: t.text3, fontWeight: 500 }}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !title || !assignedTo}
                            className="px-6 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                            style={{ background: t.accent, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
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
