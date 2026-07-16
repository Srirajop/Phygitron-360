import { useAuth } from './AuthContext';

export const usePermissions = () => {
    const { user } = useAuth();
    
    const hasPermission = (permissionKey) => {
        if (!user) return false;
        
        // Normalize user roles
        const rawRoles = (user.roles || [user.role]).map(r => r ? r.toLowerCase() : '');
        const userRoles = rawRoles.map(r => {
            if (['admin', 'administrator'].includes(r)) return 'org_admin';
            return r;
        });
        
        // Superadmin bypass
        if (userRoles.includes('super_admin') || userRoles.includes('superadmin')) {
            return true;
        }

        // Org Admin bypass for ease of management (they own the tenant)
        if (userRoles.includes('org_admin')) {
            return true;
        }

        // Check explicit permissions dictionary object injected into user session
        if (user.permissions && typeof user.permissions === 'object') {
            return !!user.permissions[permissionKey];
        }

        return false;
    };

    return { hasPermission };
};
