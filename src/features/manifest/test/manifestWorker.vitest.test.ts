import { afterEach, describe, expect, it, vi } from "vitest";
import { createManifestWorkerClient } from "../worker/manifestWorkerClient";

describe("manifest worker client", () => {
  afterEach(() => vi.restoreAllMocks());
  it.each(Array.from({ length: 8 }, (_, mask) => mask))("posts the selected options to the report route, combination %i", async mask => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "processing", data: null })));
    const options = { include_pages: Boolean(mask & 1), include_gates: Boolean(mask & 2), include_notes: Boolean(mask & 4) };
    await createManifestWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1", options);
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/manifest/s1/report", expect.objectContaining({ method: "POST", cache: "no-store", body: JSON.stringify(options) }));
  });

  it("returns every manifest artifact URL unchanged", async () => {
    const data = {
      pdf: "https://storage.test/subscription/s1/ReportPage.PDF?sig=token",
      tif: "https://storage.test/subscription/s1/ReportPage.Tiff?sig=token",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", data: JSON.stringify(data) })));

    await expect(createManifestWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/manifest/s1/data", expect.objectContaining({ method: "GET", cache: "no-store" }));
  });
});
