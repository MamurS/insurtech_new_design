
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AgendaService } from '../services/agendaService';
import { AgendaTask, TaskStatus } from '../types';

export const useAgendaTasks = (userId?: string, status?: string) => {
    return useQuery({
        queryKey: ['agenda', userId, status],
        queryFn: () => AgendaService.getTasks(userId, status),
        staleTime: 0, // Always refetch to avoid stale task status
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchInterval: 5000 // Poll every 5s for updates
    });
};

export const useCreateTask = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (task: Partial<AgendaTask>) => AgendaService.createTask(task),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agenda'] });
        }
    });
};

export const useUpdateTaskStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string, status: TaskStatus }) => 
            AgendaService.updateTaskStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agenda'] });
        }
    });
};

export const useDeleteTask = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => AgendaService.deleteTask(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agenda'] });
        }
    });
};

// --- ATTACHMENTS HOOKS ---

export const useTaskAttachments = (taskId: string) => {
    return useQuery({
        queryKey: ['task-attachments', taskId],
        queryFn: () => AgendaService.getTaskAttachments(taskId),
        enabled: !!taskId
    });
};

export const useUploadAttachment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ taskId, file }: { taskId: string, file: File }) => 
            AgendaService.uploadTaskAttachment(taskId, file),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['task-attachments', variables.taskId] });
        }
    });
};

export const useDeleteAttachment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ attachmentId, taskId }: { attachmentId: string, taskId: string }) => 
            AgendaService.deleteTaskAttachment(attachmentId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['task-attachments', variables.taskId] });
        }
    });
};

export const useEntityActivity = (type: string, id: string) => {
    return useQuery({
        queryKey: ['activity', type, id],
        queryFn: () => AgendaService.getEntityActivity(type, id),
        enabled: !!id
    });
};
