
import { usePermissionContext } from '../context/PermissionContext';

export const usePermissions = () => {
    return usePermissionContext();
};

export const useHasPermission = (code: string) => {
    const { hasPermission } = usePermissionContext();
    return hasPermission(code);
};

export const useAuthorityLimit = (type: 'policy_lol' | 'claim_payment') => {
    const { authorityLimits } = usePermissionContext();
    return type === 'policy_lol' ? authorityLimits.policyLol : authorityLimits.claimPayment;
};
