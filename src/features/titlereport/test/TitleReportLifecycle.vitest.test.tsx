import { StrictMode } from "react";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TitleReportPanel } from "../component/TitleReportPanel";
import { useTitleReport } from "../hook/useTitleReport";
import { useTitleReportStore } from "../store/titleReportStore";
import type { TitleReportRequest } from "../type/titleReport.types";

const client = vi.hoisted(() => ({
  aggregate: vi.fn(), data: vi.fn(), generate: vi.fn(), status: vi.fn(), submit: vi.fn(),
}));
vi.mock("../worker/titleReportWorkerClient", async importOriginal => ({ ...await importOriginal<typeof import("../worker/titleReportWorkerClient")>(), createTitleReportWorkerClient: () => client }));

const request: TitleReportRequest = {
  apiGatewayUrl: "https://gateway.test", authToken: "token-1", intervalMs: 10,
  batch: "Batch A", batchId: "a", batchCode: "a", batchGroup: "user", sessions: ["first", "second"],
};
const onGenerated = vi.fn();
const onError = vi.fn();
const onProgress = vi.fn();
const resetProgress = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((complete, fail) => { resolve = complete; reject = fail; });
  return { promise, resolve, reject };
}

function Report() {
  const request = useTitleReportStore((state) => state.request)!;
  useTitleReport({ request, onGenerated, onError, onProgress, resetProgress });
  return null;
}

beforeEach(() => {
  vi.resetAllMocks();
  client.submit.mockResolvedValue(undefined);
  client.generate.mockResolvedValue(undefined);
  client.aggregate.mockResolvedValue(undefined);
  client.status.mockResolvedValue(true);
  client.data.mockResolvedValue([{ title: "Main Chain", records: [] }]);
  useTitleReportStore.getState().open(request);
});

afterEach(() => {
  cleanup();
  useTitleReportStore.getState().reset();
});

it.each([undefined, [], ["first", "second"]].flatMap(sessions => [false, true].map(complete => ({ sessions, complete }))))(
  "completes Strict Mode replay with sessions=$sessions and initial completion=$complete",
  async ({ sessions, complete }) => {
    const stale = deferred<boolean>();
    const current = deferred<boolean>();
    const selected = { ...request, sessions };
    useTitleReportStore.getState().open(selected);
    client.status.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    render(<StrictMode><TitleReportPanel request={selected} onGenerated={onGenerated} onError={onError} onReadyChange={vi.fn()} onSession={vi.fn()} /></StrictMode>);
    expect(client.status).toHaveBeenCalledTimes(2);
    expect(useTitleReportStore.getState()).toMatchObject({ status: "loading", busy: sessions !== undefined });
    expect(screen.getByRole("region", { name: "GENERATING TITLE REPORT" })).toBeVisible();
    const active = useTitleReportStore.getState().request;
    if (sessions !== undefined) {
      act(() => useTitleReportStore.getState().refresh());
      expect(useTitleReportStore.getState().request).toBe(active);
    }
    await act(async () => current.resolve(complete));
    await waitFor(() => expect(useTitleReportStore.getState().status).toBe("ready"));
    expect(useTitleReportStore.getState().busy).toBe(false);
    expect(client.submit.mock.calls.map(args => args[2])).toEqual(complete ? [] : sessions ?? []);
    expect(client.generate).toHaveBeenCalledTimes(!complete && sessions !== undefined ? 1 : 0);
    expect(client.aggregate).not.toHaveBeenCalled();
    expect(client.data).toHaveBeenCalledTimes(1);
    expect(onGenerated).toHaveBeenCalledTimes(complete ? 0 : 1);
    expect(onError).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "GENERATING TITLE REPORT" })).not.toBeInTheDocument();
    const ready = useTitleReportStore.getState();
    await act(async () => stale.resolve(false));
    expect(useTitleReportStore.getState()).toBe(ready);
    expect(client.data).toHaveBeenCalledTimes(1);
    expect(client.generate).toHaveBeenCalledTimes(!complete && sessions !== undefined ? 1 : 0);
  },
);

it("unlocks Refresh after a replayed load fails and retries the selected sessions", async () => {
  const stale = deferred<boolean>();
  client.status.mockReturnValueOnce(stale.promise).mockRejectedValueOnce({ error: "Status unavailable" });
  render(<StrictMode><Report /></StrictMode>);
  await waitFor(() => expect(useTitleReportStore.getState().status).toBe("error"));
  expect(useTitleReportStore.getState().busy).toBe(false);
  expect(onError).toHaveBeenCalledTimes(1);
  const failure = useTitleReportStore.getState();
  await act(async () => stale.reject({ error: "Stale failure" }));
  expect(useTitleReportStore.getState()).toBe(failure);
  expect(onError).toHaveBeenCalledTimes(1);
  client.status.mockResolvedValueOnce(false);
  act(() => useTitleReportStore.getState().refresh());
  await waitFor(() => expect(useTitleReportStore.getState().status).toBe("ready"));
  expect(client.submit.mock.calls.map(args => args[2])).toEqual(request.sessions);
  expect(client.generate).toHaveBeenCalledTimes(1);
  expect(client.aggregate).not.toHaveBeenCalled();
  expect(onGenerated).toHaveBeenCalledTimes(1);
});

it.each(["status", "submit", "generate", "aggregate", "data"] as const)(
  "releases an unmounted load during %s and ignores its completion after remount",
  async (stage) => {
    const stale = deferred<unknown>();
    if (stage === "submit" || stage === "generate" || stage === "data") client.status.mockResolvedValueOnce(false);
    if (stage === "aggregate") {
      useTitleReportStore.getState().setReady(request, { name: request.batch, chains: [] });
      useTitleReportStore.getState().refresh();
    }
    client[stage].mockReturnValueOnce(stale.promise);
    const view = render(<Report />);
    await waitFor(() => expect(client[stage]).toHaveBeenCalledTimes(1));
    const submitted = useTitleReportStore.getState().submitted;
    const active = useTitleReportStore.getState().request;
    view.unmount();
    expect(useTitleReportStore.getState()).toMatchObject({ request: active, status: "idle", operation: null, submitted });
    render(<Report />);
    await waitFor(() => expect(useTitleReportStore.getState().status).toBe("ready"));
    const ready = useTitleReportStore.getState();
    const calls = Object.values(client).map(method => method.mock.calls.length);
    const progressCalls = onProgress.mock.calls.length;
    const notifications = onGenerated.mock.calls.length;
    await act(async () => stale.resolve(stage === "data" ? [{ title: "Stale Chain" }] : false));
    expect(useTitleReportStore.getState()).toBe(ready);
    expect(Object.values(client).map(method => method.mock.calls.length)).toEqual(calls);
    expect(onProgress).toHaveBeenCalledTimes(progressCalls);
    expect(onGenerated).toHaveBeenCalledTimes(notifications);
    expect(onError).not.toHaveBeenCalled();
    if (stage === "data") {
      expect(client.submit).toHaveBeenCalledTimes(2);
      expect(client.generate).toHaveBeenCalledTimes(1);
      expect(ready.submitted).toBe(true);
    }
  },
);

it("does not release another mounted consumer's accepted load", async () => {
  const pending = deferred<boolean>();
  client.status.mockReturnValueOnce(pending.promise);
  render(<Report />);
  const rejected = render(<StrictMode><Report /></StrictMode>);
  const loading = useTitleReportStore.getState();
  rejected.unmount();
  expect(useTitleReportStore.getState()).toBe(loading);
  expect(client.status).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(true));
  await waitFor(() => expect(useTitleReportStore.getState().status).toBe("ready"));
  expect(client.data).toHaveBeenCalledTimes(1);
});

it("does not release a later consumer's load when the completed owner unmounts", async () => {
  const first = render(<Report />);
  await waitFor(() => expect(useTitleReportStore.getState().status).toBe("ready"));
  const pending = deferred<boolean>();
  client.status.mockReturnValueOnce(pending.promise);
  render(<Report />);
  const loading = useTitleReportStore.getState();
  first.unmount();
  expect(useTitleReportStore.getState()).toBe(loading);
  expect(loading.status).toBe("loading");
  await act(async () => pending.resolve(true));
  await waitFor(() => expect(useTitleReportStore.getState().status).toBe("ready"));
  expect(client.data).toHaveBeenCalledTimes(2);
});

it.each([false, true])("ignores a cancelled status while the replacement is still loading; rejected=%s", async (rejected) => {
  const stale = deferred<boolean>();
  const current = deferred<boolean>();
  client.status.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
  render(<StrictMode><Report /></StrictMode>);
  const loading = useTitleReportStore.getState();
  const progressCalls = onProgress.mock.calls.length;
  await act(async () => {
    if (rejected) stale.reject({ error: "Stale failure" });
    else stale.resolve(false);
  });
  expect(useTitleReportStore.getState()).toBe(loading);
  expect(onProgress).toHaveBeenCalledTimes(progressCalls);
  expect(onError).not.toHaveBeenCalled();
  expect(client.submit).not.toHaveBeenCalled();
  await act(async () => current.resolve(false));
  await waitFor(() => expect(useTitleReportStore.getState().status).toBe("ready"));
  expect(client.generate).toHaveBeenCalledTimes(1);
  expect(client.submit).toHaveBeenCalledTimes(2);
});

it.each(["ready", "error"] as const)("preserves terminal %s state during cleanup", async (status) => {
  if (status === "error") client.status.mockRejectedValueOnce({ error: "Status unavailable" });
  const view = render(<Report />);
  await waitFor(() => expect(useTitleReportStore.getState().status).toBe(status));
  const terminal = useTitleReportStore.getState();
  view.unmount();
  expect(useTitleReportStore.getState()).toBe(terminal);
});

it("restarts after a request replacement without accepting stale progress or failure", async () => {
  const stale = deferred<boolean>();
  client.status.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(false);
  const view = render(<TitleReportPanel request={request} onGenerated={onGenerated} onError={onError} onReadyChange={vi.fn()} onSession={vi.fn()} />);
  const replacement = {  ...request, apiGatewayUrl: "https://replacement.test" };
  act(() => useTitleReportStore.getState().open(replacement));
  view.rerender(<TitleReportPanel request={replacement} onGenerated={onGenerated} onError={onError} onReadyChange={vi.fn()} onSession={vi.fn()} />);
  await waitFor(() => expect(useTitleReportStore.getState().status).toBe("ready"));
  const ready = useTitleReportStore.getState();
  await act(async () => stale.reject({ error: "Stale failure" }));
  expect(useTitleReportStore.getState()).toBe(ready);
  expect(onError).not.toHaveBeenCalled();
  expect(onGenerated).toHaveBeenCalledTimes(1);
});

it("restarts the same request after a progress callback changes", async () => {
  const stale = deferred<boolean>();
  client.status.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(false);
  const view = renderHook(({ onProgress }) => useTitleReport({ request, onProgress, onGenerated, onError, resetProgress }), {
    initialProps: { onProgress },
  });
  const receive = vi.fn();
  view.rerender({ onProgress: receive });
  await waitFor(() => expect(useTitleReportStore.getState().status).toBe("ready"));
  expect(client.status).toHaveBeenCalledTimes(3);
  expect(client.generate).toHaveBeenCalledTimes(1);
  expect(client.submit).toHaveBeenCalledTimes(2);
  expect(receive).toHaveBeenCalled();
  const progressCalls = onProgress.mock.calls.length;
  await act(async () => stale.resolve(false));
  expect(onProgress).toHaveBeenCalledTimes(progressCalls);
  expect(client.generate).toHaveBeenCalledTimes(1);
  expect(onGenerated).toHaveBeenCalledTimes(1);
});
