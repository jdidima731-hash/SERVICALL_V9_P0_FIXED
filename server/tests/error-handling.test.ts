import { describe, it, expect, vi } from "vitest";
import { normalizeError, ErrorType } from "../middleware/errorHandler";
import { AppError, Errors } from "../config/appErrors";
import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";

describe("Error Handling & Normalization", () => {
  it("should normalize AppError correctly", () => {
    const appError = Errors.NOT_FOUND("User");
    const normalized = normalizeError(appError);
    
    expect(normalized.type).toBe(ErrorType.NOT_FOUND);
    expect(normalized.statusCode).toBe(404);
    expect(normalized.message).toContain("User non trouvé");
  });

  it("should normalize TRPCError correctly", () => {
    const trpcError = new TRPCError({ code: "UNAUTHORIZED", message: "Auth failed" });
    const normalized = normalizeError(trpcError);
    
    expect(normalized.type).toBe(ErrorType.AUTHENTICATION);
    expect(normalized.statusCode).toBe(401);
    expect(normalized.message).toBe("Auth failed");
  });

  it("should normalize ZodError correctly", () => {
    const zodError = new ZodError([{ code: "invalid_type", expected: "string", received: "number", path: ["email"], message: "Expected string" }]);
    const normalized = normalizeError(zodError);
    
    expect(normalized.type).toBe(ErrorType.VALIDATION);
    expect(normalized.statusCode).toBe(400);
    expect(normalized.details).toBeDefined();
  });

  it("should normalize unknown Error as INTERNAL_ERROR", () => {
    const error = new Error("Something went wrong");
    const normalized = normalizeError(error);
    
    expect(normalized.type).toBe(ErrorType.INTERNAL);
    expect(normalized.statusCode).toBe(500);
  });

  it("should normalize CSRF error correctly", () => {
    const csrfError = new Error("invalid csrf token");
    const normalized = normalizeError(csrfError);
    
    expect(normalized.type).toBe(ErrorType.CSRF);
    expect(normalized.statusCode).toBe(403);
  });
});
