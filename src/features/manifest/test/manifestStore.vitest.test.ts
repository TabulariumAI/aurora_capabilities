import { describe, expect, it } from "vitest";
import { useManifestStore } from "../store/manifestStore";

describe("manifest store", () => {
  it("tracks delivery notice", () => {
    useManifestStore.getState().reset();
    useManifestStore.getState().setDelivery(true, "Preparing manifest PDF download...");
    expect(useManifestStore.getState().deliveryNotice).toBe("Preparing manifest PDF download...");
  });
});
