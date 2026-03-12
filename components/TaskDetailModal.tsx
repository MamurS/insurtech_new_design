
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
        return <span style={{ ...styles[p], paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: 12, borderRadius: 20, fontWeight: 700 }}>{p}</span>;
    };

    const getStatusBadge = (s: TaskStatus) => {
        const styles: Record<string, React.CSSProperties> = {
            'PENDING': { background: t.warningBg, color: t.warning, border: `1px solid ${t.warning}40` },
            'IN_PROGRESS': { background: `${t.accent}18`, color: t.accent, border: `1px solid ${t.accent}40` },
            'COMPLETED': { background: t.successBg, color: t.success, border: `1px solid ${t.success}40` },
            'CANCELLED': { background: t.bgInput, color: t.text3, border: `1px solid ${t.border}` }
        };
        return <span style={{ ...styles[s], paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, fontSize: 12, borderRadius: 20, fontWeight: 700 }}>{s.replace('_', ' ')}</span>;
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
        <div className="backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.5)' }}>
            <div className="animate-in fade-in zoom-in" style={{ width: '100%', maxWidth: 672, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: t.bgPanel, borderRadius: 12, boxShadow: t.shadowLg }}>
                {/* Header */}
                <div style={{ padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: t.bgInput, borderBottom: `1px solid ${t.border}`, borderRadius: '12px 12px 0 0' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            {getPriorityBadge(task.priority)}
                            {getStatusBadge(task.status)}
                        </div>
                        <h2 style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>{task.title}</h2>
                    </div>
                    <button onClick={onClose} style={{ color: t.text4 }}><X size={20}/></button>
                </div>

                {/* Body */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Metadata */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: 14, padding: 16, borderRadius: 8, color: t.text3, background: t.bgInput, border: `1px solid ${t.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User size={16} style={{ color: t.text4 }}/>
                            <span>Assigned to: <strong style={{ color: t.text1 }}>{task.assignedToName || 'Unassigned'}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User size={16} style={{ color: t.text4 }}/>
                            <span>From: <strong style={{ color: t.text1 }}>{task.assignedByName || 'System'}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={16} style={{ color: t.text4 }}/>
                            <span>Due: <span style={task.isOverdue ? { color: t.danger, fontWeight: 700 } : undefined}>{formatDate(task.dueDate)}</span></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={16} style={{ color: t.text4 }}/>
                            <span>Created: {formatDate(task.createdAt)}</span>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <h3 style={{ marginBottom: 8, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text1, fontWeight: 700 }}>Description</h3>
                        <p style={{ fontSize: 14, lineHeight: 1.625, whiteSpace: 'pre-wrap', color: t.text2 }}>
                            {task.description || "No description provided."}
                        </p>
                    </div>

                    {/* Attachments */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8, color: t.text1, fontWeight: 700 }}>
                                <Paperclip size={16}/> Attachments
                            </h3>
                            <label style={{ cursor: 'pointer', fontSize: 12, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4, color: t.accent, fontWeight: 700, ...(isUploading ? { opacity: 0.5, pointerEvents: 'none' as const } : {}) }}>
                                {isUploading ? <Loader2 size={12} className="animate-spin"/> : <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>+ Add File</div>}
                                <input type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} disabled={isUploading}/>
                            </label>
                        </div>

                        {loadingAttachments ? (
                            <div style={{ textAlign: 'center', paddingTop: 16, paddingBottom: 16, fontSize: 12, color: t.text4 }}><Loader2 className="animate-spin" style={{ display: 'inline', marginRight: 4 }}/> Loading files...</div>
                        ) : (!attachments || attachments.length === 0) ? (
                            <div style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 24, borderRadius: 8, fontSize: 12, border: `2px dashed ${t.borderL}`, color: t.text4 }}>
                                No attachments found.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {attachments.map(file => (
                                    <div key={file.id} className="transition-colors" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, background: t.bgInput, border: `1px solid ${t.border}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                                            <div style={{ padding: 8, borderRadius: 4, flexShrink: 0, background: t.bgPanel, border: `1px solid ${t.border}` }}>
                                                {getFileIcon(file.fileType)}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text1, fontWeight: 500 }} title={file.fileName}>{file.fileName}</div>
                                                <div style={{ fontSize: 12, color: t.text4 }}>{formatFileSize(file.fileSize)} • {formatDate(file.uploadedAt)}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <a
                                                href={file.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="transition-colors"
                                                title="Download"
                                                style={{ padding: 8, borderRadius: 4, color: t.text4 }}
                                            >
                                                <Download size={16}/>
                                            </a>
                                            <button
                                                onClick={() => handleDeleteFile(file.id)}
                                                className="transition-colors"
                                                title="Delete"
                                                style={{ padding: 8, borderRadius: 4, color: t.text4 }}
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
                <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${t.border}`, background: t.bgInput, borderRadius: '0 0 12px 12px' }}>
                    <button
                        onClick={handleDeleteTask}
                        className="transition-colors"
                        style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: t.danger, fontWeight: 500 }}
                    >
                        <Trash2 size={16}/> Delete Task
                    </button>

                    <div style={{ display: 'flex', gap: 8 }}>
                        {task.status !== 'COMPLETED' ? (
                            <button
                                onClick={() => handleStatusChange('COMPLETED')}
                                style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, background: t.success, color: '#fff', boxShadow: t.shadow, fontWeight: 700 }}
                            >
                                <CheckCircle size={16}/> Mark Complete
                            </button>
                        ) : (
                            <button
                                onClick={() => handleStatusChange('PENDING')}
                                style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, background: t.bgPanel, border: `1px solid ${t.borderL}`, color: t.text2, fontWeight: 500 }}
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
