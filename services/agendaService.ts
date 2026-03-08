
import { supabase } from './supabase';
import { AuthService } from './auth';
import { AgendaTask, TaskStatus, ActivityLogEntry, TaskAttachment } from '../types';

export const AgendaService = {
    // Fetch tasks using RPC for joined data
    getTasks: async (userId?: string, status?: string): Promise<AgendaTask[]> => {
        if (!supabase) return [];
        
        const { data, error } = await supabase.rpc('get_agenda_tasks', {
            p_user_id: userId || null,
            p_status: status === 'ALL' ? null : status
        });

        if (error) {
            console.error("Error fetching tasks:", error);
            return [];
        }

        return (data || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
            dueDate: t.due_date,
            assignedTo: t.assigned_to,
            assignedToName: t.assigned_to_name,
            assignedByName: t.assigned_by_name,
            assignedAt: t.assigned_at,
            entityType: t.entity_type,
            entityId: t.entity_id,
            policyNumber: t.policy_number,
            insuredName: t.insured_name,
            brokerName: t.broker_name,
            createdAt: t.created_at,
            isOverdue: t.is_overdue
        }));
    },

    createTask: async (task: Partial<AgendaTask>): Promise<string> => {
        if (!supabase) throw new Error("No database connection");
        
        // Get current user (supports local admin or supabase user)
        const user = await AuthService.getSession();
        const currentUserId = user?.id;
        
        const payload = {
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: 'PENDING',
            due_date: task.dueDate ? new Date(task.dueDate).toISOString() : null,
            assigned_to: task.assignedTo,
            assigned_by: currentUserId,
            entity_type: task.entityType || 'OTHER',
            entity_id: task.entityId,
            policy_number: task.policyNumber,
            insured_name: task.insuredName,
            broker_name: task.brokerName,
            created_by: currentUserId
        };

        const { data, error } = await supabase.from('agenda_tasks').insert(payload).select('id').single();
        if (error) {
            console.error("Create Task Error:", error);
            throw error;
        }
        return data.id;
    },

    updateTaskStatus: async (taskId: string, status: TaskStatus) => {
        if (!supabase) return;
        
        const user = await AuthService.getSession();
        
        const updates: any = { status, updated_at: new Date().toISOString() };
        if (status === 'COMPLETED') {
            updates.completed_at = new Date().toISOString();
            updates.completed_by = user?.id;
        }

        const { error } = await supabase.from('agenda_tasks').update(updates).eq('id', taskId);
        if (error) throw error;
    },

    markTaskInProgress: async (taskId: string): Promise<void> => {
        if (!supabase) return;
        
        // Update status to IN_PROGRESS only if it is currently PENDING.
        // This avoids resetting COMPLETED tasks or redundant updates.
        const { error } = await supabase
            .from('agenda_tasks')
            .update({ 
                status: 'IN_PROGRESS',
                updated_at: new Date().toISOString()
            })
            .eq('id', taskId)
            .eq('status', 'PENDING');
            
        if (error) {
            console.error('Failed to mark task in progress:', error);
        }
    },

    deleteTask: async (taskId: string) => {
        if (!supabase) return;
        
        // Delete attachments first (optional depending on DB cascading, but good for storage cleanup)
        // ideally, use a stored procedure or trigger for cleanup, but here we do simple delete
        const { error } = await supabase.from('agenda_tasks').delete().eq('id', taskId);
        if (error) throw error;
    },

    // --- ATTACHMENTS ---

    getTaskAttachments: async (taskId: string): Promise<TaskAttachment[]> => {
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('task_attachments')
            .select('*')
            .eq('task_id', taskId)
            .order('uploaded_at', { ascending: false });

        if (error) {
            console.error("Error fetching attachments:", error);
            return [];
        }

        return (data || []).map((a: any) => ({
            id: a.id,
            taskId: a.task_id,
            fileName: a.file_name,
            fileType: a.file_type,
            fileSize: a.file_size,
            fileUrl: a.file_url, // URL stored in DB or signed URL generation needed
            filePath: a.file_path, // Internal storage path
            uploadedBy: a.uploaded_by,
            uploadedAt: a.uploaded_at
        }));
    },

    uploadTaskAttachment: async (taskId: string, file: File) => {
        if (!supabase) return;

        const user = await AuthService.getSession();
        const timestamp = new Date().getTime();
        const filePath = `tasks/${taskId}/${timestamp}_${file.name}`;

        // 1. Upload to Storage
        const { error: uploadError } = await supabase.storage
            .from('task-attachments')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get Public URL (assuming public bucket, otherwise use createSignedUrl in retrieval)
        const { data: { publicUrl } } = supabase.storage
            .from('task-attachments')
            .getPublicUrl(filePath);

        // 3. Save Metadata to DB
        const { error: dbError } = await supabase.from('task_attachments').insert({
            task_id: taskId,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            file_path: filePath,
            file_url: publicUrl,
            uploaded_by: user?.id,
            uploaded_at: new Date().toISOString()
        });

        if (dbError) throw dbError;
    },

    deleteTaskAttachment: async (attachmentId: string) => {
        if (!supabase) return;

        // 1. Get path
        const { data, error: fetchError } = await supabase
            .from('task_attachments')
            .select('file_path')
            .eq('id', attachmentId)
            .single();

        if (fetchError || !data) throw fetchError || new Error("Attachment not found");

        // 2. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('task-attachments')
            .remove([data.file_path]);

        if (storageError) console.error("Warning: Failed to delete file from storage", storageError);

        // 3. Delete from DB
        const { error: dbError } = await supabase
            .from('task_attachments')
            .delete()
            .eq('id', attachmentId);

        if (dbError) throw dbError;
    },

    // --- LOGS ---

    logActivity: async (log: Partial<ActivityLogEntry>) => {
        if (!supabase) return;
        
        const user = await AuthService.getSession();
        
        const { error } = await supabase.from('activity_log').insert({
            user_id: user?.id, 
            user_name: log.userName || user?.name || 'System',
            action: log.action,
            action_description: log.actionDescription,
            entity_type: log.entityType,
            entity_id: log.entityId,
            entity_reference: log.entityReference,
            old_values: log.oldValues,
            new_values: log.newValues
        });
        
        if (error) console.error("Failed to log activity:", error);
    },

    getEntityActivity: async (entityType: string, entityId: string): Promise<ActivityLogEntry[]> => {
        if (!supabase) return [];
        
        const { data, error } = await supabase
            .from('activity_log')
            .select('*')
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .order('created_at', { ascending: false });

        if (error) return [];

        return (data || []).map((l: any) => ({
            id: l.id,
            userId: l.user_id,
            userName: l.user_name,
            action: l.action,
            actionDescription: l.action_description,
            entityType: l.entity_type,
            entityId: l.entity_id,
            createdAt: l.created_at,
            oldValues: l.old_values,
            newValues: l.new_values
        }));
    }
};
