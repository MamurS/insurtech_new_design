
import React, { useState } from 'react';
import { X, Calendar, User, CheckCircle, Trash2, Paperclip, Download, FileText, Image, File as FileIcon, Loader2, ArrowRight } from 'lucide-react';
import { AgendaTask, TaskStatus, TaskPriority } from '../types';
import { formatDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
import { useUpdateTaskStatus, useDeleteTask, useTaskAttachments, useUploadAttachment, useDeleteAttachment } from '../hooks/useAgenda';

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
        const colors = {
            'LOW': 'bg-gray-100 text-gray-700',
            'MEDIUM': 'bg-blue-100 text-blue-700',
            'HIGH': 'bg-orange-100 text-orange-700',
            'URGENT': 'bg-red-100 text-red-700'
        };
        return <span className={`px-2 py-1 rounded text-xs font-bold ${colors[p]}`}>{p}</span>;
    };

    const getStatusBadge = (s: TaskStatus) => {
        const colors = {
            'PENDING': 'bg-yellow-50 text-yellow-700 border-yellow-200',
            'IN_PROGRESS': 'bg-blue-50 text-blue-700 border-blue-200',
            'COMPLETED': 'bg-green-50 text-green-700 border-green-200',
            'CANCELLED': 'bg-gray-50 text-gray-700 border-gray-200'
        };
        return <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colors[s]}`}>{s.replace('_', ' ')}</span>;
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getFileIcon = (type?: string) => {
        if (type?.includes('image')) return <Image size={16} className="text-purple-500"/>;
        if (type?.includes('pdf')) return <FileText size={16} className="text-red-500"/>;
        return <FileIcon size={16} className="text-gray-500"/>;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-start bg-gray-50 rounded-t-xl">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            {getPriorityBadge(task.priority)}
                            {getStatusBadge(task.status)}
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">{task.title}</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2">
                            <User size={16} className="text-gray-400"/>
                            <span>Assigned to: <strong>{task.assignedToName || 'Unassigned'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <User size={16} className="text-gray-400"/>
                            <span>From: <strong>{task.assignedByName || 'System'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400"/>
                            <span>Due: <span className={task.isOverdue ? 'text-red-600 font-bold' : ''}>{formatDate(task.dueDate)}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400"/>
                            <span>Created: {formatDate(task.createdAt)}</span>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <h3 className="font-bold text-gray-800 mb-2 text-sm uppercase tracking-wide">Description</h3>
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                            {task.description || "No description provided."}
                        </p>
                    </div>

                    {/* Attachments */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
                                <Paperclip size={16}/> Attachments
                            </h3>
                            <label className={`cursor-pointer text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center gap-1 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                {isUploading ? <Loader2 size={12} className="animate-spin"/> : <div className="flex items-center gap-1">+ Add File</div>}
                                <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                            </label>
                        </div>

                        {loadingAttachments ? (
                            <div className="text-center py-4 text-gray-400 text-xs"><Loader2 className="animate-spin inline mr-1"/> Loading files...</div>
                        ) : (!attachments || attachments.length === 0) ? (
                            <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-lg text-gray-400 text-xs">
                                No attachments found.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {attachments.map(file => (
                                    <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-2 bg-white rounded border border-gray-200 shrink-0">
                                                {getFileIcon(file.fileType)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-gray-800 truncate" title={file.fileName}>{file.fileName}</div>
                                                <div className="text-xs text-gray-500">{formatFileSize(file.fileSize)} • {formatDate(file.uploadedAt)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <a 
                                                href={file.fileUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition-colors"
                                                title="Download"
                                            >
                                                <Download size={16}/>
                                            </a>
                                            <button 
                                                onClick={() => handleDeleteFile(file.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                                                title="Delete"
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
                <div className="p-4 border-t bg-gray-50 flex justify-between items-center rounded-b-xl">
                    <button 
                        onClick={handleDeleteTask}
                        className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                        <Trash2 size={16}/> Delete Task
                    </button>
                    
                    <div className="flex gap-2">
                        {task.status !== 'COMPLETED' ? (
                            <button 
                                onClick={() => handleStatusChange('COMPLETED')}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2"
                            >
                                <CheckCircle size={16}/> Mark Complete
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleStatusChange('PENDING')}
                                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium"
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
