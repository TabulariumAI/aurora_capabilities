import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useComposition } from "../hook/useComposition";

describe("useComposition", () => {
  it("completes after polling", async () => {
    const onComplete = vi.fn();
    let checks = 0;
    renderHook(() => useComposition({
      request: { authToken: "t", capability: "composition", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-comp", session: "s" },
      onComplete,
      onError: vi.fn(),
      workerClient: {
        submit: async () => ({ data: null, status: "processing" }),
        status: async () => ({ data: null, status: ++checks > 1 ? "completed" : "processing" }),
        data: async () => ({ heading: { class: "deed", title: "Title" } }),
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it("reports status failures with the status operation", async () => {
    const onError = vi.fn();
    renderHook(() => useComposition({
      request: { authToken: "t", capability: "composition", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-comp-status", session: "s" },
      onComplete: vi.fn(),
      onError,
      workerClient: {
        submit: async () => ({ data: null, status: "processing" }),
        status: async () => { throw new Error("Status failed"); },
        data: vi.fn(),
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "status" })));
  });
});
