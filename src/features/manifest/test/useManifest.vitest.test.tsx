import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useManifest } from "../hook/useManifest";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";

afterEach(() => useCapabilityDataStore.getState().reset());

describe("useManifest", () => {
  it("completes status-first manifest flow", async () => {
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    const data = {
      pdf: "https://storage.test/subscription/s/ReportPage.PDF?sig=token",
      tif: "https://storage.test/subscription/s/ReportPage.Tiff?sig=token",
    };
    renderHook(() => useManifest({
      request: { document: "document.pdf", authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-manifest", session: "s" },
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
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Checking manifest status...", phase: "started" }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Manifest is ready to download.", phase: "completed" }));
    expect(useCapabilityDataStore.getState().getData("manifest", "s")).toEqual(data);
  });

  it("reports data failures with the data operation", async () => {
    const onError = vi.fn();
    const onProgress = vi.fn();
    renderHook(() => useManifest({
      request: { document: "document.pdf", authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-manifest-data", session: "s" },
      onComplete: vi.fn(),
      onError,
      onProgress,
      workerClient: {
        status: async () => ({ data: null, status: "completed" }),
        submit: vi.fn(),
        data: async () => { throw new Error("Data failed"); },
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "data" })));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ error: "Manifest data retrieval failed: Data failed" }),
    }));
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Preparing manifest download...", phase: "failed" }));
  });

  it("advances the manifest timer counter without adding status requests", async () => {
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    let checks = 0;
    renderHook(() => useManifest({
      request: { document: "document.pdf", authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-manifest-counter", session: "s" },
      onComplete,
      onError: vi.fn(),
      onProgress,
      workerClient: {
        status: async () => ({ data: null, status: ++checks > 1 ? "completed" : "processing" }),
        submit: async () => ({ data: null, status: "processing" }),
        data: async () => ({ pdf: "manifest.pdf" }),
      },
    }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(checks).toBe(2);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Generating document manifest...", progress: { completed: 0, total: 21, unit: "steps" } }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Generating document manifest...", progress: { completed: 1, total: 21, unit: "steps" } }));
  });

  it("reports an empty status failure with one fallback", async () => {
    const onError = vi.fn();
    const onProgress = vi.fn();
    renderHook(() => useManifest({
      request: { document: "document.pdf", authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-manifest-status", session: "s" },
      onComplete: vi.fn(),
      onError,
      onProgress,
      workerClient: {
        status: async () => ({ data: null, status: "error" }),
        submit: vi.fn(),
        data: vi.fn(),
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ error: "Manifest checkStatus failed." }),
      operation: "status",
    })));
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ error: "Manifest checkStatus failed.", phase: "failed" }));
  });
});

afterEach(() => vi.restoreAllMocks());

it.each([false, true])("publishes only after data is ready; canceled=%s", async (canceled) => {
  let finish!: (value: { pdf: string; chain: never[] }) => void;
  const data = { pdf: "https://test/document.pdf", chain: [] as never[] };
  const workerClient = {
    submit: vi.fn(async () => ({ status: "completed", data: null })),
    status: vi.fn(async () => ({ status: "completed", data: null })),
    data: vi.fn(() => new Promise<typeof data>((resolve) => { finish = resolve; })),
  };
  const props = { request: { authToken: "t", capability: "manifest" as const, documentApiGatewayUrl: "u", document: "d", intervalMs: 0, requestId: "event-manifest", session: "event-session" }, onComplete: vi.fn(), onError: vi.fn(), onProgress: vi.fn(), workerClient };
  const view = renderHook(() => useManifest(props));
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


it.each([500, 1000, 6000, 7500].flatMap(intervalMs => [false, true].map(complete => ({ intervalMs, complete }))))("preserves the manifest polling budget at $intervalMs ms; completed=$complete", async ({ intervalMs, complete }) => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onError = vi.fn();
  const onProgress = vi.fn();
  const workerClient = {
    submit: vi.fn(async () => ({ status: "processing", data: null })),
    status: vi.fn(async () => ({ status: "processing", data: null })),
    data: vi.fn(async () => ({ pdf: "document.pdf", chain: [] })),
  };
  const view = renderHook(() => useManifest({
    request: { document: "document.pdf", authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs, requestId: `budget-manifest-${complete}`, session: "budget-session" },
    onComplete, onError, onProgress, workerClient,
  }));
  try {
    await act(async () => { await vi.advanceTimersByTimeAsync(157000); });
    expect(onError).not.toHaveBeenCalled();
    expect(workerClient.data).not.toHaveBeenCalled();
    expect(workerClient.status).toHaveBeenCalledTimes(Math.floor(157000 / intervalMs) + 1);
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
