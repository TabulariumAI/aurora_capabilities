import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComposition } from "../hook/useComposition";
import { useCompositionStore } from "../store/compositionStore";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";

afterEach(() => {
  useCompositionStore.getState().reset();
  useCapabilityDataStore.getState().reset();
});

describe("useComposition", () => {
  it("completes after polling", async () => {
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    let checks = 0;
    const data = { chain: [] };
    renderHook(() => useComposition({
      request: { document: "document.pdf", authToken: "t", capability: "composition", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-comp", session: "s" },
      onComplete,
      onError: vi.fn(),
      onProgress,
      workerClient: {
        submit: async () => ({ data: null, status: "processing" }),
        status: async () => ({ data: null, status: ++checks > 1 ? "completed" : "processing" }),
        data: async () => data,
        options: vi.fn(),
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(useCompositionStore.getState().openSegment).toBe("chain");
    expect(useCapabilityDataStore.getState().getData("composition", "s")).toEqual(data);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Composing document metadata...", phase: "started", progress: { completed: 1, total: 28, unit: "steps" } }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Composing document metadata...", phase: "started", progress: { completed: 2, total: 28, unit: "steps" } }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Document composition complete.", phase: "completed" }));
  });

  it("reports status failures with the status operation", async () => {
    const onError = vi.fn();
    const onProgress = vi.fn();
    renderHook(() => useComposition({
      request: { document: "document.pdf", authToken: "t", capability: "composition", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-comp-status", session: "s" },
      onComplete: vi.fn(),
      onError,
      onProgress,
      workerClient: {
        submit: async () => ({ data: null, status: "processing" }),
        status: async () => { throw new Error("Status failed"); },
        data: vi.fn(),
        options: vi.fn(),
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "status" })));
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Composing document metadata...", phase: "failed" }));
  });
});

afterEach(() => vi.restoreAllMocks());

it.each([false, true])("publishes only after data is ready; canceled=%s", async (canceled) => {
  let finish!: (value: { pdf: string; chain: never[] }) => void;
  const data = { pdf: "https://test/document.pdf", chain: [] as never[] };
  const workerClient = {
    submit: vi.fn(async () => ({ status: "completed", data: null })),
    status: vi.fn(async () => ({ status: "completed", data: null })),
    data: vi.fn(() => new Promise<typeof data>((resolve) => { finish = resolve; })), options: vi.fn(),
  };
  const props = { request: { authToken: "t", capability: "composition" as const, documentApiGatewayUrl: "u", document: "d", intervalMs: 0, requestId: "event-composition", session: "event-session" }, onComplete: vi.fn(), onError: vi.fn(), onProgress: vi.fn(), workerClient };
  const view = renderHook(() => useComposition(props));
  await waitFor(() => expect(workerClient.data).toHaveBeenCalledOnce());
  if (canceled) view.unmount();
  await act(async () => finish(data));
  if (canceled) {
    expect(props.onComplete).not.toHaveBeenCalled();
  } else {
    view.rerender();
    view.unmount();
  }
});


it.each([500, 1000, 6000, 7500].flatMap(intervalMs => [false, true].map(complete => ({ intervalMs, complete }))))("preserves the composition polling budget at $intervalMs ms; completed=$complete", async ({ intervalMs, complete }) => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onError = vi.fn();
  const onProgress = vi.fn();
  const workerClient = {
    options: vi.fn(async () => []),
    submit: vi.fn(async () => ({ status: "processing", data: null })),
    status: vi.fn(async () => ({ status: "processing", data: null })),
    data: vi.fn(async () => ({ pdf: "document.pdf", chain: [] })),
  };
  const view = renderHook(() => useComposition({
    request: { document: "document.pdf", authToken: "t", capability: "composition", documentApiGatewayUrl: "u", intervalMs, requestId: `budget-composition-${complete}`, session: "budget-session" },
    onComplete, onError, onProgress, workerClient,
  }));
  try {
    await act(async () => { await vi.advanceTimersByTimeAsync(202000); });
    expect(onError).not.toHaveBeenCalled();
    expect(workerClient.data).not.toHaveBeenCalled();
    expect(workerClient.status).toHaveBeenCalledTimes(Math.floor(202000 / intervalMs) + 1);
    if (complete) workerClient.status.mockResolvedValue({ status: "completed", data: null });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(onComplete).toHaveBeenCalledTimes(complete ? 1 : 0);
    expect(onError).toHaveBeenCalledTimes(complete ? 0 : 1);
    expect(workerClient.submit).toHaveBeenCalledOnce();
    expect(workerClient.data).toHaveBeenCalledTimes(complete ? 1 : 0);
    for (const [event] of onProgress.mock.calls) {
      if (event.progress) expect(event.progress.completed).toBeLessThanOrEqual(event.progress.total);
    }
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});
