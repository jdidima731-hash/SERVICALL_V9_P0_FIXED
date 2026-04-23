/**
 * RBAC Middleware
 * Wrappers Express pour la vérification des rôles.
 * Re-exporte la logique depuis rbacService.
 */

import type { Request, Response, NextFunction } from "express";

export type Role = "owner" | "superadmin" | "admin" | "manager" | "agent" | "agentIA" | "user";

/**
 * Middleware Express qui vérifie qu'un utilisateur a le rôle requis.
 * Usage : app.use("/admin", requireRole("admin"))
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role as Role | undefined;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({ error: "Accès refusé — rôle insuffisant" });
      return;
    }
    next();
  };
}
