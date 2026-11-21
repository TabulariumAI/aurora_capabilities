import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManifestPanel } from "../component/ManifestPanel";
import { useManifestStore } from "../store/manifestStore";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import { startCapability } from "../../../shared/worker/startCapability";
import type { ManifestRequest } from "../../../shared/type/capability.types";

const request: ManifestRequest = { capability: "manifest", document: "document.pdf", authToken: "token", documentApiGatewayUrl: "https://gateway.test", intervalMs: 0, requestId: "choices-1", session: "session-1" };
const fields = [["include_pages", "Document images"], ["include_gates", "Compliance gates"], ["include_notes", "IQ notes"]] as const;

function setup(value = request) {
  const client = {
    status: vi.fn(async () => ({ status: "completed", data: null })),
    submit: vi.fn(async () => ({ status: "completed", data: null })),
    data: vi.fn(async () => ({ pdf: "https://storage.test/manifest.pdf" })),
  };
  const onComplete = vi.fn();
  const onError = vi.fn();
  const view = render(<StrictMode><ManifestPanel request={value} workerClient={client} onComplete={onComplete} onError={onError} /></StrictMode>);
  return { client, onComplete, onError, view };
}

beforeEach(() => { useManifestStore.getState().reset(); useCapabilityDataStore.getState().reset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("manifest choices", () => {
  it("opens from the background event without making requests or starting a run", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    startCapability({ request, segments: {} as Parameters<typeof startCapability>[0]["segments"], onResource: vi.fn(), onTerminal: vi.fn() });
    const { client } = setup();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    for (const [, label] of fields) expect(screen.getByRole("checkbox", { name: label })).not.toBeChecked();
    expect(useManifestStore.getState().status).toBe("idle");
    expect(useCapabilityDataStore.getState().runs.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(client.status).not.toHaveBeenCalled();
    expect(client.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
    expect(client.submit).not.toHaveBeenCalled();
  });

  it.each(Array.from({ length: 8 }, (_, mask) => mask))("submits exactly the confirmed options once, combination %i", async mask => {
    const { client, onComplete } = setup();
    const options = { include_pages: Boolean(mask & 1), include_gates: Boolean(mask & 2), include_notes: Boolean(mask & 4) };
    fields.forEach(([field, label]) => { if (options[field]) fireEvent.click(screen.getByRole("checkbox", { name: label })); });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(client.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(client.submit).toHaveBeenCalledExactlyOnceWith("token", "session-1", options);
    expect(client.status).not.toHaveBeenCalled();
    expect(client.data).toHaveBeenCalledOnce();
    for (const [, label] of fields) expect(screen.getByRole("checkbox", { name: label })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download manifest" })).toBeVisible();
  });

  it("requires confirmation again after choices change", () => {
    const { client } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "IQ notes" }));
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(client.submit).not.toHaveBeenCalled();
  });

  it("expires confirmation without submitting", async () => {
    vi.useFakeTimers();
    try {
      const { client } = setup();
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));
      await act(async () => { await vi.advanceTimersByTimeAsync(4001); });
      expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
      expect(client.submit).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("retains choices when hidden and resets them for a new request", () => {
    const { client, view, onComplete, onError } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Document images" }));
    act(() => useManifestStore.getState().close());
    view.unmount();
    const reopened = setup();
    expect(screen.getByRole("checkbox", { name: "Document images" })).toBeChecked();
    reopened.view.rerender(<ManifestPanel request={{ ...request, requestId: "choices-2" }} workerClient={client} onComplete={onComplete} onError={onError} />);
    for (const [, label] of fields) expect(screen.getByRole("checkbox", { name: label })).not.toBeChecked();
    expect(client.submit).not.toHaveBeenCalled();
  });

  it("locks the confirmed draft while pending and never resubmits on remount", async () => {
    let finish!: (value: { status: string; data: null }) => void;
    const { client, view } = setup();
    client.submit.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(client.submit).toHaveBeenCalledOnce());
    for (const [, label] of fields) expect(screen.getByRole("checkbox", { name: label })).toBeDisabled();
    act(() => useManifestStore.getState().setOption("include_notes", true));
    expect(useManifestStore.getState().options.include_notes).toBe(false);
    view.unmount();
    render(<ManifestPanel request={request} workerClient={client} onComplete={vi.fn()} onError={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    await act(async () => finish({ status: "completed", data: null }));
    expect(client.submit).toHaveBeenCalledOnce();
  });

  it("generates a new report after an earlier completed report", async () => {
    const { client, onComplete, onError, view } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    view.rerender(<ManifestPanel request={{ ...request, requestId: "choices-2" }} workerClient={client} onComplete={onComplete} onError={onError} />);
    expect(screen.queryByRole("button", { name: "Download manifest" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Compliance gates" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(2));
    expect(client.submit).toHaveBeenCalledTimes(2);
    expect(client.submit).toHaveBeenLastCalledWith("token", "session-1", { include_pages: false, include_gates: true, include_notes: false });
  });
});
