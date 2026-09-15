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
