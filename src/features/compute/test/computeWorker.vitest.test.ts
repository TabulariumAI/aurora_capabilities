import { afterEach, describe, expect, it, vi } from "vitest";
import { createComputeWorkerClient } from "../worker/computeWorkerClient";

describe("compute worker client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the compute route with no-store fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", data: "{}" })));
    await createComputeWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1");
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/compute/s1/calculate", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });

  it("returns JSON data from the compute data route", async () => {
    const data = { heading: { class: "deed", title: "Title" } };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", data: JSON.stringify(data) })));

    await expect(createComputeWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/compute/s1/data", expect.objectContaining({ method: "GET", cache: "no-store" }));
  });
});
