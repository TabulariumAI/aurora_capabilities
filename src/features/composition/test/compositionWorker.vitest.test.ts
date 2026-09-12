import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompositionWorkerClient } from "../worker/compositionWorkerClient";

describe("composition worker client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("uses the composition link route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", data: "{}" })));
    await createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1");
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/composition/s1/link", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });

  it("loads address and parcel ID options from composition metadata", async () => {
    const sasUrl = "https://storage.test/subscription/session/mdata.json?sig=token";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: sasUrl, status: "completed" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ indexes: [
        { aspect: "parcel_address", value: "10 Main Street" },
        { aspect: "parcel_id", value: "APN-123" },
        { aspect: "parcel_reference", value: "REF-9" },
      ] })));

    await expect(createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).options("token", "session/1")).resolves.toEqual([
      "10 Main Street",
      "APN-123",
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://doc.test/v1/composition/session%2F1/data", expect.objectContaining({ method: "GET", cache: "no-store" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, sasUrl);
  });

  it("downloads JSON data from the completed composition SAS URL", async () => {
    const data = { chain: [], history: {} };
    const sasUrl = "https://storage.test/subscription/session/composition.json?sig=token";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", data: sasUrl })))
      .mockResolvedValueOnce(new Response(JSON.stringify(data)));

    await expect(createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://doc.test/v1/composition/s1/data", expect.objectContaining({ method: "GET", cache: "no-store" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, sasUrl);
  });

  it("rejects incomplete composition data without downloading a Blob", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "processing", data: "" })));

    await expect(createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).rejects.toEqual({
      code: "composition_not_completed",
      details: { status: "processing", data: "" },
      error: "processing",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the composition Blob HTTP failure", async () => {
    const sasUrl = "https://storage.test/subscription/session/composition.json?sig=token";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", data: sasUrl })))
      .mockResolvedValueOnce(new Response("Denied", { status: 403, statusText: "Forbidden" }));

    await expect(createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).rejects.toEqual({
      code: "server_error",
      error: "HTTP 403 Forbidden",
      status: 403,
    });
  });

  it("returns the composition Blob network failure", async () => {
    const sasUrl = "https://storage.test/subscription/session/composition.json?sig=token";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", data: sasUrl })))
      .mockRejectedValueOnce(new Error("Blob unavailable"));

    await expect(createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1"))
      .rejects.toThrow("Blob unavailable");
  });

  it("returns invalid JSON from the composition Blob", async () => {
    const sasUrl = "https://storage.test/subscription/session/composition.json?sig=token";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", data: sasUrl })))
      .mockResolvedValueOnce(new Response("{"));

    await expect(createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).rejects.toEqual({
      code: "parse_error",
      error: "Azure Blob response is not valid JSON.",
      status: 200,
    });
  });
});
