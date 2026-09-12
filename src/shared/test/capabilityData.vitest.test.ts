import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, useCapabilityDataStore } from "../worker/capabilityData";

afterEach(() => {
  useCapabilityDataStore.getState().reset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("capability data", () => {
  it("retains every JSON resource for each capability session", () => {
    const manifest = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [
      `resource_${index + 1}`,
      `https://storage.test/subscription/session-1/resource-${index + 1}.pdf?sig=token`,
    ]));
    const record = {
      pdf_confirmation: "https://storage.test/subscription/session-1/confirmation.pdf?sig=token",
      pdf_record: "https://storage.test/subscription/session-1/record.pdf?sig=token",
      tiff_record: "https://storage.test/subscription/session-1/record.tiff?sig=token",
    };

    useCapabilityDataStore.getState().setData("manifest", "session-1", manifest);
    useCapabilityDataStore.getState().setData("record", "session-1", record);

    expect(useCapabilityDataStore.getState().getData("manifest", "session-1")).toEqual(manifest);
    expect(useCapabilityDataStore.getState().getData("record", "session-1")).toEqual(record);
    expect(useCapabilityDataStore.getState().getData("record", "session-2")).toBeNull();

    useCapabilityDataStore.getState().clearSession("session-1");

    expect(useCapabilityDataStore.getState().getData("manifest", "session-1")).toBeNull();
    expect(useCapabilityDataStore.getState().getData("record", "session-1")).toBeNull();
  });

  it("retains computed fees independently for every session", () => {
    const first = { fees: [{ amount: "40", code: "fee-1", name: "Recording fee" }] };
    const second = { fees: [{ amount: "75", code: "fee-2", name: "Transfer fee" }] };

    useCapabilityDataStore.getState().setData("compute", "session-1", first);
    useCapabilityDataStore.getState().setData("compute", "session-2", second);

    expect(useCapabilityDataStore.getState().getData("compute", "session-1")).toEqual(first);
    expect(useCapabilityDataStore.getState().getData("compute", "session-2")).toEqual(second);

    useCapabilityDataStore.getState().clearSession("session-1");

    expect(useCapabilityDataStore.getState().getData("compute", "session-1")).toBeNull();
    expect(useCapabilityDataStore.getState().getData("compute", "session-2")).toEqual(second);
  });

  it("retrieves the complete Azure Blob URL without gateway reconstruction", async () => {
    const source = "https://storage.test/subscription/session-1/ReportPage.PDF?sig=token";
    const blob = new Blob(["manifest"]);
    const fetchMock = vi.fn().mockResolvedValue({ blob: async () => blob, ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadBlob(source)).resolves.toEqual({ blob, name: "ReportPage.PDF" });

    expect(fetchMock).toHaveBeenCalledWith(source);
  });

  it("reports a failed Azure Blob download", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }));

    await expect(downloadBlob("https://storage.test/subscription/session-1/missing.pdf?sig=token"))
      .rejects.toThrow("Failed to fetch the file. Status: 404 Not Found");
  });
});
