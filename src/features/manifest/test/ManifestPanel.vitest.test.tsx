import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManifestPanel } from "../component/ManifestPanel";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";

vi.mock("../../../shared/component/DownloadButton", () => ({
  DownloadButton: ({ disabled, label, onStart, onSuccess }: { disabled: boolean; label: string; onStart(): void; onSuccess(): void }) => {
    return <>
      <button disabled={disabled} onClick={onStart} type="button">{label}</button>
      <button onClick={onSuccess} type="button">Complete manifest download</button>
    </>;
  },
}));

afterEach(() => {
  cleanup();
  useCapabilityDataStore.getState().reset();
});

describe("ManifestPanel", () => {
  it("shows manifest creation progress in the panel", async () => {
    const view = render(<ManifestPanel request={{ authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 1_000, requestId: "r-manifest-loader", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={{ status: async () => ({ data: null, status: "processing" }), submit: async () => ({ data: null, status: "processing" }), data: vi.fn() }} />);

    expect(await screen.findByText("GENERATING THE INDEX MANIFEST")).toBeVisible();
    expect(screen.getByText("I’ll keep you updated as I generate the manifest.")).toBeVisible();
    expect(await screen.findByText("Checking manifest status...")).toBeVisible();
    expect(await screen.findByText("Generating document manifest...")).toBeVisible();
    view.unmount();
  });

  it("keeps completed progress rows and downloads the retained manifest URL", async () => {
    const status = vi.fn()
      .mockResolvedValueOnce({ data: null, status: "processing" })
      .mockResolvedValueOnce({ data: null, status: "completed" });

    const pdf = "https://storage.test/subscription/s/ReportPage.PDF?sig=token";
    render(<ManifestPanel request={{ authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-manifest-panel", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={{ status, submit: async () => ({ data: null, status: "processing" }), data: async () => ({ pdf }) }} />);
    await waitFor(() => expect(screen.getByText("Manifest is ready to download.")).toBeInTheDocument());
    const panel = screen.getByRole("region", { name: "GENERATING THE INDEX MANIFEST" });
    const rows = within(panel).getAllByRole("listitem");

    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText("Checking manifest status...")).toBeVisible();
    expect(within(rows[1]).getByText("Generating document manifest...")).toBeVisible();
    expect(within(rows[2]).getByText("Preparing manifest download...")).toBeVisible();
    expect(within(rows[3]).getByText("Manifest is ready to download.")).toBeVisible();
    const action = within(panel).getByRole("button", { name: "Download manifest" });
    expect(rows[3]).toContainElement(action);
    fireEvent.click(action);
    const downloading = await screen.findByText("Downloading manifest...");
    const downloadingRow = downloading.closest("li");
    expect(downloadingRow).toHaveAttribute("data-phase", "started");
    expect(within(downloadingRow!).getByLabelText("In progress")).toBeVisible();
    expect(within(rows[3]).getByRole("button", { name: "Download manifest" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Complete manifest download" }));

    await waitFor(() => expect(screen.getByText("Manifest downloaded.")).toBeInTheDocument());
    const downloaded = screen.getByText("Manifest downloaded.").closest("li");
    expect(downloaded).toHaveAttribute("data-phase", "completed");
    expect(within(downloaded!).getByLabelText("Completed")).toHaveStyle({
      backgroundColor: "#F0F6FA",
      border: "1px solid #1B7FA6",
      color: "#1B7FA6",
    });
    expect(action.compareDocumentPosition(downloaded!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.queryByRole("button", { name: /back to start/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Manifest Ready" })).not.toBeInTheDocument();
  });

  it("keeps a manifest failure visible as the final timeline step", async () => {
    render(<ManifestPanel request={{ authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-manifest-failed", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={{ status: async () => ({ data: "Manifest unavailable", status: "error" }), submit: vi.fn(), data: vi.fn() }} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Manifest checkStatus failed: Manifest unavailable");
    expect(screen.getAllByRole("listitem").at(-1)).toHaveAttribute("data-phase", "failed");
    expect(screen.getByRole("region", { name: "GENERATING THE INDEX MANIFEST" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /back to start/i })).not.toBeInTheDocument();
  });

  it("replaces completed rows for a new manifest", async () => {
    const status = vi.fn()
      .mockResolvedValueOnce({ data: null, status: "processing" })
      .mockResolvedValueOnce({ data: null, status: "completed" })
      .mockResolvedValueOnce({ data: null, status: "completed" });
    const workerClient = { status, submit: async () => ({ data: null, status: "processing" }), data: async () => ({ pdf: "https://storage.test/subscription/s/ReportPage.PDF?sig=token" }) };
    const onComplete = vi.fn();
    const onError = vi.fn();
    const view = render(<ManifestPanel request={{ authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "manifest-1", session: "s" }} onComplete={onComplete} onError={onError} workerClient={workerClient} />);

    await waitFor(() => expect(screen.getByText("Manifest is ready to download.")).toBeInTheDocument());
    view.rerender(<ManifestPanel request={{ authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "manifest-2", session: "s" }} onComplete={onComplete} onError={onError} workerClient={workerClient} />);

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
    expect(screen.queryByText("Generating document manifest...")).not.toBeInTheDocument();
  });
});
