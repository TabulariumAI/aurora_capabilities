import { StrictMode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CapabilityName } from "../type/capability.types";
import { useCompute } from "../../features/compute/hook/useCompute";
import { useComposition } from "../../features/composition/hook/useComposition";
import { useRecord } from "../../features/record/hook/useRecord";
import { useRedact } from "../../features/redact/hook/useRedact";
import { useManifest } from "../../features/manifest/hook/useManifest";
import { useComputeStore } from "../../features/compute/store/computeStore";
import { useCompositionStore } from "../../features/composition/store/compositionStore";
import { useRecordStore } from "../../features/record/store/recordStore";
import { useRedactStore } from "../../features/redact/store/redactStore";
import { useManifestStore } from "../../features/manifest/store/manifestStore";
import { computeQueueStore } from "../../features/compute/store/computeQueueStore";
import { useCapabilityDataStore } from "../worker/capabilityData";
const segments = { ACKNOWLEDGMENT: "acknowledgment", JUDGMENT: "judgment", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" };

const names: CapabilityName[] = ["compute", "composition", "record", "redact", "manifest"];
const stores = { compute: useComputeStore, composition: useCompositionStore, record: useRecordStore, redact: useRedactStore, manifest: useManifestStore };
const request = { authToken: "audit-token", document: "document.pdf", documentApiGatewayUrl: "https://gateway.example.test", intervalMs: 10, requestId: "first", session: "session-a" };
const data = { result: { fee_factors: [], fees: [], funds: [] }, metadataEtag: "version-a", chain: [], history: {}, pdf: "https://storage.example.test/result.pdf" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((complete, fail) => { resolve = complete; reject = fail; });
  return { promise, resolve, reject };
}

function setup(name: CapabilityName) {
  const pending = deferred<{ status: string; data: null }>();
  const client = {
    submit: vi.fn(() => pending.promise), status: vi.fn(() => pending.promise),
    calculate: vi.fn(async () => ({ status: "completed", data: null })),
    computation: vi.fn(async () => ({ status: "completed", data: null })),
    data: vi.fn(async () => data), options: vi.fn(async () => []),
    model: vi.fn(async () => ({ model: { fee_factors: [], fees: [], funds: [] } , etag: '"model-a"' })),
  };
  const callbacks = { onComplete: vi.fn(), onError: vi.fn(), onProgress: vi.fn() };
  function useRun(value: typeof request) {
    const input = { ...callbacks, workerClient: client };
    switch (name) {
      case "compute": return useCompute({ ...input, request: { ...value, capability: "compute", refresh: false }, segments,
        onResource: resource => resource.callback({ ok: true, data: "metadata-a" }) });
      case "composition": return useComposition({ ...input, request: { ...value, capability: "composition" } });
      case "record": return useRecord({ ...input, request: { ...value, capability: "record" } });
      case "redact": return useRedact({ ...input, request: { ...value, capability: "redact" } });
      case "manifest": return useManifest({ ...input, request: { ...value, capability: "manifest" } });
    }
  }
  return { pending, client, callbacks, useRun };
}

beforeEach(() => {
  for (const store of Object.values(stores)) store.getState().reset();
  computeQueueStore.getState().reset();
  useCapabilityDataStore.getState().reset();
});

afterEach(() => {
  cleanup();
  for (const store of Object.values(stores)) store.getState().reset();
  computeQueueStore.getState().reset();
  useCapabilityDataStore.getState().reset();
});

it.each(names)("finishes %s once through Strict Mode replay", async name => {
  const { useRun, pending, client, callbacks } = setup(name);
  renderHook(() => useRun(request), { wrapper: StrictMode });
  await act(async () => pending.resolve({ status: "completed", data: null }));
  await waitFor(() => expect(callbacks.onComplete).toHaveBeenCalledTimes(1));
  expect(client.data).toHaveBeenCalledTimes(1);
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(stores[name].getState()).toMatchObject({ status: "ready", runningRequestId: null });
});

it.each(names)("finishes hidden %s work and reopens its result without repeating it", async name => {
  const { useRun, pending, client, callbacks } = setup(name);
  const view = renderHook(() => useRun(request));
  act(() => stores[name].getState().close());
  view.unmount();
  callbacks.onProgress.mockClear();
  await act(async () => pending.resolve({ status: "completed", data: null }));
  await waitFor(() => expect(callbacks.onComplete).toHaveBeenCalledTimes(1));
  expect(callbacks.onComplete).toHaveBeenCalledWith(expect.objectContaining({ requestId: "first", session: "session-a" }));
  expect(stores[name].getState()).toMatchObject({ status: "ready", visible: false, runningRequestId: null });
  expect(callbacks.onProgress).not.toHaveBeenCalled();
  renderHook(() => useRun(request));
  await act(async () => {});
  expect(client.data).toHaveBeenCalledTimes(1);
  expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
  expect(callbacks.onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "completed" }));
});

it.each(names)("reports hidden %s failure once and releases its running state", async name => {
  const { useRun, pending, callbacks } = setup(name);
  const view = renderHook(() => useRun(request));
  act(() => stores[name].getState().close());
  view.unmount();
  await act(async () => pending.reject({ error: "Service unavailable" }));
  await waitFor(() => expect(callbacks.onError).toHaveBeenCalledTimes(1));
  expect(stores[name].getState()).toMatchObject({ status: "error", visible: false, runningRequestId: null });
  expect(callbacks.onComplete).not.toHaveBeenCalled();
});

it.each(names)("keeps overlapping %s requests scoped and never restarts the first request", async name => {
  const first = setup(name), second = setup(name);
  const firstView = renderHook(() => first.useRun(request));
  firstView.unmount();
  const next = { ...request, requestId: "second", session: "session-b" };
  renderHook(() => second.useRun(next));
  const reopened = renderHook(() => first.useRun(request));
  reopened.unmount();
  await act(async () => second.pending.resolve({ status: "completed", data: null }));
  await act(async () => first.pending.resolve({ status: "completed", data: null }));
  await waitFor(() => expect(first.callbacks.onComplete).toHaveBeenCalledTimes(1));
  expect(second.callbacks.onComplete).toHaveBeenCalledTimes(1);
  expect(first.client.data).toHaveBeenCalledTimes(1);
  expect(second.client.data).toHaveBeenCalledTimes(1);
  expect(first.callbacks.onComplete).toHaveBeenCalledWith(expect.objectContaining({ requestId: "first", session: "session-a" }));
  expect(second.callbacks.onComplete).toHaveBeenCalledWith(expect.objectContaining({ requestId: "second", session: "session-b" }));
});

it.each(names)("invalidates pending %s results after its owner resets", async name => {
  const { useRun, pending, client, callbacks } = setup(name);
  renderHook(() => useRun(request));
  act(() => stores[name].getState().reset());
  await act(async () => pending.resolve({ status: "completed", data: null }));
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(client.data).not.toHaveBeenCalled();
  expect(stores[name].getState()).toMatchObject({ status: "idle", request: null, visible: false });
});

it.each(names)("does not retry failed %s work when its panel rerenders or reopens", async name => {
  const { useRun, pending, client, callbacks } = setup(name);
  const view = renderHook(() => useRun(request));
  await act(async () => pending.reject({ error: "Service unavailable" }));
  await waitFor(() => expect(callbacks.onError).toHaveBeenCalledTimes(1));
  view.rerender();
  view.unmount();
  renderHook(() => useRun(request));
  await act(async () => {});
  expect(callbacks.onError).toHaveBeenCalledTimes(1);
  expect(name === "compute" || name === "composition" ? client.submit : client.status).toHaveBeenCalledTimes(1);
});
