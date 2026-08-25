import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRedact } from "../hook/useRedact";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";

afterEach(() => useCapabilityDataStore.getState().reset());

describe("useRedact", () => {
  it("accepts lowercase completed status", async () => {
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    const data = { pdf: "https://storage.test/subscription/s/redacted.pdf?sig=token" };
    renderHook(() => useRedact({
      request: { authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-redact", session: "s" },
      onComplete,
      onError: vi.fn(),
      onProgress,
      workerClient: {
        status: async () => ({ data: null, status: "completed" }),
        submit: async () => ({ data: null, status: "processing" }),
        data: async () => data,
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Checking redaction status...", phase: "started" }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Redaction complete.", phase: "completed" }));
    expect(useCapabilityDataStore.getState().getData("redact", "s")).toEqual(data);
  });

  it("reports submit failures with the submit operation", async () => {
    const onError = vi.fn();
    const onProgress = vi.fn();
    renderHook(() => useRedact({
      request: { authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-redact-submit", session: "s" },
      onComplete: vi.fn(),
      onError,
      onProgress,
      workerClient: {
        status: async () => ({ data: null, status: "processing" }),
        submit: async () => { throw new Error("Submit failed"); },
        data: vi.fn(),
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "submit" })));
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Redacting confidential information...", phase: "failed" }));
  });
});
