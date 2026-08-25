import { describe, expect, it } from "vitest";
import { useRecordStore } from "../store/recordStore";

describe("record store", () => {
  it("closes without clearing in-flight request and reopens", () => {
    useRecordStore.getState().reset();
    useRecordStore.getState().open({ authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r", session: "s" });
    useRecordStore.getState().close();
    expect(useRecordStore.getState().request?.requestId).toBe("r");
    useRecordStore.getState().reopen();
    expect(useRecordStore.getState().visible).toBe(true);
  });

  it("keeps the capability visible after a terminal failure", () => {
    useRecordStore.getState().reset();
    useRecordStore.getState().open({ authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 1, requestId: "r", session: "s" });
    expect(useRecordStore.getState().setRunning("r")).toBe(true);
    useRecordStore.getState().setError({ capability: "record", error: { error: "Record failed" }, operation: "status", requestId: "r", session: "s" });

    expect(useRecordStore.getState().visible).toBe(true);
    expect(useRecordStore.getState().status).toBe("error");
    expect(useRecordStore.getState().runningRequestId).toBeNull();
  });
});
