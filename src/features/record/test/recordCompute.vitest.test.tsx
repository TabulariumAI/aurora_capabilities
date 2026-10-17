import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRecord } from "../hook/useRecord";
import { useRecordStore } from "../store/recordStore";

afterEach(() => useRecordStore.getState().reset());

it.each(["completed", "pending", "processing"])("preserves one-time endorsement: existing status %s", async status => {
  const order: string[] = [];
  const client = {
    calculate: vi.fn(async () => { order.push("compute"); return { status: "processing", data: null }; }),
    computation: vi.fn(async () => { order.push("computed"); return { status: "completed", data: null }; }),
    status: vi.fn().mockResolvedValueOnce({ status, data: null }).mockResolvedValue({ status: "completed", data: null }),
    submit: vi.fn(async () => { order.push("endorse"); return { status: "processing", data: null }; }),
    data: vi.fn(async () => ({ pdf_record: "document.pdf" })),
  };
  const onComplete = vi.fn(), onProgress = vi.fn();
  renderHook(() => useRecord({ request: { authToken: "token", capability: "record", document: "doc", documentApiGatewayUrl: "gateway", intervalMs: 0, session: "session", requestId: "once-" + status }, workerClient: client, onComplete, onError: vi.fn(), onProgress }));
  await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  expect(order).toEqual(status === "pending" ? ["compute", "computed", "endorse"] : []);
  if (status === "pending") expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Calculating document fees...", phase: "completed" }));
});

it("stops before endorsement when calculation fails", async () => {
  const client = { calculate: vi.fn(async () => ({ status: "error", data: "Calculation failed" })), computation: vi.fn(), status: vi.fn(async () => ({ status: "pending", data: null })), submit: vi.fn(), data: vi.fn() };
  const onError = vi.fn();
  renderHook(() => useRecord({ request: { authToken: "token", capability: "record", document: "doc", documentApiGatewayUrl: "gateway", intervalMs: 0, session: "session", requestId: "failed-compute" }, workerClient: client, onComplete: vi.fn(), onError, onProgress: vi.fn() }));
  await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "compute" })));
  expect(client.submit).not.toHaveBeenCalled();
  expect(client.data).not.toHaveBeenCalled();
});

it.each([500, 7500, 10000].flatMap(intervalMs => [false, true].map(complete => ({ intervalMs, complete }))))("bounds pre-endorsement computation to 202.5 seconds at $intervalMs ms; completed=$complete", async ({ intervalMs, complete }) => {
  vi.useFakeTimers();
  const client = {
    calculate: vi.fn(async () => ({ status: "processing", data: null })),
    computation: vi.fn(async () => ({ status: "processing", data: null })),
    status: vi.fn().mockResolvedValueOnce({ status: "pending", data: null }).mockResolvedValue({ status: "completed", data: null }),
    submit: vi.fn(async () => ({ status: "processing", data: null })),
    data: vi.fn(async () => ({ pdf_record: "document.pdf" })),
  };
  const onError = vi.fn();
  const view = renderHook(() => useRecord({ request: { authToken: "token", capability: "record", document: "doc", documentApiGatewayUrl: "gateway", intervalMs, session: "session", requestId: `compute-budget-${intervalMs}-${complete}` }, workerClient: client, onComplete: vi.fn(), onError, onProgress: vi.fn() }));
  try {
    await act(async () => { await vi.advanceTimersByTimeAsync(202000); });
    expect(client.calculate).toHaveBeenCalledOnce();
    expect(client.computation).toHaveBeenCalledTimes(Math.floor(202000 / intervalMs));
    expect(client.submit).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    if (complete) client.computation.mockResolvedValue({ status: "completed", data: null });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(client.computation).toHaveBeenCalledTimes(Math.ceil(202500 / intervalMs));
    expect(client.submit).toHaveBeenCalledTimes(complete ? 1 : 0);
    expect(onError).toHaveBeenCalledTimes(complete ? 0 : 1);
    if (!complete) expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "compute", error: expect.objectContaining({ code: "COMPUTE_TIMEOUT" }) }));
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});

it("does not endorse or report a timeout after computation is canceled", async () => {
  vi.useFakeTimers();
  const client = { calculate: vi.fn(async () => ({ status: "processing", data: null })), computation: vi.fn(), status: vi.fn(async () => ({ status: "pending", data: null })), submit: vi.fn(), data: vi.fn() };
  const onError = vi.fn();
  const view = renderHook(() => useRecord({ request: { authToken: "token", capability: "record", document: "doc", documentApiGatewayUrl: "gateway", intervalMs: 7500, session: "session", requestId: "cancel-compute-budget" }, workerClient: client, onComplete: vi.fn(), onError, onProgress: vi.fn() }));
  try {
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(client.calculate).toHaveBeenCalledOnce();
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(202500); });
    expect(client.computation).not.toHaveBeenCalled();
    expect(client.submit).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});

it.each(["pending", "completed"])("does not start another stage when initial status %s arrives after cancellation", async status => {
  let finish!: (value: { status: string; data: null }) => void;
  const client = {
    status: vi.fn(() => new Promise<{ status: string; data: null }>(resolve => { finish = resolve; })),
    calculate: vi.fn(), computation: vi.fn(), submit: vi.fn(), data: vi.fn(),
  };
  const onComplete = vi.fn(), onError = vi.fn();
  const view = renderHook(() => useRecord({ request: { authToken: "token", capability: "record", document: "doc", documentApiGatewayUrl: "gateway", intervalMs: 0, session: "session", requestId: "cancel-status-" + status }, workerClient: client, onComplete, onError, onProgress: vi.fn() }));
  await waitFor(() => expect(client.status).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => { finish({ status, data: null }); });
  expect(client.calculate).not.toHaveBeenCalled();
  expect(client.computation).not.toHaveBeenCalled();
  expect(client.submit).not.toHaveBeenCalled();
  expect(client.data).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

it("reports a rejected endorsement submission immediately after successful computation", async () => {
  const client = {
    status: vi.fn(async () => ({ status: "pending", data: null })),
    calculate: vi.fn(async () => ({ status: "completed", data: null })),
    computation: vi.fn(),
    submit: vi.fn(async () => ({ status: "error", data: "Endorsement failed" })),
    data: vi.fn(),
  };
  const onError = vi.fn();
  renderHook(() => useRecord({ request: { authToken: "token", capability: "record", document: "doc", documentApiGatewayUrl: "gateway", intervalMs: 0, session: "session", requestId: "failed-submit" }, workerClient: client, onComplete: vi.fn(), onError, onProgress: vi.fn() }));
  await waitFor(() => expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ operation: "submit", error: expect.objectContaining({ error: "Endorsement failed" }) })));
  expect(client.status).toHaveBeenCalledOnce();
  expect(client.data).not.toHaveBeenCalled();
});
