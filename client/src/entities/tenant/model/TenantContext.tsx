
import { trpc } from "@/shared/lib/trpc";
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/entities/user/model/useAuth';
import { useLocation } from 'wouter';
import * as Sentry from "@sentry/react";

interface TenantContextType {
  tenantId: number | null;
  setTenantId: (id: number | null) => void;
  isReady: boolean;
  requireTenantId: () => number;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantIdState] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

    // BLOC P1 : Recuperation du tenant actuel via le backend (RLS)
  const { data: backendTenant, isLoading: isTenantLoading } = trpc.core.auth.currentTenant.useQuery(undefined, {
    enabled: isAuthenticated && !!user,
    staleTime: Infinity, // Le tenant ne change que via switchTenant (qui reload la page)
  });

  useEffect(() => {
    if (loading || isTenantLoading) return;

    if (isAuthenticated && user) {
      Sentry.setUser({ id: String((user as any).id), email: (user as any).email });
      
      if (backendTenant) {
        setTenantIdState(backendTenant.tenantId);
        setIsReady(true);
      } else {
        // Pas de tenant actif -> redirection vers selection
        setIsReady(true);
        setLocation('/select-tenant');
      }
    } else {
      Sentry.setUser(null);
      setTenantIdState(null);
      setIsReady(true);
    }
  }, [user, isAuthenticated, loading, backendTenant, isTenantLoading, setLocation]);

    const setTenantId = (id: number | null) => {
    setTenantIdState(id);
    if (id !== null) {
      Sentry.setTag("tenantId", String(id));
    } else {
      Sentry.setTag("tenantId", null);
    }
    // BLOC P1 : Plus de stockage localStorage. Le tenantId est gere par le cookie session backend.
  };

  const requireTenantId = (): number => {
    if (tenantId === null) throw new Error('tenantId est requis.');
    return tenantId;
  };

  return (
    <TenantContext.Provider value={{ tenantId, setTenantId, isReady, requireTenantId }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
};
