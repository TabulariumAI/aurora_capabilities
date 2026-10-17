import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("advances the redaction timer counter without adding status requests", async () => {
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    let checks = 0;
    renderHook(() => useRedact({
      request: { authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-redact-counter", session: "s" },
      onComplete,
      onError: vi.fn(),
      onProgress,
      workerClient: {
        status: async () => ({ data: null, status: ++checks > 1 ? "completed" : "processing" }),
        submit: async () => ({ data: null, status: "processing" }),
        data: async () => ({ pdf: "redacted.pdf" }),
      },
    }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(checks).toBe(2);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Redacting confidential information...", progress: { completed: 0, total: 21, unit: "steps" } }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Redacting confidential information...", progress: { completed: 1, total: 21, unit: "steps" } }));
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
  const props = { request: { authToken: "t", capability: "redact" as const, documentApiGatewayUrl: "u", document: "d", intervalMs: 0, requestId: "event-redact", session: "event-session" }, onComplete: vi.fn(), onError: vi.fn(), onProgress: vi.fn(), workerClient };
  const view = renderHook(() => useRedact(props));
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


it.each([500, 1000, 6000, 7500].flatMap(intervalMs => [false, true].map(complete => ({ intervalMs, complete }))))("preserves the redact polling budget at $intervalMs ms; completed=$complete", async ({ intervalMs, complete }) => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onError = vi.fn();
  const onProgress = vi.fn();
  const workerClient = {
    submit: vi.fn(async () => ({ status: "processing", data: null })),
    status: vi.fn(async () => ({ status: "processing", data: null })),
    data: vi.fn(async () => ({ pdf: "document.pdf", chain: [] })),
  };
  const view = renderHook(() => useRedact({
    request: { document: "document.pdf", authToken: "t", capability: "redact", documentApiGatewayUrl: "u", intervalMs, requestId: `budget-redact-${complete}`, session: "budget-session" },
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
