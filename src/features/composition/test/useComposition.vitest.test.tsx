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
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Composing document metadata...", phase: "started" }));
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
