import { describe, expect, it } from "vitest";
import { useCompositionStore } from "../store/compositionStore";

describe("composition store", () => {
  it("opens with default segment and resets", () => {
    useCompositionStore.getState().reset();
    useCompositionStore.getState().open({ authToken: "t", capability: "composition", documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r", session: "s" }, "chain");
    expect(useCompositionStore.getState().openSegment).toBe("chain");
    useCompositionStore.getState().reset();
    expect(useCompositionStore.getState().request).toBeNull();
  });
});
