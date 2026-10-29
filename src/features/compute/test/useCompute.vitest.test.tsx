import type { ResourceRequest } from "aurora-core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCompute } from "../hook/useCompute";
import { computeNeedsRefresh, updateComputeMetadata, useComputeStore } from "../store/computeStore";
import { computeQueueStore } from "../store/computeQueueStore";

const segments = {
  ACKNOWLEDGMENT: "acknowledgment",
  JUDGMENT: "judgment",
  ENDORSEMENT: "endorsement",
  FEE: "configured-fee",
  FEEFACTOR: "factor",
  FUND: "fund",
  LEGAL: "legal",
  MONETARY: "monetary",
  PAGE: "page",
  PARTY: "party",
  PROPERTY: "property",
  REFERENCE: "reference",
  SECRETS: "secrets",
  TITLE: "title",
  TRANSACTION: "transaction",
  VITAL: "vital",
};

afterEach(() => {
  useComputeStore.getState().reset();
  computeQueueStore.getState().reset();
  vi.restoreAllMocks();
});

describe("useCompute", () => {
  it("retains newer metadata events when an earlier resource read settles", async () => {
    let callback!: ResourceRequest["callback"];
    const onComplete = vi.fn();
    const onError = vi.fn();
    renderHook(() => useCompute({
      request: { document: "d", authToken: "t", capability: "compute", refresh: false, documentApiGatewayUrl: "u", intervalMs: 0, requestId: "metadata-order", session: "s" },
      onResource: request => { callback = request.callback; },
      onComplete, onError, onProgress: vi.fn(), segments,
      workerClient: {
        model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: "model-version" }),
        submit: async () => ({ status: "completed", data: "" }),
        status: async () => ({ status: "completed", data: "" }),
        data: async () => ({ result: { fee_factors: [], fees: [], funds: [] }, metadataEtag: "old-version" }),
      },
    }));
    updateComputeMetadata({ session: "s", etag: "new-version" });
    await act(async () => callback({ ok: true, data: "old-version" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(onError).not.toHaveBeenCalled();
    expect(useComputeStore.getState().clientEtag).toBe("new-version");
    expect(computeNeedsRefresh(useComputeStore.getState())).toBe(true);
  });
  it.each([false, true])("does not submit after a failed or canceled eTag request; canceled=%s", async canceled => {
    let callback!: ResourceRequest["callback"];
    const workerClient = { model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }), submit: vi.fn(), status: vi.fn(), data: vi.fn() };
    const onComplete = vi.fn();
    const onError = vi.fn();
    const props = {
      onResource: vi.fn((request: ResourceRequest) => { callback = request.callback; }),
      request: { document: "document.pdf", authToken: "t", capability: "compute" as const, refresh: false, documentApiGatewayUrl: "u", intervalMs: 0, requestId: "resource", session: "s" },
      onComplete, onError, onProgress: vi.fn(), segments, workerClient,
    };
    const view = renderHook(() => useCompute(props));
    await waitFor(() => expect(props.onResource).toHaveBeenCalledOnce());
    expect(workerClient.submit).not.toHaveBeenCalled();
    expect(workerClient.status).not.toHaveBeenCalled();
    if (canceled) view.unmount();
    await act(async () => callback(canceled ? { ok: true, data: "metadata-etag" } : { ok: false, error: "Resource unavailable" }));
    expect(workerClient.submit).not.toHaveBeenCalled();
    expect(workerClient.status).not.toHaveBeenCalled();
    expect(workerClient.data).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    if (canceled) expect(onError).not.toHaveBeenCalled();
    else expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ operation: "submit", error: expect.objectContaining({ error: "Resource unavailable" }) }));
  });

  it.each([false, true])("reads metadata for freshness and omits it from forced calculation; refresh=%s", async refresh => {
    const onResource = vi.fn((request: ResourceRequest) => {
      request.callback({ ok: true, data: "metadata-etag" });
    });
    const submit = vi.fn(async () => ({ status: "completed", data: "" }));
    const onComplete = vi.fn();
    renderHook(() => useCompute({
      onResource,
      request: { document: "document.pdf", authToken: "t", capability: "compute", refresh, documentApiGatewayUrl: "u", intervalMs: 0, requestId: "etag", session: "s" },
      onComplete, onError: vi.fn(), onProgress: vi.fn(), segments,
      workerClient: { model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }), submit, status: async () => ({ status: "completed", data: "" }), data: async () => ({ result: { fee_factors: [], fees: [], funds: [] }, metadataEtag: "" }) },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(onResource).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ resource: "metadata_etag", session: "s", callback: expect.any(Function) }));
    expect(submit).toHaveBeenCalledExactlyOnceWith("t", "s", refresh ? null : "metadata-etag", refresh);
  });
  it.each([false, true])("submits once and polls status before retrieving data; refresh=%s", async refresh => {
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    const calls: string[] = [];
    const data = { fee_factors: [], fees: [], funds: [] };
    renderHook(() => useCompute({
      onResource: (request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" }),
      request: { document: "document.pdf", authToken: "t", capability: "compute", refresh, documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r", session: "s" },
      onComplete,
      onError: vi.fn(),
      onProgress,
      segments,
      workerClient: { model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }),
        submit: vi.fn(async () => { calls.push("submit"); return { data: null, status: "processing" }; }),
        status: vi.fn(async () => { calls.push("status"); return { data: null, status: calls.filter((v) => v === "status").length > 1 ? "completed" : "processing" }; }),
        data: vi.fn(async () => { calls.push("data"); return ({ result: data, metadataEtag: "" }); }),
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(useComputeStore.getState().openSegment).toBe("configured-fee");
    expect(calls).toEqual(["submit", "status", "status", "data"]);
    expect(computeQueueStore.getState().data.s).toEqual(data);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Starting fee calculation...", phase: "started" }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Calculating document fees...", phase: "started", progress: { completed: 0, total: 27, unit: "steps" } }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Calculating document fees...", phase: "started", progress: { completed: 1, total: 27, unit: "steps" } }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Fee calculation complete.", phase: "completed" }));
  });

  it.each([false, true])("reports data failures with the data operation; refresh=%s", async refresh => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onError = vi.fn();
    const onProgress = vi.fn();
    renderHook(() => useCompute({
      onResource: (request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" }),
      request: { document: "document.pdf", authToken: "t", capability: "compute", refresh, documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-data", session: "s" },
      onComplete: vi.fn(),
      onError,
      onProgress,
      segments,
      workerClient: { model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }),
        submit: async () => ({ data: null, status: "completed" }),
        status: async () => ({ data: null, status: "completed" }),
        data: async () => { throw new Error("Data failed"); },
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "data" })));
    expect(computeQueueStore.getState().data.s).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Preparing fee details...", phase: "failed" }));
  });

  it.each(["submit", "status"] as const)("reports refresh %s failures without retrieving data", async operation => {
    const onError = vi.fn();
    const onComplete = vi.fn();
    const workerClient = { model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }),
      submit: vi.fn(async () => ({ status: operation === "submit" ? "error" : "processing", data: "Compute failed" })),
      status: vi.fn(async () => ({ status: "error", data: "Compute failed" })),
      data: vi.fn(),
    };
    renderHook(() => useCompute({
      onResource: (request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" }),
      request: { document: "document.pdf", authToken: "t", capability: "compute", refresh: true, documentApiGatewayUrl: "u", intervalMs: 0, requestId: "refresh-failure", session: "s" },
      onComplete, onError, onProgress: vi.fn(), segments, workerClient,
    }));
    await waitFor(() => expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ operation, error: expect.objectContaining({ error: "Compute failed" }) })));
    expect(workerClient.data).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(useComputeStore.getState().status).toBe("error");
  });
});


it.each([[false, false], [false, true], [true, false], [true, true]])("publishes only after data is ready; refresh=%s canceled=%s", async (refresh, canceled) => {
  let finish!: (value: typeof data) => void;
  const data = { fee_factors: [], fees: [], funds: [] };
  const workerClient = { model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }),
    submit: vi.fn(async () => ({ status: "completed", data: null })),
    status: vi.fn(async () => ({ status: "completed", data: null })),
    data: vi.fn(() => new Promise<{ result: typeof data; metadataEtag: string }>((resolve) => { finish = result => resolve({ result, metadataEtag: "" }); })),
  };
  const props = { onResource: (request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" }), segments, request: { authToken: "t", capability: "compute" as const, refresh, documentApiGatewayUrl: "u", document: "d", intervalMs: 0, requestId: "event-compute", session: "event-session" }, onComplete: vi.fn(), onError: vi.fn(), onProgress: vi.fn(), workerClient };
  const view = renderHook(() => useCompute(props));
  await waitFor(() => expect(workerClient.data).toHaveBeenCalledOnce());
  if (canceled) view.unmount();
  await act(async () => finish(data));
  if (canceled) {
    expect(props.onComplete).not.toHaveBeenCalled();
  } else {
    expect(props.onComplete).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ result: data, session: "event-session" }));
    view.rerender();
    expect(props.onComplete).toHaveBeenCalledOnce();
    view.unmount();
  }
});


it.each([500, 7500, 10000].flatMap(intervalMs => [false, true].map(complete => ({ intervalMs, complete }))))("preserves the compute polling budget at $intervalMs ms; completed=$complete", async ({ intervalMs, complete }) => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onError = vi.fn();
  const onProgress = vi.fn();
  const workerClient = { model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }),
    submit: vi.fn(async () => ({ status: "processing", data: null })),
    status: vi.fn(async () => ({ status: "processing", data: null })),
    data: vi.fn(async () => ({ result: { fee_factors: [], fees: [], funds: [] }, metadataEtag: "" })),
  };
  const view = renderHook(() => useCompute({
    request: { document: "document.pdf", authToken: "t", capability: "compute", refresh: false, documentApiGatewayUrl: "u", intervalMs, requestId: `budget-compute-${complete}`, session: "budget-session" },
    onComplete, onError, onProgress, workerClient, onResource: (request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" }), segments,
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
    expect(onProgress.mock.calls.filter(([event]) => event.progress).at(-1)?.[0].progress.completed).toBe(27);
    for (const [event] of onProgress.mock.calls) {
      if (event.progress) expect(event.progress.completed).toBeLessThanOrEqual(event.progress.total);
    }
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});
