import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompositionWorkerClient } from "../worker/compositionWorkerClient";

describe("composition worker client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("uses the composition link route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", data: "{}" })));
    await createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1");
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/composition/s1/link", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });

  it("loads address and parcel ID batch-name options from index metadata", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: JSON.stringify({ indexes: [
        { aspect: "parcel_address", value: "10 Main Street" },
        { aspect: "parcel_id", value: "APN-123" },
        { aspect: "parcel_reference", value: "REF-9" },
      ] }),
      status: "completed",
    })));

    await expect(createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).options("token", "session/1")).resolves.toEqual([
      "10 Main Street",
      "APN-123",
    ]);
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/index/session%2F1/data", expect.objectContaining({ method: "GET", cache: "no-store" }));
  });

  it("returns JSON data from the composition data route", async () => {
    const data = { chain: [], history: {} };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", data: JSON.stringify(data) })));

    await expect(createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/composition/s1/data", expect.objectContaining({ method: "GET", cache: "no-store" }));
  });
});
