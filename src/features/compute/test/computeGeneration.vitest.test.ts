import { afterEach, expect, it, vi } from "vitest";
import { generateCompute, useComputeStore } from "../../../public-api";

afterEach(() => vi.restoreAllMocks());

it("starts background Compute without opening its panel or requiring metadata", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "processing", data: "" })));
  await expect(generateCompute({ apiGatewayUrl: "https://gateway", authToken: "token", session: "s" })).resolves.toMatchObject({ status: "processing" });
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://gateway/v1/compute/s/calculate", expect.objectContaining({ method: "POST", body: '{"etag":null}' }));
  expect(useComputeStore.getState().visible).toBe(false);
});

it("propagates a rejected background calculation to orchestration", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "error", data: "Calculation failed" })));
  await expect(generateCompute({ apiGatewayUrl: "https://gateway", authToken: "token", session: "s" })).rejects.toMatchObject({ error: "Calculation failed" });
});
