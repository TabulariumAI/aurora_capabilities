import { describe, expect, it } from "vitest";
import { useCompositionStore } from "../store/compositionStore";

describe("composition store", () => {
  it("opens with default segment and resets", () => {
    useCompositionStore.getState().reset();
    useCompositionStore.getState().open({ authToken: "t", capability: "composition", documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r", session: "s" }, "chain");
    expect(useCompositionStore.getState()).toMatchObject({ openSegment: "chain", visible: true });
    useCompositionStore.getState().reset();
    expect(useCompositionStore.getState()).toMatchObject({ request: null, visible: false });
  });

  it("clears the active request after a terminal failure", () => {
    useCompositionStore.getState().reset();
    const request = { authToken: "t", capability: "composition" as const, documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r", session: "s" };
    useCompositionStore.getState().open(request, "chain");
    expect(useCompositionStore.getState().setRunning(request.requestId)).toBe(true);

    useCompositionStore.getState().setError({ capability: "composition", error: { error: "Composition failed" }, operation: "status", requestId: request.requestId, session: request.session });

    expect(useCompositionStore.getState()).toMatchObject({ status: "error", visible: true });
    expect(useCompositionStore.getState().runningRequestId).toBeNull();
  });

  it("keeps the completed capability surface visible", () => {
    useCompositionStore.getState().reset();
    const request = { authToken: "t", capability: "composition" as const, documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r", session: "s" };
    useCompositionStore.getState().open(request, "chain");

    useCompositionStore.getState().setReady(request.requestId);

    expect(useCompositionStore.getState()).toMatchObject({ status: "ready", visible: true });
  });
});
