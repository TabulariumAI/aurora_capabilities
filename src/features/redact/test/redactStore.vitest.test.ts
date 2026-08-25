import { describe, expect, it } from "vitest";
import { useRedactStore } from "../store/redactStore";

describe("redact store", () => {
  it("tracks delivery notice", () => {
    useRedactStore.getState().reset();
    useRedactStore.getState().setDelivery(true, "Preparing redacted PDF download...");
    expect(useRedactStore.getState().deliveryNotice).toBe("Preparing redacted PDF download...");
  });

  it("keeps the capability visible after a terminal failure", () => {
    useRedactStore.getState().reset();
    useRedactStore.getState().open({ authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r", session: "s" });
    expect(useRedactStore.getState().setRunning("r")).toBe(true);
    useRedactStore.getState().setError({
      capability: "redact",
      error: { error: "No secrets found to redact" },
      operation: "status",
      requestId: "r",
      session: "s",
    });

    expect(useRedactStore.getState().visible).toBe(true);
    expect(useRedactStore.getState().status).toBe("error");
    expect(useRedactStore.getState().runningRequestId).toBeNull();
  });
});
