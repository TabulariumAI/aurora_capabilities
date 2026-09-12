import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordPanel } from "../component/RecordPanel";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";

vi.mock("../../../shared/component/DownloadButton", () => ({
  DownloadButton: ({ disabled, label, onStart, onSuccess }: { disabled: boolean; label: string; onStart(): void; onSuccess(): void }) => <>
    <button disabled={disabled} onClick={onStart} type="button">{label}</button>
    <button onClick={onSuccess} type="button">Complete {label}</button>
  </>,
}));

afterEach(() => {
  cleanup();
  useCapabilityDataStore.getState().reset();
});

describe("RecordPanel", () => {
  it("shows recording progress in the panel", async () => {
    const view = render(<RecordPanel request={{ authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 1_000, requestId: "r-record-loader", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={{ status: async () => ({ data: null, status: "processing" }), computeData: async () => ({ heading: { class: "deed", title: "Title" } }), submit: async () => ({ data: null, status: "processing" }), data: vi.fn() }} />);

    expect(await screen.findByText("RECORDING THE DOCUMENT")).toBeVisible();
    expect(screen.getByText("I’ll keep you updated as I prepare your document for recording.")).toBeVisible();
    expect(await screen.findByText("Checking recording status...")).toBeVisible();
    expect(await screen.findByText("Preparing endorsement details...")).toBeVisible();
    expect(await screen.findByText("Creating endorsement pages...")).toBeVisible();
    expect(await screen.findByText("Recording the document now...")).toBeVisible();
    view.unmount();
  });

  it("replaces progress rows for a new recording", async () => {
    const request = { authToken: "t", capability: "record" as const, document: "d", documentApiGatewayUrl: "u", intervalMs: 10_000, session: "s" };
    const workerClient = { status: async () => ({ data: null, status: "processing" }), computeData: async () => ({ heading: { class: "deed", title: "Title" } }), submit: async () => ({ data: null, status: "processing" }), data: vi.fn() };
    const view = render(<RecordPanel request={{ ...request, requestId: "record-1" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={workerClient} />);

    await screen.findByText("Recording the document now...");
    view.rerender(<RecordPanel request={{ ...request, requestId: "record-2" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={workerClient} />);

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(4));
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Checking recording status...");
  });

  it("adds a separate status row for each downloaded record resource", async () => {
    const data = {
      pdf_confirmation: "https://storage.test/subscription/s/confirmation.pdf?sig=token",
      pdf_record: "https://storage.test/subscription/s/record.pdf?sig=token",
      tiff_record: "https://storage.test/subscription/s/record.tiff?sig=token",
    };
    render(<RecordPanel request={{ authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-record-panel", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={{ status: async () => ({ data: null, status: "completed" }), computeData: async () => ({ heading: { class: "deed", title: "Title" } }), submit: async () => ({ data: null, status: "completed" }), data: async () => data }} />);
    await waitFor(() => expect(screen.getByText("Recording complete.")).toBeInTheDocument());
    const panel = screen.getByRole("region", { name: "Recording actions" });
    const rows = screen.getAllByRole("listitem");
    const initialRows = rows.length;
    expect(rows.at(-1)).toHaveAttribute("data-phase", "completed");
    expect(rows.at(-1)).toContainElement(panel);
    const document = within(panel).getByRole("button", { name: "Endorsed Document" });
    expect(within(panel).queryByText("|", { exact: true })).not.toBeInTheDocument();
    fireEvent.click(document);
    const documentDownloading = await screen.findByText("Downloading endorsed document");
    expect(documentDownloading.closest("li")).toHaveAttribute("data-phase", "started");
    expect(within(panel).getByRole("button", { name: "Endorsed Document" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Cover Page (Receipt)" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Complete Endorsed Document" }));
    await waitFor(() => expect(screen.getByText("Endorsed document downloaded")).toBeInTheDocument());
    const documentDownloaded = screen.getByText("Endorsed document downloaded").closest("li");
    expect(documentDownloaded).toHaveAttribute("data-phase", "completed");
    expect(document.compareDocumentPosition(documentDownloaded!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const cover = within(panel).getByRole("button", { name: "Cover Page (Receipt)" });
    expect(cover).toBeEnabled();
    fireEvent.click(cover);
    const coverDownloading = await screen.findByText("Downloading cover page (receipt)...");
    expect(coverDownloading.closest("li")).toHaveAttribute("data-phase", "started");
    fireEvent.click(screen.getByRole("button", { name: "Complete Cover Page (Receipt)" }));
    await waitFor(() => expect(screen.getByText("Cover page (receipt) downloaded.")).toBeInTheDocument());
    const coverDownloaded = screen.getByText("Cover page (receipt) downloaded.").closest("li");
    expect(coverDownloaded).toHaveAttribute("data-phase", "completed");
    expect(cover.compareDocumentPosition(coverDownloaded!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(initialRows + 2);
    expect(screen.queryByRole("button", { name: /back to start/i })).not.toBeInTheDocument();
  });

  it("keeps a recording failure as the final timeline step", async () => {
    render(<RecordPanel request={{ authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-record-failed", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={{ status: async () => ({ data: "Recording unavailable", status: "error" }), computeData: vi.fn(), submit: vi.fn(), data: vi.fn() }} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Recording unavailable");
    expect(screen.getAllByRole("listitem").at(-1)).toHaveAttribute("data-phase", "failed");
    expect(screen.getByText("RECORDING THE DOCUMENT")).toBeVisible();
    expect(screen.queryByRole("button", { name: /back to start/i })).not.toBeInTheDocument();
  });
});
