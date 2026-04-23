
import { useAuth } from './useAuth';
import { useTenant } from '@/contexts/TenantContext';

/**
 * Hook centralisé pour accéder à l'état global de l'application
 * Combine les données d'authentification et de tenant
 */
export function useAppState() {
  const auth = useAuth();
  const tenant = useTenant();

  return {
    // Données utilisateur
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    loading: auth.loading,
    error: auth.error,
    
    // Données tenant
    tenantId: tenant.tenantId,
    
    // Méthodes
    logout: auth.logout,
    refresh: auth.refresh,
    setTenantId: tenant.setTenantId,
    requireTenantId: tenant.requireTenantId,
    
    // État global
    isReady: auth.loading === false && tenant.isReady,
    
    // Helpers
    hasRole: (role: string) => {
      if (!auth.user) return false;
      
      return (auth.user as any).role === role || (auth.user as any).role === 'admin';
    },
    
    
    isAdmin: auth.user?.role === 'admin',
    
    isManager: auth.user?.role === 'manager' || auth.user?.role === 'admin',
    isAgent: Boolean(auth.user),
  };
}