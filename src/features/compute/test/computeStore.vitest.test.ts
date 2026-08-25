import { describe, expect, it } from "vitest";
import { useComputeStore } from "../store/computeStore";

describe("compute store", () => {
  it("opens, guards stale ready writes, and clears matching sessions", () => {
    useComputeStore.getState().reset();
    const request = { authToken: "t", capability: "compute" as const, documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r1", session: "s1" };
    useComputeStore.getState().open(request, "fee");
    expect(useComputeStore.getState()).toMatchObject({ openSegment: "fee", status: "loading", visible: true });
    useComputeStore.getState().setReady("stale");
    expect(useComputeStore.getState().status).toBe("loading");
    useComputeStore.getState().clearSession("s1");
    expect(useComputeStore.getState()).toMatchObject({ status: "idle", visible: false });
  });

  it("clears the active request after a terminal failure", () => {
    useComputeStore.getState().reset();
    const request = { authToken: "t", capability: "compute" as const, documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r1", session: "s1" };
    useComputeStore.getState().open(request, "fee");
    expect(useComputeStore.getState().setRunning(request.requestId)).toBe(true);

    useComputeStore.getState().setError({ capability: "compute", error: { error: "Compute failed" }, operation: "status", requestId: request.requestId, session: request.session });

    expect(useComputeStore.getState()).toMatchObject({ status: "error", visible: true });
    expect(useComputeStore.getState().runningRequestId).toBeNull();
  });

  it("keeps the completed capability surface visible", () => {
    useComputeStore.getState().reset();
    const request = { authToken: "t", capability: "compute" as const, documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r1", session: "s1" };
    useComputeStore.getState().open(request, "fee");

    useComputeStore.getState().setReady(request.requestId);

    expect(useComputeStore.getState()).toMatchObject({ status: "ready", visible: true });
  });
});
