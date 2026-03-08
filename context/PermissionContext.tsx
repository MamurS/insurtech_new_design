
import React, { createContext, useContext, useState, useEffect } from 'react';
import { PermissionService } from '../services/permissionService';
import { useAuth } from './AuthContext';

interface PermissionContextType {
    permissions: string[];
    authorityLimits: { policyLol?: number; claimPayment?: number };
    hasPermission: (code: string) => boolean;
    canApproveAmount: (type: 'policy_lol' | 'claim_payment', amount: number) => boolean;
    loading: boolean;
    refresh: () => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [permissions, setPermissions] = useState<string[]>([]);
    const [authorityLimits, setAuthorityLimits] = useState<{ policyLol?: number; claimPayment?: number }>({});
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        if (!user) {
            setPermissions([]);
            setAuthorityLimits({});
            setLoading(false);
            return;
        }
        
        setLoading(true);
        try {
            const rbac = await PermissionService.getCurrentUserPermissions();
            setPermissions(rbac.permissions);
            setAuthorityLimits(rbac.authorityLimits);
        } catch (e) {
            console.error("Failed to load permissions", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, [user]);

    const hasPermission = (code: string) => {
        // Super Admin Bypass or wildcard check
        if (permissions.includes('*') || permissions.includes('admin.super')) return true;
        return permissions.includes(code);
    };

    const canApproveAmount = (type: 'policy_lol' | 'claim_payment', amount: number) => {
        if (permissions.includes('*') || permissions.includes('admin.super')) return true;
        
        const limit = type === 'policy_lol' ? authorityLimits.policyLol : authorityLimits.claimPayment;
        if (limit === undefined) return false; // No limit defined = 0 authority
        return amount <= limit;
    };

    return (
        <PermissionContext.Provider value={{ permissions, authorityLimits, hasPermission, canApproveAmount, loading, refresh }}>
            {children}
        </PermissionContext.Provider>
    );
};

export const usePermissionContext = () => {
    const context = useContext(PermissionContext);
    if (context === undefined) {
        throw new Error('usePermissionContext must be used within a PermissionProvider');
    }
    return context;
};
