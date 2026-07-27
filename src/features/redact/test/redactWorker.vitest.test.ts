import { afterEach, describe, expect, it, vi } from "vitest";
import { createRedactWorkerClient } from "../worker/redactWorkerClient";

describe("redact worker client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("uses mask route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "processing", data: null })));
    await createRedactWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1");
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/redact/s1/mask", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });
});
