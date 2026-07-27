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
});
