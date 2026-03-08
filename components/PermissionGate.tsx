
import React from 'react';
import { usePermissionContext } from '../context/PermissionContext';

interface PermissionGateProps {
    permission: string | string[];
    fallback?: React.ReactNode;
    children: React.ReactNode;
    requireAll?: boolean;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({ 
    permission, 
    fallback = null, 
    children, 
    requireAll = false 
}) => {
    const { hasPermission, loading } = usePermissionContext();

    if (loading) return null; // Or a loading spinner if preferred

    const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
    
    const hasAccess = requireAll
        ? permissionsToCheck.every(p => hasPermission(p))
        : permissionsToCheck.some(p => hasPermission(p));

    return hasAccess ? <>{children}</> : <>{fallback}</>;
};
