import { afterEach, describe, expect, it, vi } from "vitest";
import { createRedactWorkerClient } from "../worker/redactWorkerClient";

describe("redact worker client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("uses mask route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "processing", data: null })));
    await createRedactWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1");
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/redact/s1/mask", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });

  it("returns every redaction artifact URL unchanged", async () => {
    const data = {
      pdf: "https://storage.test/subscription/s1/redacted.pdf?sig=token",
      tif: "https://storage.test/subscription/s1/redacted.tiff?sig=token",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "COMPLETED", data: JSON.stringify(data) })));

    await expect(createRedactWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/redact/s1/data", expect.objectContaining({ method: "GET", cache: "no-store" }));
  });
});
