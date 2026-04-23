import type { FinalExecutionContext } from "../structured-types";

export interface Rule {
  field: string;
  operator:
    | "equals"
    | "=="
    | "not_equals"
    | "!="
    | "greater_than"
    | ">"
    | "less_than"
    | "<"
    | "contains"
    | "exists";
  value: unknown;
}

export interface ConditionGroup {
  logic: "AND" | "OR";
  rules: Array<Rule | ConditionGroup>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConditionGroup(obj: Rule | ConditionGroup): obj is ConditionGroup {
  return "logic" in obj && Array.isArray(obj.rules);
}

export class ConditionEvaluator {
  evaluate(
    rules: Rule | ConditionGroup | Array<Rule | ConditionGroup> | string | null | undefined,
    context: FinalExecutionContext,
  ): boolean {
    if (typeof rules === "string") {
      return this.evaluateStringCondition(rules, context);
    }
    if (!rules) {
      return false;
    }
    if (!Array.isArray(rules) && isConditionGroup(rules)) {
      return this.evaluateGroup(rules, context);
    }
    if (Array.isArray(rules)) {
      return rules.some((rule) => this.evaluateRuleOrGroup(rule, context));
    }
    return this.evaluateRule(rules, context);
  }

  private evaluateRuleOrGroup(item: Rule | ConditionGroup, context: FinalExecutionContext): boolean {
    return isConditionGroup(item) ? this.evaluateGroup(item, context) : this.evaluateRule(item, context);
  }

  private evaluateGroup(group: ConditionGroup, context: FinalExecutionContext): boolean {
    return group.logic === "AND"
      ? group.rules.every((rule) => this.evaluateRuleOrGroup(rule, context))
      : group.rules.some((rule) => this.evaluateRuleOrGroup(rule, context));
  }

  private evaluateRule(rule: Rule, context: FinalExecutionContext): boolean {
    const value = this.getValueByPath(context, rule.field);
    const target = rule.value;

    switch (rule.operator) {
      case "equals":
      case "==":
        return value == target;
      case "not_equals":
      case "!=":
        return value != target;
      case "greater_than":
      case ">":
        return Number(value) > Number(target);
      case "less_than":
      case "<":
        return Number(value) < Number(target);
      case "contains":
        return String(value).toLowerCase().includes(String(target).toLowerCase());
      case "exists":
        return value !== undefined && value !== null && value !== "";
      default:
        return false;
    }
  }

  private evaluateStringCondition(condition: string, context: FinalExecutionContext): boolean {
    try {
      const trimmed = condition.trim();
      if (!trimmed) {
        return false;
      }
      if (trimmed === "true") {
        return true;
      }
      if (trimmed === "false") {
        return false;
      }

      const dangerousKeywords = ["eval", "Function", "constructor", "prototype", "__proto__", "require", "import"];
      if (dangerousKeywords.some((keyword) => trimmed.includes(keyword))) {
        return false;
      }

      if (trimmed.includes("||")) {
        return trimmed.split("||").some((part) => this.evaluateStringCondition(part.trim(), context));
      }
      if (trimmed.includes("&&")) {
        return trimmed.split("&&").every((part) => this.evaluateStringCondition(part.trim(), context));
      }

      const operators = ["===", "!==", "==", "!=", "<=", ">=", "<", ">"] as const;
      for (const operator of operators) {
        if (!trimmed.includes(operator)) {
          continue;
        }
        const [leftSide, rightSide] = trimmed.split(operator).map((segment) => segment.trim());
        if (!leftSide || !rightSide) {
          return false;
        }
        return this.compareValues(
          this.parseStringValue(leftSide, context),
          this.parseStringValue(rightSide, context),
          operator,
        );
      }

      return false;
    } catch {
      return false;
    }
  }

  private parseStringValue(value: string, context: FinalExecutionContext): unknown {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number.parseFloat(trimmed);
    }
    if (trimmed === "true") {
      return true;
    }
    if (trimmed === "false") {
      return false;
    }
    return this.getValueByPath(context, trimmed);
  }

  private compareValues(left: unknown, right: unknown, operator: string): boolean {
    switch (operator) {
      case "===":
        return left === right;
      case "!==":
        return left !== right;
      case "==":
        return left == right;
      case "!=":
        return left != right;
      case "<":
        return Number(left) < Number(right);
      case ">":
        return Number(left) > Number(right);
      case "<=":
        return Number(left) <= Number(right);
      case ">=":
        return Number(left) >= Number(right);
      default:
        return false;
    }
  }

  private getValueByPath(obj: FinalExecutionContext, path: string): unknown {
    if (!path) {
      return undefined;
    }

    const cleanPath = path.startsWith("context.") ? path.substring(8) : path;
    return cleanPath.split(".").reduce<unknown>((accumulator, part) => {
      if (!isRecord(accumulator)) {
        return undefined;
      }
      return accumulator[part];
    }, obj);
  }
}
