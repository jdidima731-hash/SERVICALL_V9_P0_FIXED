import blueprints from "@shared/blueprints.json";
import { ACTION_METADATA, ACTION_TYPES } from "@shared/workflow/action-types";
import { parseBlueprintCollection } from "@shared/workflow/contracts";
import { describe, expect, it } from "vitest";
import { actionRegistry } from "@server/workflow-engine/actionRegistry";

const parsedBlueprints = parseBlueprintCollection(blueprints);

describe("workflow action registry coherence", () => {
  it("registers every canonical action type", () => {
    expect(actionRegistry.listTypes()).toEqual(ACTION_TYPES);
  });

  it("exposes metadata for every registered action", () => {
    actionRegistry.listTypes().forEach((actionType) => {
      expect(ACTION_METADATA[actionType]).toBeDefined();
      expect(ACTION_METADATA[actionType].type).toBe(actionType);
    });
  });

  it("validates all blueprint actions against the registry", () => {
    const missing = parsedBlueprints.flatMap((blueprint) =>
      blueprint.actions
        .filter((action) => !actionRegistry.has(action.type))
        .map((action) => `${blueprint.id}:${action.type}`),
    );

    expect(missing).toEqual([]);
  });
});
