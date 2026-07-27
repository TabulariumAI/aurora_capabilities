import { describe, expect, it } from "vitest";
import { useComputeStore } from "../store/computeStore";

describe("compute store", () => {
  it("opens, guards stale ready writes, and clears matching sessions", () => {
    useComputeStore.getState().reset();
    const request = { authToken: "t", capability: "compute" as const, documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r1", session: "s1" };
    useComputeStore.getState().open(request, "fee");
    useComputeStore.getState().setReady("stale", "");
    expect(useComputeStore.getState().status).toBe("loading");
    useComputeStore.getState().clearSession("s1");
    expect(useComputeStore.getState().status).toBe("idle");
  });
});
