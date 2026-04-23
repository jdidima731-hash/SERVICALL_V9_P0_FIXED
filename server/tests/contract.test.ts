import express from "express";
import request from "supertest";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createContext } from "@server/_core/context";
import { AuthService, type AuthenticatedUser } from "@server/services/authService";
import { actionRegistry } from "@server/workflow-engine/actionRegistry";
import { isValidEventType } from "@shared/eventTypes";

vi.mock("@server/services/authService");

function buildAuthenticatedUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    tenantId: 10,
    openId: "oid-1",
    name: "Test User",
    email: "test@example.com",
    passwordHash: null,
    loginMethod: null,
    role: "admin",
    lastSignedIn: null,
    tokensValidAfter: null,
    createdAt: null,
    updatedAt: null,
    brandAIConfig: null,
    whatsappAiLanguage: null,
    whatsappAiTone: null,
    whatsappAiPersona: null,
    industry: null,
    isActive: true,
    assignedAgentType: "AI",
    callbackPhone: null,
    callbackNotifyMode: "crm",
    isAvailableForTransfer: true,
    ...overrides,
  };
}

async function createExpressContextOptions(): Promise<CreateExpressContextOptions> {
  return new Promise((resolve, reject) => {
    const app = express();
    const server = app.listen(0);

    const closeServer = (): void => {
      server.close();
    };

    app.get("/__context", (req, res) => {
      resolve({ req, res });
      res.status(204).end(() => {
        closeServer();
      });
    });

    server.on("listening", () => {
      request(server)
        .get("/__context")
        .then(() => undefined)
        .catch((error: unknown) => {
          closeServer();
          reject(error);
        });
    });

    server.on("error", reject);
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("Contract: Authentication & Context", () => {
  it("resolves context with canonical unauthenticated flags", async () => {
    vi.mocked(AuthService.authenticateRequest).mockResolvedValue(null);

    const ctx = await createContext(await createExpressContextOptions());

    expect(ctx.user).toBeNull();
    expect(ctx.tenantId).toBeNull();
    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.hasTenant).toBe(false);
    expect(ctx.isSuperAdmin).toBe(false);
  });

  it("creates a valid context for authenticated tenant requests", async () => {
    vi.mocked(AuthService.authenticateRequest).mockResolvedValue({
      user: buildAuthenticatedUser(),
      tenantId: 10,
    });

    const ctx = await createContext(await createExpressContextOptions());

    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.user).toBeDefined();
    expect(ctx.tenantId).toBe(10);
    expect(ctx.hasTenant).toBe(true);
    expect(ctx.isSuperAdmin).toBe(false);
    expect(ctx.tenantContext).toBeDefined();
    expect(ctx.tenantContext?.role).toBe("admin");
  });
});

describe("Contract: Workflow Events", () => {
  it("validates dot-notation event types", () => {
    expect(isValidEventType("call.received")).toBe(true);
    expect(isValidEventType("call.completed")).toBe(true);
    expect(isValidEventType("prospect.created")).toBe(true);
    expect(isValidEventType("invalid_event")).toBe(false);
  });
});

describe("Contract: Action Registry", () => {
  it("has handlers for all mandatory action types", () => {
    const mandatoryTypes = ["ai_summary", "send_sms", "logic_if_else", "create_task"] as const;

    mandatoryTypes.forEach((type) => {
      expect(actionRegistry.getHandler(type)).toBeDefined();
    });
  });
});
