import { afterEach, expect, it, vi } from "vitest";
import { createComputeWorkerClient } from "../../features/compute/worker/computeWorkerClient";

afterEach(() => vi.restoreAllMocks());
it.each([429, 503])("preserves %s and retry availability through the compute caller without replay", async status => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"error":"Unavailable"}', { status, headers: { "Retry-After": "30" } }));
  await expect(createComputeWorkerClient({ apiBaseUrl: "https://gateway" }).data("token", "session")).rejects.toMatchObject({ status, retryAfter: "30", retryAt: expect.any(Number), error: expect.stringContaining("Retry after ") });
  expect(fetch).toHaveBeenCalledOnce();
});
