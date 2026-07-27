import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompositionWorkerClient } from "../worker/compositionWorkerClient";

describe("composition worker client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("uses legacy composition link route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", data: "{}" })));
    await createCompositionWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1");
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/composition/s1/link", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });
});
