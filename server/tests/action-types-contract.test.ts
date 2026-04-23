import blueprints from "@shared/blueprints.json";
import { AppError } from "@shared/_core/errors";
import { ACTION_METADATA, ACTION_TYPES, isActionType } from "@shared/workflow/action-types";
import { parseBlueprintCollection } from "@shared/workflow/contracts";
import { describe, expect, it } from "vitest";
import { actionRegistry } from "@server/workflow-engine/actionRegistry";

const parsedBlueprints = parseBlueprintCollection(blueprints);

describe("Action Types Contract", () => {
  it("keeps canonical action types, metadata, and registry aligned", () => {
    expect(actionRegistry.listTypes()).toEqual(ACTION_TYPES);

    ACTION_TYPES.forEach((actionType) => {
      expect(ACTION_METADATA[actionType].type).toBe(actionType);
      expect(actionRegistry.getHandler(actionType).name).toBe(actionType);
    });
  });

  it("ensures every blueprint action type is canonical and registered", () => {
    const invalidBlueprintActions = parsedBlueprints.flatMap((blueprint) =>
      blueprint.actions
        .filter((action) => !isActionType(action.type) || !actionRegistry.has(action.type))
        .map((action) => `${blueprint.id}:${action.type}`),
    );

    expect(invalidBlueprintActions).toEqual([]);
  });

  it("rejects unknown actions with AppError UNKNOWN_ACTION", () => {
    try {
      actionRegistry.getHandler("unknown_action");
      throw new Error("Expected getHandler to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      if (!(error instanceof AppError)) {
        throw error;
      }
      expect(error.code).toBe("UNKNOWN_ACTION");
    }
  });
});
