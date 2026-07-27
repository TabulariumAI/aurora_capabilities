import { describe, expect, it } from "vitest";
import { useRedactStore } from "../store/redactStore";

describe("redact store", () => {
  it("tracks delivery notice", () => {
    useRedactStore.getState().reset();
    useRedactStore.getState().setDelivery(true, "Preparing redacted PDF download...");
    expect(useRedactStore.getState().deliveryNotice).toBe("Preparing redacted PDF download...");
  });
});
