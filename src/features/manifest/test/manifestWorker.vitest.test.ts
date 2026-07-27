import { afterEach, describe, expect, it, vi } from "vitest";
import { createManifestWorkerClient } from "../worker/manifestWorkerClient";

describe("manifest worker client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("uses report route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "processing", data: null })));
    await createManifestWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1");
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/manifest/s1/report", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });
});
