import { afterEach, describe, expect, it, vi } from "vitest";
import { createComputeWorkerClient } from "../worker/computeWorkerClient";

afterEach(() => vi.restoreAllMocks());

describe("session compute model", () => {
  it("loads the model and ETag from the session API", async () => {
    const model = { fee_factors: [], fees: [], funds: [] };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ model }), { headers: { ETag: '"v1"' } }));
    await expect(createComputeWorkerClient({ apiBaseUrl: "https://api.test" }).model("token", "session")).resolves.toEqual({ model, etag: '"v1"' });
    expect(fetch).toHaveBeenCalledWith("https://api.test/v1/compute/session/model", expect.objectContaining({ method: "GET", cache: "no-store" }));
  });

  it("sends the supplied JSON Patch and ETag unchanged", async () => {
    const patch = [{ op: "remove" as const, path: "/funds/0" }];
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ model: { fee_factors: [], fees: [], funds: [] } }), { headers: { ETag: '"v2"' } }));
    await createComputeWorkerClient({ apiBaseUrl: "https://api.test" }).patch("token", "session", '"v1"', patch);
    const options = fetch.mock.calls[0][1]!;
    expect(fetch.mock.calls[0][0]).toBe("https://api.test/v1/compute/session/model");
    expect(options.method).toBe("PATCH");
    expect(new Headers(options.headers).get("If-Match")).toBe('"v1"');
    expect(new Headers(options.headers).get("Content-Type")).toBe("application/json-patch+json");
    expect(JSON.parse(options.body as string)).toEqual(patch);
  });

  it("propagates a stale version without retrying or calculating", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "compute_model_stale", message: "Refresh the model." }), { status: 412 }));
    await expect(createComputeWorkerClient({ apiBaseUrl: "https://api.test" }).patch("token", "session", '"v1"', [{ op: "add", path: "/fees/0", value: ["Fee", "Fee", "1.00"] }])).rejects.toMatchObject({ status: 412 });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects a model response without an ETag", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ model: { fee_factors: [], fees: [], funds: [] } })));
    await expect(createComputeWorkerClient({ apiBaseUrl: "https://api.test" }).model("token", "session")).rejects.toMatchObject({ code: "parse_error" });
  });
});
