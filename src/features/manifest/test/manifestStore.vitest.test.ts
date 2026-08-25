import { describe, expect, it } from "vitest";
import { useManifestStore } from "../store/manifestStore";

describe("manifest store", () => {
  it("keeps a ready manifest surface visible", () => {
    useManifestStore.getState().reset();
    useManifestStore.getState().open({ authToken: "token", capability: "manifest", documentApiGatewayUrl: "https://api.test", intervalMs: 1_000, requestId: "request-1", session: "session-1" });
    useManifestStore.getState().setReady("request-1");
    expect(useManifestStore.getState().status).toBe("ready");
  });

  it("keeps the capability visible after a terminal failure", () => {
    useManifestStore.getState().reset();
    useManifestStore.getState().open({ authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r", session: "s" });
    expect(useManifestStore.getState().setRunning("r")).toBe(true);
    useManifestStore.getState().setError({ capability: "manifest", error: { error: "Manifest failed" }, operation: "status", requestId: "r", session: "s" });

    expect(useManifestStore.getState().visible).toBe(true);
    expect(useManifestStore.getState().status).toBe("error");
    expect(useManifestStore.getState().runningRequestId).toBeNull();
  });
});
