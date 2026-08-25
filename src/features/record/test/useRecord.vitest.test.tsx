import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRecord } from "../hook/useRecord";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";

afterEach(() => useCapabilityDataStore.getState().reset());

describe("useRecord", () => {
  it("uses status-first flow and completes with data", async () => {
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    const data = {
      pdf_confirmation: "https://storage.test/subscription/s/confirmation.pdf?sig=token",
      pdf_record: "https://storage.test/subscription/s/record.pdf?sig=token",
      tiff_record: "https://storage.test/subscription/s/record.tiff?sig=token",
    };
    renderHook(() => useRecord({
      request: { authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-record", session: "s" },
      onComplete,
      onError: vi.fn(),
      onProgress,
      workerClient: {
        status: async () => ({ data: null, status: "completed" }),
        computeData: async () => ({ heading: { class: "deed", title: "Title" } }),
        submit: async () => ({ data: null, status: "processing" }),
        data: async () => data,
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Checking recording status...", phase: "started" }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Recording complete.", phase: "completed" }));
    expect(useCapabilityDataStore.getState().getData("record", "s")).toEqual(data);
  });

  it("reports compute failures with the compute-data operation", async () => {
    const onError = vi.fn();
    const onProgress = vi.fn();
    renderHook(() => useRecord({
      request: { authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-record-compute", session: "s" },
      onComplete: vi.fn(),
      onError,
      onProgress,
      workerClient: {
        status: async () => ({ data: null, status: "processing" }),
        computeData: async () => { throw new Error("Compute failed"); },
        submit: vi.fn(),
        data: vi.fn(),
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "compute-data" })));
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Preparing endorsement details...", phase: "failed" }));
  });
});
