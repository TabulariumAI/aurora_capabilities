import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCompute } from "../hook/useCompute";
import { useComputeStore } from "../store/computeStore";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";

const segments = {
  ACKNOWLEDGMENT: "acknowledgment",
  COURT: "court",
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
  useCapabilityDataStore.getState().reset();
  vi.restoreAllMocks();
});

describe("useCompute", () => {
  it("runs submit/status/resubmit/status/data", async () => {
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    const calls: string[] = [];
    const data = { heading: { class: "deed", title: "Title" } };
    renderHook(() => useCompute({
      request: { document: "document.pdf", authToken: "t", capability: "compute", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r", session: "s" },
      onComplete,
      onError: vi.fn(),
      onProgress,
      segments,
      workerClient: {
        submit: vi.fn(async () => { calls.push("submit"); return { data: null, status: "processing" }; }),
        status: vi.fn(async () => { calls.push("status"); return { data: null, status: calls.filter((v) => v === "status").length > 1 ? "completed" : "processing" }; }),
        data: vi.fn(async () => { calls.push("data"); return data; }),
      },
    }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(useComputeStore.getState().openSegment).toBe("configured-fee");
    expect(calls).toEqual(["submit", "status", "submit", "status", "data"]);
    expect(useCapabilityDataStore.getState().getData("compute", "s")).toEqual(data);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Starting fee calculation...", phase: "started" }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: "Fee calculation complete.", phase: "completed" }));
  });

  it("reports data failures with the data operation", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onError = vi.fn();
    const onProgress = vi.fn();
    renderHook(() => useCompute({
      request: { document: "document.pdf", authToken: "t", capability: "compute", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-data", session: "s" },
      onComplete: vi.fn(),
      onError,
      onProgress,
      segments,
      workerClient: {
        submit: async () => ({ data: null, status: "completed" }),
        status: async () => ({ data: null, status: "completed" }),
        data: async () => { throw new Error("Data failed"); },
      },
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: "data" })));
    expect(useCapabilityDataStore.getState().getData("compute", "s")).toBeNull();
    expect(error).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Preparing fee details...", phase: "failed" }));
  });
});


it.each([false, true])("publishes only after data is ready; canceled=%s", async (canceled) => {
  let finish!: (value: typeof data) => void;
  const data = { heading: { class: "deed", title: "Title" } };
  const workerClient = {
    submit: vi.fn(async () => ({ status: "completed", data: null })),
    status: vi.fn(async () => ({ status: "completed", data: null })),
    data: vi.fn(() => new Promise<typeof data>((resolve) => { finish = resolve; })),
  };
  const props = { segments, request: { authToken: "t", capability: "compute" as const, documentApiGatewayUrl: "u", document: "d", intervalMs: 0, requestId: "event-compute", session: "event-session" }, onComplete: vi.fn(), onError: vi.fn(), onProgress: vi.fn(), workerClient };
  const view = renderHook(() => useCompute(props));
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
