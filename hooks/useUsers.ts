
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserService } from '../services/userService';
import { Profile } from '../types';

export const useProfiles = () => {
    return useQuery({
        queryKey: ['profiles'],
        queryFn: () => UserService.getAllProfiles(),
        staleTime: 0, // Always fetch fresh data to ensure Admin Console is up to date
        refetchOnWindowFocus: true
    });
};

export const useUpdateProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, updates }: { id: string, updates: Partial<Profile> }) => 
            UserService.updateProfile(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
        }
    });
};
