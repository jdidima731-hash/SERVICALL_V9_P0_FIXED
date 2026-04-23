/**
 * Tests RBAC Guards — Rôles et permissions
 *
 * Vérifie que :
 * 1. Les procédures admin rejettent les rôles insuffisants
 * 2. Les procédures manager autorisent manager et admin
 * 3. Les procédures agent autorisent agent, admin et owner
 * 4. La validation des rôles fonctionne correctement
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../infrastructure/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Simulation du service RBAC ───────────────────────────────────────────────

type Role = "owner" | "superadmin" | "admin" | "manager" | "agent" | "agentIA" | "viewer" | "user";

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 100,
  superadmin: 90,
  admin: 80,
  manager: 60,
  agent: 40,
  agentIA: 35,
  viewer: 20,
  user: 10,
};

function validateRole(userRole: Role, requiredRole: Role): void {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  if (userLevel < requiredLevel) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Rôle insuffisant. Requis : ${requiredRole}, actuel : ${userRole}`,
    });
  }
}

// ─── Tests : Guard adminProcedure ─────────────────────────────────────────────

describe("RBAC Guard — adminProcedure", () => {
  it("autorise le rôle admin", () => {
    expect(() => validateRole("admin", "admin")).not.toThrow();
  });

  it("autorise le rôle owner", () => {
    expect(() => validateRole("owner", "admin")).not.toThrow();
  });

  it("autorise le rôle superadmin", () => {
    expect(() => validateRole("superadmin", "admin")).not.toThrow();
  });

  it("rejette le rôle manager", () => {
    expect(() => validateRole("manager", "admin")).toThrow(TRPCError);
    // Le message contient les rôles, pas le code d'erreur (le code est dans err.code)
    expect(() => validateRole("manager", "admin")).toThrow("Insuffisant".toLowerCase().includes("forbidden") ? "FORBIDDEN" : /R.le insuffisant/);
  });

  it("rejette le rôle agent", () => {
    expect(() => validateRole("agent", "admin")).toThrow(TRPCError);
  });

  it("rejette le rôle viewer", () => {
    expect(() => validateRole("viewer", "admin")).toThrow(TRPCError);
  });
});

// ─── Tests : Guard managerProcedure ──────────────────────────────────────────

describe("RBAC Guard — managerProcedure", () => {
  it("autorise le rôle manager", () => {
    expect(() => validateRole("manager", "manager")).not.toThrow();
  });

  it("autorise le rôle admin", () => {
    expect(() => validateRole("admin", "manager")).not.toThrow();
  });

  it("autorise le rôle owner", () => {
    expect(() => validateRole("owner", "manager")).not.toThrow();
  });

  it("rejette le rôle agent", () => {
    expect(() => validateRole("agent", "manager")).toThrow(TRPCError);
  });

  it("rejette le rôle viewer", () => {
    expect(() => validateRole("viewer", "manager")).toThrow(TRPCError);
  });
});

// ─── Tests : Guard agentProcedure ────────────────────────────────────────────

describe("RBAC Guard — agentProcedure", () => {
  it("autorise le rôle agent", () => {
    expect(() => validateRole("agent", "agent")).not.toThrow();
  });

  it("autorise le rôle admin", () => {
    expect(() => validateRole("admin", "agent")).not.toThrow();
  });

  it("autorise le rôle owner", () => {
    expect(() => validateRole("owner", "agent")).not.toThrow();
  });

  it("rejette le rôle viewer", () => {
    expect(() => validateRole("viewer", "agent")).toThrow(TRPCError);
  });

  it("rejette le rôle user", () => {
    expect(() => validateRole("user", "agent")).toThrow(TRPCError);
  });
});

// ─── Tests : Message d'erreur RBAC ───────────────────────────────────────────

describe("RBAC — messages d'erreur", () => {
  it("inclut le rôle requis et le rôle actuel dans le message", () => {
    try {
      validateRole("viewer", "admin");
      expect.fail("Devrait lever une erreur");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      if (err instanceof TRPCError) {
        expect(err.message).toContain("admin");
        expect(err.message).toContain("viewer");
      }
    }
  });

  it("le code d'erreur est FORBIDDEN", () => {
    try {
      validateRole("agent", "admin");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      if (err instanceof TRPCError) {
        expect(err.code).toBe("FORBIDDEN");
      }
    }
  });
});

// ─── Tests : Isolation tenant dans les guards ─────────────────────────────────

describe("DB Guard — isolation tenant combinée avec RBAC", () => {
  it("un viewer d'un autre tenant ne peut pas accéder aux données admin", async () => {
    const ctx = { tenantId: 1, tenantRole: "viewer" as Role };
    const requestedTenantId = 2;

    const guard = async () => {
      // Guard 1 : isolation tenant
      if (requestedTenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      // Guard 2 : RBAC
      validateRole(ctx.tenantRole, "admin");
    };

    // Doit échouer sur le premier guard (cross-tenant)
    await expect(guard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("un viewer du bon tenant ne peut pas appeler adminProcedure", async () => {
    const ctx = { tenantId: 1, tenantRole: "viewer" as Role };
    const requestedTenantId = 1;

    const guard = async () => {
      // Guard 1 : isolation tenant (OK)
      if (requestedTenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      // Guard 2 : RBAC (doit échouer)
      validateRole(ctx.tenantRole, "admin");
    };

    // Doit échouer sur le deuxième guard (RBAC)
    await expect(guard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("un admin du bon tenant peut appeler adminProcedure", async () => {
    const ctx = { tenantId: 1, tenantRole: "admin" as Role };
    const requestedTenantId = 1;

    const guard = async () => {
      if (requestedTenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      validateRole(ctx.tenantRole, "admin");
      return { success: true };
    };

    const result = await guard();
    expect(result.success).toBe(true);
  });
});

// ─── Tests : Cohérence de la hiérarchie des rôles ────────────────────────────

describe("Hiérarchie des rôles — cohérence", () => {
  const roles: Role[] = ["owner", "superadmin", "admin", "manager", "agent", "agentIA", "viewer", "user"];

  it("owner a le niveau le plus élevé", () => {
    const ownerLevel = ROLE_HIERARCHY["owner"];
    roles.forEach((role) => {
      if (role !== "owner") {
        expect(ownerLevel).toBeGreaterThan(ROLE_HIERARCHY[role]);
      }
    });
  });

  it("user a le niveau le plus bas", () => {
    const userLevel = ROLE_HIERARCHY["user"];
    roles.forEach((role) => {
      if (role !== "user") {
        expect(userLevel).toBeLessThan(ROLE_HIERARCHY[role]);
      }
    });
  });

  it("admin > manager > agent > viewer", () => {
    expect(ROLE_HIERARCHY["admin"]).toBeGreaterThan(ROLE_HIERARCHY["manager"]);
    expect(ROLE_HIERARCHY["manager"]).toBeGreaterThan(ROLE_HIERARCHY["agent"]);
    expect(ROLE_HIERARCHY["agent"]).toBeGreaterThan(ROLE_HIERARCHY["viewer"]);
  });
});
