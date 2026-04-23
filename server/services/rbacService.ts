/**
 * Centralized Role-Based Access Control (RBAC) Service
 */

import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

export type Role = "owner" | "superadmin" | "admin" | "manager" | "agent" | "agentIA" | "viewer" | "user";

export type Permission = 
  | "view_dashboard"
  | "manage_users"
  | "manage_tenants"
  | "view_calls"
  | "make_calls"
  | "view_recordings"
  | "manage_recordings"
  | "view_analytics"
  | "manage_settings"
  | "view_audit_logs"
  | "manage_rgpd"
  | "manage_campaigns"
  | "manage_workflows";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "view_dashboard", "manage_users", "manage_tenants", "view_calls", "make_calls",
    "view_recordings", "manage_recordings", "view_analytics", "manage_settings",
    "view_audit_logs", "manage_rgpd", "manage_campaigns", "manage_workflows"
  ],
  superadmin: [
    "view_dashboard", "manage_users", "manage_tenants", "view_calls", "make_calls",
    "view_recordings", "manage_recordings", "view_analytics", "manage_settings",
    "view_audit_logs", "manage_rgpd", "manage_campaigns", "manage_workflows"
  ],
  admin: [
    "view_dashboard", "manage_users", "view_calls", "make_calls",
    "view_recordings", "manage_recordings", "view_analytics", "manage_settings",
    "view_audit_logs", "manage_rgpd", "manage_campaigns", "manage_workflows"
  ],
  manager: [
    "view_dashboard", "view_calls", "make_calls", "view_recordings",
    "view_analytics", "manage_campaigns", "manage_workflows"
  ],
  agent: [
    "view_dashboard", "view_calls", "make_calls", "view_recordings"
  ],
  agentIA: [
    "make_calls", "view_calls"
  ],
  viewer: [
    "view_dashboard", "view_calls", "view_recordings", "view_analytics"
  ],
  user: [
    "view_dashboard"
  ]
};

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 100,
  superadmin: 100,
  admin: 80,
  manager: 60,
  agent: 40,
  agentIA: 20,
  viewer: 10,
  user: 5,
};

export class RBACService {
  /**
   * Check if a role has a specific permission
   */
  static hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) || false;
  }

  /**
   * Check if a role is at least the required role (hierarchy check)
   */
  static isAtLeast(userRole: Role, requiredRole: Role): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  }

  /**
   * Validate permission and throw TRPCError if denied
   */
  static validatePermission(role: Role, permission: Permission) {
    if (!this.hasPermission(role, permission)) {
      logger.warn(`[RBAC] Permission denied: ${role} lacks ${permission}`);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Vous n'avez pas la permission requise : ${permission}`,
      });
    }
  }

  /**
   * Validate hierarchy and throw TRPCError if denied
   */
  static validateRole(userRole: Role, requiredRole: Role) {
    if (!this.isAtLeast(userRole, requiredRole)) {
      logger.warn(`[RBAC] Access denied: ${userRole} is below ${requiredRole}`);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Accès refusé : Rôle ${requiredRole} minimum requis`,
      });
    }
  }

  /**
   * Get all permissions for a role
   */
  static getPermissions(role: Role): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }
}
