
import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";

export type Role = "superadmin" | "admin" | "manager" | "agent" | "agentIA";

const ROLE_HIERARCHY: Record<Role, number> = {
  superadmin: 100,
  admin: 80,
  manager: 60,
  agent: 40,
  agentIA: 20,
};

interface RBACGuardProps {
  children: React.ReactNode;
  requiredRole?: Role;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function RBACGuard({ 
  children, 
  requiredRole, 
  fallback = null, 
  redirectTo 
}: RBACGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    if (redirectTo) return <Redirect to={redirectTo} />;
    return <>{fallback}</>;
  }

  
  const userRole = (user as any).role as Role;

  if (requiredRole && ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[requiredRole]) {
    if (redirectTo) return <Redirect to={redirectTo} />;
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook to check permissions in components
 */
export function useRBAC() {
  const { user } = useAuth();
  
  const hasRole = (requiredRole: Role) => {
    if (!user) return false;
    
    const userRole = (user as any).role as Role;
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  };

  return {
    hasRole,
    
    role: user?.role as Role | undefined,
    isAdmin: hasRole("admin"),
    isManager: hasRole("manager"),
    isSuperAdmin: hasRole("superadmin"),
  };
}