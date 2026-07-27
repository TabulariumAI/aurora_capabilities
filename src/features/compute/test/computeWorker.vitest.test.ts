import { afterEach, describe, expect, it, vi } from "vitest";
import { createComputeWorkerClient } from "../worker/computeWorkerClient";

describe("compute worker client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses legacy compute routes and no-store fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", data: "{}" })));
    await createComputeWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1");
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/compute/s1/calculate", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });
});
