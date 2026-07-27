import { afterEach, describe, expect, it, vi } from "vitest";
import { createRecordWorkerClient } from "../worker/recordWorkerClient";

describe("record worker client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("submits endorsement choices to legacy route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "processing", data: null })));
    await createRecordWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1", { heading: { class: "deed", title: "Title" } });
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/record/s1/endorsement", expect.objectContaining({ method: "POST", cache: "no-store", body: expect.stringContaining("pdf_confirmation") }));
  });
});
