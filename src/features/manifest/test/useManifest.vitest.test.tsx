import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useManifest } from "../hook/useManifest";

describe("useManifest", () => {
  it("completes status-first manifest flow", async () => {
    const onComplete = vi.fn();
    renderHook(() => useManifest({
      request: { authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-manifest", session: "s" },
      onComplete,
      onError: vi.fn(),
      workerClient: {
        status: async () => ({ data: null, status: "completed" }),
        submit: async () => ({ data: null, status: "processing" }),
        data: async () => ({ pdf: "https://storage.test/manifest.pdf" }),
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it("reports data failures with the data operation", async () => {
    const onError = vi.fn();
    renderHook(() => useManifest({
      request: { authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-manifest-data", session: "s" },
      onComplete: vi.fn(),
      onError,
      workerClient: {
        status: async () => ({ data: null, status: "completed" }),
        submit: vi.fn(),
        data: async () => { throw new Error("Data failed"); },
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "data" })));
  });
});
