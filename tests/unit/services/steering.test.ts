import { describe, it, expect, beforeEach } from "vitest";
import { SteeringController } from "../../../server/services/judgment/steering";

let controller: SteeringController;

beforeEach(() => {
  controller = new SteeringController();
});

describe("SteeringController", () => {
  it("starts with empty state", () => {
    const state = controller.getState();
    expect(state.directives).toEqual([]);
    expect(state.forcedTool).toBeNull();
    expect(state.injectedConstraints).toEqual([]);
  });

  it("inject_constraint adds to state", () => {
    controller.applyDirective({
      action: "inject_constraint",
      value: "no exploitation",
      reason: "safety",
      operatorId: "op-1",
    });
    expect(controller.getInjectedConstraints()).toContain("no exploitation");
  });

  it("remove_constraint removes from state", () => {
    controller.applyDirective({
      action: "inject_constraint",
      value: "no exploitation",
      reason: "safety",
      operatorId: "op-1",
    });
    controller.applyDirective({
      action: "remove_constraint",
      value: "no exploitation",
      reason: "no longer needed",
      operatorId: "op-1",
    });
    expect(controller.getInjectedConstraints()).toEqual([]);
  });

  it("force_tool sets and clears on read", () => {
    controller.applyDirective({
      action: "force_tool",
      value: "nmap",
      reason: "operator override",
      operatorId: "op-1",
    });
    expect(controller.getForcedTool()).toBe("nmap");
    expect(controller.getForcedTool()).toBeNull();
  });

  it("set_confidence overrides", () => {
    controller.applyDirective({
      action: "set_confidence",
      value: 0.9,
      reason: "high confidence",
      operatorId: "op-1",
    });
    expect(controller.getConfidenceOverride()).toBe(0.9);
  });

  it("add_note appends", () => {
    controller.applyDirective({
      action: "add_note",
      value: "first note",
      reason: "context",
      operatorId: "op-1",
    });
    controller.applyDirective({
      action: "add_note",
      value: "second note",
      reason: "context",
      operatorId: "op-1",
    });
    expect(controller.getState().notes.length).toBe(2);
  });

  it("getHistory tracks all directives", () => {
    controller.applyDirective({
      action: "inject_constraint",
      value: "constraint-1",
      reason: "r1",
      operatorId: "op-1",
    });
    controller.applyDirective({
      action: "force_tool",
      value: "nmap",
      reason: "r2",
      operatorId: "op-1",
    });
    controller.applyDirective({
      action: "add_note",
      value: "note-1",
      reason: "r3",
      operatorId: "op-1",
    });
    expect(controller.getHistory().length).toBe(3);
  });

  it("formatForPrompt renders active steering", () => {
    controller.applyDirective({
      action: "inject_constraint",
      value: "stay in scope",
      reason: "safety",
      operatorId: "op-1",
    });
    const output = controller.formatForPrompt();
    expect(output).toContain("Operator Steering");
    expect(output).toContain("stay in scope");
  });

  it("formatForPrompt returns empty when nothing active", () => {
    expect(controller.formatForPrompt()).toBe("");
  });

  it("reset clears state but keeps history", () => {
    controller.applyDirective({
      action: "inject_constraint",
      value: "constraint-1",
      reason: "r1",
      operatorId: "op-1",
    });
    controller.applyDirective({
      action: "add_note",
      value: "note-1",
      reason: "r2",
      operatorId: "op-1",
    });

    controller.reset();

    const state = controller.getState();
    expect(state.directives).toEqual([]);
    expect(state.injectedConstraints).toEqual([]);
    expect(state.notes).toEqual([]);
    expect(controller.getHistory().length).toBe(2);
  });
});
