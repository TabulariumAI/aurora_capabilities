import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
      workerClient: { calculate: async () => ({ status: "completed", data: null }), computation: async () => ({ status: "completed", data: null }),
        status: async () => ({ data: null, status: "completed" }),
        submit: async () => ({ data: null, status: "processing" }),
        data: async () => data,
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Checking recording status...", phase: "started" }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Recording complete.", phase: "completed" }));
    expect(useCapabilityDataStore.getState().getData("record", "s")).toEqual(data);
  });

  it("reports endorsement preparation failures from user_svc as submit failures", async () => {
    const onError = vi.fn();
    const onProgress = vi.fn();
    renderHook(() => useRecord({
      request: { authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-record-compute", session: "s" },
      onComplete: vi.fn(),
      onError,
      onProgress,
      workerClient: { calculate: async () => ({ status: "completed", data: null }), computation: async () => ({ status: "completed", data: null }),
        status: async () => ({ data: null, status: "pending" }),
        submit: async () => { throw new Error("Compute failed"); },
        data: vi.fn(),
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "submit" })));
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Creating endorsement pages...", phase: "failed" }));
  });

  it("advances the recording timer counter without adding status requests", async () => {
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    let checks = 0;
    renderHook(() => useRecord({
      request: { authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-record-counter", session: "s" },
      onComplete,
      onError: vi.fn(),
      onProgress,
      workerClient: { calculate: async () => ({ status: "completed", data: null }), computation: async () => ({ status: "completed", data: null }),
        status: async () => ({ data: null, status: ++checks > 1 ? "completed" : "processing" }),
        submit: async () => ({ data: null, status: "processing" }),
        data: async () => ({ pdf_confirmation: "confirmation.pdf", pdf_record: "record.pdf" }),
      },
    }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(checks).toBe(2);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Recording the document now...", progress: { completed: 0, total: 21, unit: "steps" } }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Recording the document now...", progress: { completed: 1, total: 21, unit: "steps" } }));
  });
});

afterEach(() => vi.restoreAllMocks());

it.each([false, true])("publishes only after data is ready; canceled=%s", async (canceled) => {
  let finish!: (value: { pdf: string; chain: never[] }) => void;
  const data = { pdf: "https://test/document.pdf", chain: [] as never[] };
  const workerClient = { calculate: vi.fn(async () => ({ status: "completed", data: null })), computation: vi.fn(async () => ({ status: "completed", data: null })),
    submit: vi.fn(async () => ({ status: "completed", data: null })),
    status: vi.fn(async () => ({ status: "completed", data: null })),
    data: vi.fn(() => new Promise<typeof data>((resolve) => { finish = resolve; })),
  };
  const props = { request: { authToken: "t", capability: "record" as const, documentApiGatewayUrl: "u", document: "d", intervalMs: 0, requestId: "event-record", session: "event-session" }, onComplete: vi.fn(), onError: vi.fn(), onProgress: vi.fn(), workerClient };
  const view = renderHook(() => useRecord(props));
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


it.each([500, 7500, 10000].flatMap(intervalMs => [false, true].map(complete => ({ intervalMs, complete }))))("preserves the record polling budget at $intervalMs ms; completed=$complete", async ({ intervalMs, complete }) => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onError = vi.fn();
  const onProgress = vi.fn();
  const workerClient = { calculate: vi.fn(async () => ({ status: "completed", data: null })), computation: vi.fn(async () => ({ status: "completed", data: null })),
    submit: vi.fn(async () => ({ status: "processing", data: null })),
    status: vi.fn().mockResolvedValueOnce({ status: "pending", data: null }).mockResolvedValue({ status: "processing", data: null }),
    data: vi.fn(async () => ({ pdf: "document.pdf", chain: [] })),
  };
  const view = renderHook(() => useRecord({
    request: { document: "document.pdf", authToken: "t", capability: "record", documentApiGatewayUrl: "u", intervalMs, requestId: `budget-record-${complete}`, session: "budget-session" },
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
    expect(onProgress.mock.calls.filter(([event]) => event.progress).at(-1)?.[0].progress.completed).toBe(21);
    for (const [event] of onProgress.mock.calls) {
      if (event.progress) expect(event.progress.completed).toBeLessThanOrEqual(event.progress.total);
    }
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});
