import { afterEach, describe, expect, it, vi } from "vitest";
import { createComputeWorkerClient } from "../worker/computeWorkerClient";

describe("compute worker client", () => {
  it.each(["source-one", ""])("retains the generated source from the data envelope, source=%s", async source => {
    const result = { fee_factors: [], fees: [], funds: [] };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", data: "https://blob/result.json", metadata_etag: source })))
      .mockResolvedValueOnce(new Response(JSON.stringify(result)));
    await expect(createComputeWorkerClient({ apiBaseUrl: "x" }).data("t", "s"))
      .resolves.toEqual({ result, metadataEtag: source });
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([false, true])("uses the requested compute route with no-store fetch; refresh=%s", async refresh => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", data: "{}" })));
    await createComputeWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1", "metadata-etag", refresh);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`https://doc.test/v1/compute/s1/${refresh ? "recalculate" : "calculate"}`, expect.objectContaining({ method: "POST", cache: "no-store", body: JSON.stringify(refresh ? {} : { etag: "metadata-etag" }) }));
  });

  it("downloads only Computedata from the returned blob URL", async () => {
    const data = { fee_factors: [], fees: [{ name: "Recording", amount: "40", formula: "40" }], funds: [] };
    const path = "https://blob.test/s1/computedata.json?sig=test";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", data: path, metadata_etag: "" })))
      .mockResolvedValueOnce(new Response(JSON.stringify(data)));

    await expect(createComputeWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).resolves.toEqual({ result: data, metadataEtag: "" });
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/compute/s1/data", expect.objectContaining({ method: "GET", cache: "no-store" }));
    expect(fetchMock).toHaveBeenLastCalledWith(path);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([null, "", "different"])("sends metadata etag %s unchanged", async (etag) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "processing", data: "" })));
    await createComputeWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1", etag, false);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ etag }));
  });

  it.each([null, "", "metadata-etag"])("omits metadata eTag on refresh regardless of the supplied value; etag=%s", async etag => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "processing", data: "" })));
    await createComputeWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1", etag, true);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("https://doc.test/v1/compute/s1/recalculate", expect.objectContaining({ body: "{}" }));
  });

  it("propagates failed blob downloads", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", data: "https://blob.test/computedata.json", metadata_etag: "" })))
      .mockResolvedValueOnce(new Response("Denied", { status: 403 }));
    await expect(createComputeWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).rejects.toMatchObject({ status: 403 });
  });
  it("rejects a null Computedata payload", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", data: "https://blob.test/computedata.json", metadata_etag: "" })))
      .mockResolvedValueOnce(new Response("null"));
    await expect(createComputeWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).rejects.toMatchObject({ code: "parse_error" });
  });
});
