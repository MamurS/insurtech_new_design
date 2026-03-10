
import React, { useState } from 'react';
import { X, Calendar, User, CheckCircle, Trash2, Paperclip, Download, FileText, Image, File as FileIcon, Loader2, ArrowRight } from 'lucide-react';
import { AgendaTask, TaskStatus, TaskPriority } from '../types';
import { formatDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
import { useUpdateTaskStatus, useDeleteTask, useTaskAttachments, useUploadAttachment, useDeleteAttachment } from '../hooks/useAgenda';
import { useTheme } from '../theme/useTheme';

interface TaskDetailModalProps {
    task: AgendaTask | null;
    isOpen: boolean;
    onClose: () => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, isOpen, onClose }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [deleteTaskConfirm, setDeleteTaskConfirm] = useState(false);
    const [deleteAttachmentConfirm, setDeleteAttachmentConfirm] = useState<string | null>(null);
    const toast = useToast();
    const { t } = useTheme();

    // Hooks
    const updateStatusMutation = useUpdateTaskStatus();
    const deleteTaskMutation = useDeleteTask();
    const { data: attachments, isLoading: loadingAttachments } = useTaskAttachments(task?.id || '');
    const uploadAttachmentMutation = useUploadAttachment();
    const deleteAttachmentMutation = useDeleteAttachment();

    if (!isOpen || !task) return null;

    const handleStatusChange = (newStatus: TaskStatus) => {
        updateStatusMutation.mutate({ id: task.id, status: newStatus }, {
            onSuccess: onClose // Close on completion? Or keep open? Let's close for now or refresh
        });
    };

    const handleDeleteTask = () => {
        setDeleteTaskConfirm(true);
    };

    const confirmDeleteTask = () => {
        deleteTaskMutation.mutate(task.id, {
            onSuccess: onClose
        });
        setDeleteTaskConfirm(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsUploading(true);
            try {
                // Upload sequentially
                for (let i = 0; i < e.target.files.length; i++) {
                    await uploadAttachmentMutation.mutateAsync({
                        taskId: task.id,
                        file: e.target.files[i]
                    });
                }
            } catch (err) {
                console.error("Upload failed", err);
                toast.error("Failed to upload file(s).");
            } finally {
                setIsUploading(false);
                // Clear input
                e.target.value = '';
            }
        }
    };

    const handleDeleteFile = (id: string) => {
        setDeleteAttachmentConfirm(id);
    };

    const confirmDeleteAttachment = () => {
        if (deleteAttachmentConfirm) {
            deleteAttachmentMutation.mutate({ attachmentId: deleteAttachmentConfirm, taskId: task.id });
            setDeleteAttachmentConfirm(null);
        }
    };

    const getPriorityBadge = (p: TaskPriority) => {
        const styles: Record<string, React.CSSProperties> = {
            'LOW': { background: t.bgInput, color: t.text3, border: `1px solid ${t.border}` },
            'MEDIUM': { background: `${t.accent}18`, color: t.accent, border: `1px solid ${t.accent}40` },
            'HIGH': { background: t.warningBg, color: t.warning, border: `1px solid ${t.warning}40` },
            'URGENT': { background: t.dangerBg, color: t.danger, border: `1px solid ${t.danger}40` }
        };
        return <span className="px-2 py-1 text-xs font-bold" style={{ ...styles[p], borderRadius: 20 }}>{p}</span>;
    };

    const getStatusBadge = (s: TaskStatus) => {
        const styles: Record<string, React.CSSProperties> = {
            'PENDING': { background: t.warningBg, color: t.warning, border: `1px solid ${t.warning}40` },
            'IN_PROGRESS': { background: `${t.accent}18`, color: t.accent, border: `1px solid ${t.accent}40` },
            'COMPLETED': { background: t.successBg, color: t.success, border: `1px solid ${t.success}40` },
            'CANCELLED': { background: t.bgInput, color: t.text3, border: `1px solid ${t.border}` }
        };
        return <span className="px-3 py-1 text-xs font-bold" style={{ ...styles[s], borderRadius: 20 }}>{s.replace('_', ' ')}</span>;
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getFileIcon = (type?: string) => {
        if (type?.includes('image')) return <Image size={16} style={{ color: '#9333ea' }}/>;
        if (type?.includes('pdf')) return <FileText size={16} style={{ color: t.danger }}/>;
        return <FileIcon size={16} style={{ color: t.text4 }}/>;
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200" style={{ background: t.bgPanel, borderRadius: 12, boxShadow: t.shadowLg }}>
                {/* Header */}
                <div className="p-6 flex justify-between items-start" style={{ background: t.bgInput, borderBottom: `1px solid ${t.border}`, borderRadius: '12px 12px 0 0' }}>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            {getPriorityBadge(task.priority)}
                            {getStatusBadge(task.status)}
                        </div>
                        <h2 style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{task.title}</h2>
                    </div>
                    <button onClick={onClose} style={{ color: t.text4 }}><X size={20}/></button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-sm p-4 rounded-lg" style={{ color: t.text3, background: t.bgInput, border: `1px solid ${t.border}` }}>
                        <div className="flex items-center gap-2">
                            <User size={16} style={{ color: t.text4 }}/>
                            <span>Assigned to: <strong style={{ color: t.text1 }}>{task.assignedToName || 'Unassigned'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <User size={16} style={{ color: t.text4 }}/>
                            <span>From: <strong style={{ color: t.text1 }}>{task.assignedByName || 'System'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar size={16} style={{ color: t.text4 }}/>
                            <span>Due: <span style={task.isOverdue ? { color: t.danger, fontWeight: 700 } : undefined}>{formatDate(task.dueDate)}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar size={16} style={{ color: t.text4 }}/>
                            <span>Created: {formatDate(task.createdAt)}</span>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <h3 className="font-bold mb-2 text-sm uppercase tracking-wide" style={{ color: t.text1 }}>Description</h3>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: t.text2 }}>
                            {task.description || "No description provided."}
                        </p>
                    </div>

                    {/* Attachments */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2" style={{ color: t.text1 }}>
                                <Paperclip size={16}/> Attachments
                            </h3>
                            <label className={`cursor-pointer text-xs font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`} style={{ color: t.accent }}>
                                {isUploading ? <Loader2 size={12} className="animate-spin"/> : <div className="flex items-center gap-1">+ Add File</div>}
                                <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                            </label>
                        </div>

                        {loadingAttachments ? (
                            <div className="text-center py-4 text-xs" style={{ color: t.text4 }}><Loader2 className="animate-spin inline mr-1"/> Loading files...</div>
                        ) : (!attachments || attachments.length === 0) ? (
                            <div className="text-center py-6 rounded-lg text-xs" style={{ border: `2px dashed ${t.borderL}`, color: t.text4 }}>
                                No attachments found.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {attachments.map(file => (
                                    <div key={file.id} className="flex items-center justify-between p-3 rounded-lg transition-colors group" style={{ background: t.bgInput, border: `1px solid ${t.border}` }}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-2 rounded shrink-0" style={{ background: t.bgPanel, border: `1px solid ${t.border}` }}>
                                                {getFileIcon(file.fileType)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium truncate" style={{ color: t.text1 }} title={file.fileName}>{file.fileName}</div>
                                                <div className="text-xs" style={{ color: t.text4 }}>{formatFileSize(file.fileSize)} • {formatDate(file.uploadedAt)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <a
                                                href={file.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 rounded transition-colors"
                                                title="Download"
                                                style={{ color: t.text4 }}
                                            >
                                                <Download size={16}/>
                                            </a>
                                            <button
                                                onClick={() => handleDeleteFile(file.id)}
                                                className="p-2 rounded transition-colors"
                                                title="Delete"
                                                style={{ color: t.text4 }}
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 flex justify-between items-center" style={{ borderTop: `1px solid ${t.border}`, background: t.bgInput, borderRadius: '0 0 12px 12px' }}>
                    <button
                        onClick={handleDeleteTask}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        style={{ color: t.danger }}
                    >
                        <Trash2 size={16}/> Delete Task
                    </button>

                    <div className="flex gap-2">
                        {task.status !== 'COMPLETED' ? (
                            <button
                                onClick={() => handleStatusChange('COMPLETED')}
                                className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                                style={{ background: t.success, color: '#fff', boxShadow: t.shadow }}
                            >
                                <CheckCircle size={16}/> Mark Complete
                            </button>
                        ) : (
                            <button
                                onClick={() => handleStatusChange('PENDING')}
                                className="px-4 py-2 rounded-lg text-sm font-medium"
                                style={{ background: t.bgPanel, border: `1px solid ${t.borderL}`, color: t.text2 }}
                            >
                                Reopen Task
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm Dialogs */}
            <ConfirmDialog
                isOpen={deleteTaskConfirm}
                title="Delete Task"
                message="Are you sure you want to delete this task? This action cannot be undone."
                onConfirm={confirmDeleteTask}
                onCancel={() => setDeleteTaskConfirm(false)}
                confirmText="Delete"
                variant="danger"
            />

            <ConfirmDialog
                isOpen={!!deleteAttachmentConfirm}
                title="Remove Attachment"
                message="Are you sure you want to remove this attachment?"
                onConfirm={confirmDeleteAttachment}
                onCancel={() => setDeleteAttachmentConfirm(null)}
                confirmText="Remove"
                variant="danger"
            />
        </div>
    );
};

export default TaskDetailModal;
