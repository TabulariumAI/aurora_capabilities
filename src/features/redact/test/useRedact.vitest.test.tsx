import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRedact } from "../hook/useRedact";

describe("useRedact", () => {
  it("accepts lowercase completed status", async () => {
    const onComplete = vi.fn();
    renderHook(() => useRedact({
      request: { authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-redact", session: "s" },
      onComplete,
      onError: vi.fn(),
      workerClient: {
        status: async () => ({ data: null, status: "completed" }),
        submit: async () => ({ data: null, status: "processing" }),
        data: async () => ({ pdf: "redacted.pdf" }),
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it("reports submit failures with the submit operation", async () => {
    const onError = vi.fn();
    renderHook(() => useRedact({
      request: { authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-redact-submit", session: "s" },
      onComplete: vi.fn(),
      onError,
      workerClient: {
        status: async () => ({ data: null, status: "processing" }),
        submit: async () => { throw new Error("Submit failed"); },
        data: vi.fn(),
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "submit" })));
  });
});
