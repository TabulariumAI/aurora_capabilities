import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRecord } from "../hook/useRecord";

describe("useRecord", () => {
  it("uses status-first flow and completes with data", async () => {
    const onComplete = vi.fn();
    renderHook(() => useRecord({
      request: { authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-record", session: "s" },
      onComplete,
      onError: vi.fn(),
      workerClient: {
        status: async () => ({ data: null, status: "completed" }),
        computeData: async () => ({ heading: { class: "deed", title: "Title" } }),
        submit: async () => ({ data: null, status: "processing" }),
        data: async () => ({ cover: "c", document: "d", heading: { class: "deed", title: "Title" } }),
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });
});
