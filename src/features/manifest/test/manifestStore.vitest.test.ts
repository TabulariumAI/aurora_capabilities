import { describe, expect, it } from "vitest";
import { useManifestStore } from "../store/manifestStore";

describe("manifest store", () => {
  it("keeps a ready manifest surface visible", () => {
    useManifestStore.getState().reset();
    useManifestStore.getState().open({ document: "document.pdf", authToken: "token", capability: "manifest", documentApiGatewayUrl: "https://api.test", intervalMs: 1_000, requestId: "request-1", session: "session-1" });
    useManifestStore.getState().setReady("request-1");
    expect(useManifestStore.getState().status).toBe("ready");
  });

  it("keeps the capability visible after a terminal failure", () => {
    useManifestStore.getState().reset();
    useManifestStore.getState().open({ document: "document.pdf", authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r", session: "s" });
    expect(useManifestStore.getState().setRunning("r")).toBe(true);
    useManifestStore.getState().setError({ capability: "manifest", error: { error: "Manifest failed" }, operation: "status", requestId: "r", session: "s" });

    expect(useManifestStore.getState().visible).toBe(true);
    expect(useManifestStore.getState().status).toBe("error");
    expect(useManifestStore.getState().runningRequestId).toBeNull();
  });

  it("confirms only the current request and retains an immutable submitted draft", () => {
    const store = useManifestStore.getState();
    store.reset();
    store.open({ document: "document.pdf", authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r", session: "s" });
    store.setOption("include_pages", true);
    store.confirm("old-request");
    expect(useManifestStore.getState().request?.options).toBeUndefined();
    store.confirm("r");
    const submitted = useManifestStore.getState().request;
    expect(submitted?.options).toEqual({ include_pages: true, include_gates: false, include_notes: false });
    store.setOption("include_notes", true);
    store.confirm("r");
    expect(useManifestStore.getState().request).toBe(submitted);
    expect(useManifestStore.getState().options.include_notes).toBe(false);
    store.clearSession("other-session");
    expect(useManifestStore.getState().request).toBe(submitted);
    store.clearSession("s");
    expect(useManifestStore.getState()).toMatchObject({ request: null, status: "idle", options: { include_pages: false, include_gates: false, include_notes: false } });
  });
});
