
import { supabase } from './supabase';
import { Profile, UserRole, Department } from '../types';

export const UserService = {
    // --- DEPARTMENTS ---

    getDepartments: async (): Promise<Department[]> => {
        if (!supabase) return [];
        
        // We select *, and join to profiles to get the head of department name
        const { data, error } = await supabase
            .from('departments')
            .select(`
                *,
                head_profile:head_of_department(full_name) 
            `)
            .order('name');
        
        if (error) {
            console.error('Error fetching departments:', error);
            return [];
        }
        
        // Count users in each department to update 'currentStaffCount'
        // Ideally this is a separate count query or a view, but for small scale this works client-side or via separate query
        const { data: users } = await supabase.from('profiles').select('department_id');
        const counts: Record<string, number> = {};
        users?.forEach((u: any) => {
            if (u.department_id) counts[u.department_id] = (counts[u.department_id] || 0) + 1;
        });

        return (data || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            code: d.code,
            description: d.description,
            headOfDepartment: d.head_of_department, // The UUID
            headName: d.head_profile?.full_name, // The joined name mapped manually in UI or here
            maxStaff: d.max_staff,
            currentStaffCount: counts[d.id] || 0,
            parentDepartmentId: d.parent_department_id,
            isActive: d.is_active
        }));
    },

    saveDepartment: async (dept: Partial<Department>) => {
        if (!supabase) throw new Error("No DB connection");

        const payload = {
            name: dept.name,
            code: dept.code,
            description: dept.description,
            head_of_department: dept.headOfDepartment || null,
            max_staff: dept.maxStaff || 0,
            is_active: dept.isActive !== false,
            updated_at: new Date().toISOString()
        };

        if (dept.id) {
            const { error } = await supabase
                .from('departments')
                .update(payload)
                .eq('id', dept.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('departments')
                .insert(payload);
            if (error) throw error;
        }
    },

    deleteDepartment: async (id: string) => {
        if (!supabase) throw new Error("No DB connection");
        
        const { error } = await supabase
            .from('departments')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
    },

    // --- PROFILES ---

    // Get all profiles (for assignment dropdowns and admin list)
    getAllProfiles: async (): Promise<Profile[]> => {
        if (!supabase) {
            console.warn("Supabase client not initialized.");
            return [];
        }
        
        try {
            // Query 'profiles' table (CORRECT TABLE)
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    id,
                    email,
                    full_name,
                    role,
                    role_id,
                    department,
                    department_id,
                    phone,
                    avatar_url,
                    is_active,
                    created_at,
                    updated_at,
                    deactivated_at
                `)
                .order('full_name');
            
            if (error) {
                console.error("UserService: Error fetching profiles:", error);
                return [];
            }
            
            // Map columns from 'profiles' schema to app Profile type
            return (data || []).map((p: any) => ({
                id: p.id,
                email: p.email,
                fullName: p.full_name || 'Unknown User',
                role: (p.role || 'Viewer') as UserRole,
                roleId: p.role_id,
                department: p.department || '',
                departmentId: p.department_id,
                phone: p.phone || '',
                avatarUrl: p.avatar_url,
                isActive: p.is_active !== undefined ? p.is_active : true,
                createdAt: p.created_at || new Date().toISOString(),
                updatedAt: p.updated_at,
                deactivatedAt: p.deactivated_at
            }));
        } catch (err) {
            console.error("UserService: Unexpected error:", err);
            return [];
        }
    },

    // Update profile data
    updateProfile: async (id: string, updates: Partial<Profile>) => {
        if (!supabase) return;
        
        const payload: any = {};
        
        // Explicitly map inputs to DB columns for 'profiles' table
        if (updates.fullName !== undefined) payload.full_name = updates.fullName;
        if (updates.roleId !== undefined) payload.role_id = updates.roleId;
        if (updates.department !== undefined) payload.department = updates.department;
        if (updates.departmentId !== undefined) payload.department_id = updates.departmentId;
        if (updates.phone !== undefined) payload.phone = updates.phone;
        if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        
        // Sync Legacy Role Field for backward compatibility
        if (updates.roleId) {
            const { data: roleData } = await supabase
                .from('roles')
                .select('name')
                .eq('id', updates.roleId)
                .single();
            
            if (roleData) {
                payload.role = roleData.name;
            }
        } else if (updates.role) {
            payload.role = updates.role;
        }
        
        const { error } = await supabase
            .from('profiles')  // CORRECT TABLE
            .update(payload)
            .eq('id', id);
            
        if (error) throw error;
    },

    // Delete user (Auth + Profile)
    deleteUser: async (userId: string) => {
        if (!supabase) return;

        // Call RPC function to delete from auth.users (requires setup in DB)
        const { error } = await supabase.rpc('delete_user_account', { user_id: userId });

        if (error) {
            console.error("Error deleting user:", error);
            throw new Error(error.message || "Failed to delete user. Check permissions.");
        }
    },

    // Deactivate user — keeps profile row for history, deletes auth entry to free the email
    deactivateUser: async (userId: string) => {
        if (!supabase) throw new Error("No DB connection");

        // 1. Update profile: mark inactive with timestamp (keep row for history)
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                is_active: false,
                deactivated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (profileError) throw profileError;

        // 2. Delete auth.users entry so the email is freed for re-registration
        //    Uses server-side RPC since client SDK doesn't expose admin.deleteUser
        const { error: deleteAuthError } = await supabase.rpc('delete_auth_user', { target_user_id: userId });
        if (deleteAuthError) {
            console.warn("Could not delete auth account via RPC:", deleteAuthError.message);
            // Non-fatal: the is_active check on login will still block them
        }
    },

    // Reactivate a deactivated profile by pointing it to a new auth user ID.
    // Called when creating a user whose email matches a deactivated profile.
    reactivateProfile: async (oldProfileId: string, newAuthUserId: string, updates: {
        fullName: string;
        email: string;
        role: string;
        roleId?: string | null;
        department?: string | null;
        departmentId?: string | null;
        phone?: string | null;
        avatarUrl?: string | null;
    }) => {
        if (!supabase) throw new Error("No DB connection");

        // Update the old profile: reassign to new auth UUID, mark active, apply form fields
        const { error } = await supabase
            .from('profiles')
            .update({
                id: newAuthUserId,
                full_name: updates.fullName,
                email: updates.email,
                role: updates.role,
                role_id: updates.roleId || null,
                department: updates.department || null,
                department_id: updates.departmentId || null,
                phone: updates.phone || null,
                avatar_url: updates.avatarUrl || updates.fullName.substring(0, 2).toUpperCase(),
                is_active: true,
                deactivated_at: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', oldProfileId);

        if (error) throw error;
    },

    // Find a deactivated profile by email (for reuse during user creation)
    findDeactivatedProfileByEmail: async (email: string): Promise<Profile | null> => {
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .eq('is_active', false)
            .limit(1)
            .maybeSingle();

        if (error || !data) return null;

        return {
            id: data.id,
            email: data.email,
            fullName: data.full_name || '',
            role: data.role || 'Viewer',
            roleId: data.role_id,
            department: data.department || '',
            departmentId: data.department_id,
            phone: data.phone || '',
            avatarUrl: data.avatar_url,
            isActive: data.is_active,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            deactivatedAt: data.deactivated_at
        };
    },

    // Reset password — sends password reset email
    resetPassword: async (email: string) => {
        if (!supabase) throw new Error("No DB connection");

        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    }
};
