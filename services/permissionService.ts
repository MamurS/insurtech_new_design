
import { supabase } from './supabase';
import { Role, Permission, AuthorityLimit, RBACPermissions } from '../types';
import { AuthService } from './auth';

export const PermissionService = {
    getRoles: async (): Promise<Role[]> => {
        if (!supabase) return [];
        
        const { data, error } = await supabase
            .from('roles')
            .select('*')
            .order('level', { ascending: true });
            
        if (error) {
            console.error('Error fetching roles:', error);
            return [];
        }
        
        return (data || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            department: r.department,
            level: r.level,
            isSystemRole: r.is_system_role,
            isActive: r.is_active
        }));
    },

    getPermissions: async (): Promise<Permission[]> => {
        if (!supabase) return [];
        
        const { data, error } = await supabase
            .from('permissions')
            .select('*')
            .order('module', { ascending: true });
            
        if (error) return [];
        return data || [];
    },

    getRolePermissions: async (roleId: string): Promise<string[]> => {
        if (!supabase) return [];
        
        const { data, error } = await supabase
            .from('role_permissions')
            .select('permission_id, permissions(code)')
            .eq('role_id', roleId);
            
        if (error) return [];
        return data?.map((p: any) => p.permission_id) || [];
    },

    updateRolePermissions: async (roleId: string, permissionIds: string[]): Promise<void> => {
        if (!supabase) return;
        
        // Remove existing
        await supabase.from('role_permissions').delete().eq('role_id', roleId);
        
        // Add new
        if (permissionIds.length > 0) {
            const inserts = permissionIds.map(pid => ({ role_id: roleId, permission_id: pid }));
            await supabase.from('role_permissions').insert(inserts);
        }
    },

    getRoleAuthorityLimits: async (roleId: string): Promise<AuthorityLimit[]> => {
        if (!supabase) return [];
        
        const { data, error } = await supabase
            .from('authority_limits')
            .select('*')
            .eq('role_id', roleId);
            
        if (error) return [];
        return (data || []).map((l: any) => ({
            id: l.id,
            roleId: l.role_id,
            limitType: l.limit_type,
            currency: l.currency,
            maxAmount: l.max_amount,
            requiresApprovalAbove: l.requires_approval_above,
            canApproveOthers: l.can_approve_others,
            description: l.description
        }));
    },

    updateAuthorityLimit: async (limit: Partial<AuthorityLimit>): Promise<void> => {
        if (!supabase) return;
        
        const payload = {
            role_id: limit.roleId,
            limit_type: limit.limitType,
            currency: limit.currency,
            max_amount: limit.maxAmount,
            requires_approval_above: limit.requiresApprovalAbove,
            can_approve_others: limit.canApproveOthers,
            description: limit.description
        };

        if (limit.id) {
            await supabase.from('authority_limits').update(payload).eq('id', limit.id);
        } else {
            await supabase.from('authority_limits').insert(payload);
        }
    },
    
    deleteAuthorityLimit: async (id: string): Promise<void> => {
        if (!supabase) return;
        await supabase.from('authority_limits').delete().eq('id', id);
    },

    createRole: async (role: Partial<Role>): Promise<string> => {
        if (!supabase) throw new Error('No DB connection');
        
        const { data, error } = await supabase.from('roles').insert({
            name: role.name,
            description: role.description,
            department: role.department,
            level: role.level,
            is_active: role.isActive !== false,
            is_system_role: false
        }).select('id').single();
        
        if (error) throw error;
        return data.id;
    },

    updateRole: async (id: string, role: Partial<Role>): Promise<void> => {
        if (!supabase) return;
        
        await supabase.from('roles').update({
            name: role.name,
            description: role.description,
            department: role.department,
            level: role.level,
            is_active: role.isActive
        }).eq('id', id);
    },

    // --- Runtime Checks ---

    getCurrentUserPermissions: async (): Promise<RBACPermissions> => {
        if (!supabase) {
            // Mock Fallback for Offline Mode
            return {
                permissions: ['policy.create', 'policy.edit', 'policy.delete', 'admin.access', 'claims.view', 'claims.create'],
                authorityLimits: { policyLol: 1000000, claimPayment: 50000 },
                canApprove: true
            };
        }

        const user = await AuthService.getSession();
        if (!user) return { permissions: [], authorityLimits: {}, canApprove: false };

        // 1. Get Permissions List (RPC)
        // Fixed: Use p_user_id
        const { data: perms } = await supabase.rpc('get_user_permissions', { 
            p_user_id: user.id 
        });
        const permissionsList = perms?.map((p: any) => p.code) || [];

        // 2. Get Authority Limits (RPC)
        // Fixed: Use p_user_id, p_limit_type, p_currency
        const { data: lolLimit } = await supabase.rpc('get_user_authority_limit', { 
            p_user_id: user.id, 
            p_limit_type: 'policy_lol', 
            p_currency: 'USD' 
        });
        
        const { data: claimLimit } = await supabase.rpc('get_user_authority_limit', { 
            p_user_id: user.id, 
            p_limit_type: 'claim_payment', 
            p_currency: 'USD' 
        });

        // 3. Can Approve? (Check role level or flag)
        const canApprove = permissionsList.includes('approval.execute');

        return {
            permissions: permissionsList,
            authorityLimits: {
                policyLol: Number(lolLimit) || 0,
                claimPayment: Number(claimLimit) || 0
            },
            canApprove
        };
    }
};
