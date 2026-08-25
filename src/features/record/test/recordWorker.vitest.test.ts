import { afterEach, describe, expect, it, vi } from "vitest";
import { createRecordWorkerClient } from "../worker/recordWorkerClient";

describe("record worker client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("submits endorsement choices to the record route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "processing", data: null })));
    await createRecordWorkerClient({ apiBaseUrl: "https://doc.test" }).submit("token", "s1", { heading: { class: "deed", title: "Title" } });
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/record/s1/endorsement", expect.objectContaining({ method: "POST", cache: "no-store", body: expect.stringContaining("pdf_confirmation") }));
  });

  it("returns every record artifact URL unchanged", async () => {
    const data = {
      pdf_confirmation: "https://storage.test/subscription/s1/confirmation.pdf?sig=token",
      pdf_record: "https://storage.test/subscription/s1/record.pdf?sig=token",
      tiff_record: "https://storage.test/subscription/s1/record.tiff?sig=token",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", data: JSON.stringify(data) })));

    await expect(createRecordWorkerClient({ apiBaseUrl: "https://doc.test" }).data("token", "s1")).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith("https://doc.test/v1/record/s1/data", expect.objectContaining({ method: "GET", cache: "no-store" }));
  });
});
