import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCompute } from "../hook/useCompute";

describe("useCompute", () => {
  it("runs submit/status/resubmit/status/data", async () => {
    const onComplete = vi.fn();
    const calls: string[] = [];
    renderHook(() => useCompute({
      request: { authToken: "t", capability: "compute", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r", session: "s" },
      onComplete,
      onError: vi.fn(),
      workerClient: {
        submit: vi.fn(async () => { calls.push("submit"); return { data: null, status: "processing" }; }),
        status: vi.fn(async () => { calls.push("status"); return { data: null, status: calls.filter((v) => v === "status").length > 1 ? "completed" : "processing" }; }),
        data: vi.fn(async () => { calls.push("data"); return "" as const; }),
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(calls).toEqual(["submit", "status", "submit", "status", "data"]);
  });
});
