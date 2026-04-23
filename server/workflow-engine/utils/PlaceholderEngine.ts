import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "./Logger";

type PrimitiveValue = string | number | boolean | null | undefined;
type Resolvable = PrimitiveValue | Record<string, unknown> | Resolvable[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class PlaceholderEngine {
  private static readonly logger = new Logger("PlaceholderEngine");

  static resolve(config: Resolvable, context: FinalExecutionContext): Resolvable {
    if (config === null || config === undefined) {
      return config;
    }
    if (typeof config === "string") {
      return this.resolveString(config, context);
    }
    if (Array.isArray(config)) {
      return config.map((item) => this.resolve(item, context));
    }
    if (isRecord(config)) {
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        resolved[key] = this.resolve(value as Resolvable, context);
      }
      return resolved;
    }
    return config;
  }

  private static resolveString(str: string, context: FinalExecutionContext): string {
    return str.replace(/\{\{?([^}]+)\}?\}/g, (_match, path: string) => {
      const trimmedPath = path.trim();
      if (trimmedPath.includes(" ? ")) {
        return this.evaluateTernary(trimmedPath, context);
      }

      const parts = trimmedPath.split(".");
      const allowedRoots: ReadonlyArray<string> = [
        "prospect",
        "caller",
        "event",
        "ai",
        "variables",
        "tenant",
        "call",
        "firstName",
        "lastName",
        "email",
        "phone",
        "last_message",
        "transcription",
        "ai_score",
        "ai_summary",
        "business_entities",
        "appointment",
        "visit",
        "property",
      ];

      const root = parts[0] ?? "";
      if (!root || !allowedRoots.includes(root)) {
        this.logger.error(`Accès à une racine non autorisée : ${root || "undefined"}`);
        throw new Error(`Security Violation: Access to variable \"${root || "undefined"}\" is forbidden in placeholders`);
      }

      const value = this.navigatePath(this.resolveRoot(root, context), parts.slice(1));
      if (value === undefined || value === null) {
        this.logger.warn(`Variable manquante ou nulle : ${trimmedPath}`);
        return "";
      }

      return String(value);
    });
  }

  private static resolveRoot(root: string, context: FinalExecutionContext): unknown {
    switch (root) {
      case "event":
        return context.event;
      case "tenant":
        return context.tenant;
      case "prospect":
        return context.variables.prospect;
      case "call":
        return context.variables.call;
      case "ai":
        return context.variables.ai;
      case "variables":
        return context.variables;
      default:
        return context.variables[root];
    }
  }

  private static navigatePath(initialValue: unknown, parts: string[]): unknown {
    let currentValue = initialValue;
    for (const part of parts) {
      if (!isRecord(currentValue)) {
        return undefined;
      }
      currentValue = currentValue[part];
    }
    return currentValue;
  }

  private static evaluateTernary(expr: string, context: FinalExecutionContext): string {
    try {
      const questionIndex = expr.indexOf(" ? ");
      if (questionIndex === -1) {
        return "";
      }

      const condition = expr.substring(0, questionIndex).trim();
      const remainingExpression = expr.substring(questionIndex + 3).trim();
      const colonIndex = remainingExpression.indexOf(" : ");
      if (colonIndex === -1) {
        return "";
      }

      const trueValue = this.cleanQuotedValue(remainingExpression.substring(0, colonIndex).trim());
      const falseValue = this.cleanQuotedValue(remainingExpression.substring(colonIndex + 3).trim());
      return this.evaluateCondition(condition, context) ? trueValue : falseValue;
    } catch (error) {
      this.logger.error("Ternary evaluation failed", error, { expr });
      return "";
    }
  }

  private static cleanQuotedValue(value: string): string {
    return value.replace(/^["']|["']$/g, "");
  }

  private static evaluateCondition(condition: string, context: FinalExecutionContext): boolean {
    const operators = [">=", "<=", "!==", "!=", "===", "==", ">", "<"] as const;

    for (const operator of operators) {
      const operatorIndex = condition.indexOf(operator);
      if (operatorIndex === -1) {
        continue;
      }

      const leftExpression = condition.substring(0, operatorIndex).trim();
      const rightExpression = condition.substring(operatorIndex + operator.length).trim();
      const leftValue = this.resolveVariablePath(leftExpression, context);
      const rightValue = this.resolveRightOperand(rightExpression, context);
      return this.compareValues(leftValue, rightValue, operator);
    }

    return Boolean(this.resolveVariablePath(condition, context));
  }

  private static compareValues(left: unknown, right: unknown, operator: string): boolean {
    switch (operator) {
      case ">=":
        return Number(left) >= Number(right);
      case "<=":
        return Number(left) <= Number(right);
      case ">":
        return Number(left) > Number(right);
      case "<":
        return Number(left) < Number(right);
      case "===":
      case "==":
        return String(left) === String(right);
      case "!==":
      case "!=":
        return String(left) !== String(right);
      default:
        return false;
    }
  }

  private static resolveVariablePath(path: string, context: FinalExecutionContext): unknown {
    const parts = path.split(".");
    return this.navigatePath(this.resolveRoot(parts[0] ?? "", context), parts.slice(1));
  }

  private static resolveRightOperand(raw: string, context: FinalExecutionContext): unknown {
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1);
    }
    if (!Number.isNaN(Number(raw))) {
      return Number(raw);
    }
    if (raw === "true") {
      return true;
    }
    if (raw === "false") {
      return false;
    }
    if (raw === "null") {
      return null;
    }
    return this.resolveVariablePath(raw, context);
  }
}
