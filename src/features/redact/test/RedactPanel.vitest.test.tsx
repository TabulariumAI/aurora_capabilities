import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedactPanel } from "../component/RedactPanel";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";

const downloadBlob = vi.hoisted(() => vi.fn(async () => ({ blob: new Blob(["redact"]), name: "redacted.pdf" })));

vi.mock("../../../shared/worker/capabilityData", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../shared/worker/capabilityData")>(),
  downloadBlob,
}));

beforeEach(() => {
  class DownloadUrl extends URL {}
  Object.assign(DownloadUrl, { createObjectURL: () => "blob:redact", revokeObjectURL: () => undefined });
  vi.stubGlobal("URL", DownloadUrl);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  downloadBlob.mockReset();
  useCapabilityDataStore.getState().reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("RedactPanel", () => {
  it("shows redaction progress in the panel", async () => {
    const view = render(<RedactPanel request={{ authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 1_000, requestId: "r-redact-loader", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={{ status: async () => ({ data: null, status: "processing" }), submit: async () => ({ data: null, status: "processing" }), data: vi.fn() }} />);

    expect(await screen.findByText("REDACTING THE DOCUMENT")).toBeVisible();
    expect(screen.getByText("I’ll keep you updated as I redact confidential information.")).toBeVisible();
    expect(await screen.findByText("Checking redaction status...")).toBeVisible();
    expect(await screen.findByText("Redacting confidential information...")).toBeVisible();
    view.unmount();
  });

  it("replaces progress rows for a new redaction", async () => {
    const request = { authToken: "t", capability: "redact" as const, document: "d", documentApiGatewayUrl: "u", intervalMs: 10_000, session: "s" };
    const workerClient = { status: async () => ({ data: null, status: "processing" }), submit: async () => ({ data: null, status: "processing" }), data: vi.fn() };
    const view = render(<RedactPanel request={{ ...request, requestId: "redact-1" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={workerClient} />);

    await screen.findByText("Redacting confidential information...");
    view.rerender(<RedactPanel request={{ ...request, requestId: "redact-2" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={workerClient} />);

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Checking redaction status...");
  });

  it("shows a redaction failure in progress", async () => {
    const onError = vi.fn();
    render(<RedactPanel request={{ authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-redact-failed", session: "s" }} onComplete={vi.fn()} onError={onError} workerClient={{ status: async () => ({ data: "No secrets found to redact", status: "error" }), submit: vi.fn(), data: vi.fn() }} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No secrets found to redact");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      error: { error: "No secrets found to redact" },
      operation: "status",
    }));
    expect(screen.getAllByRole("listitem").at(-1)).toHaveAttribute("data-phase", "failed");
    expect(screen.queryByRole("button", { name: /back to start/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Redaction Ready" })).toBeNull();
  });

  it("renders ready action and notice in the final completed step", async () => {
    const pdf = "https://storage.test/subscription/s/redacted.pdf?sig=token";
    let completeDownload!: (value: { blob: Blob; name: string }) => void;
    downloadBlob.mockImplementationOnce(() => new Promise((resolve) => {
      completeDownload = resolve;
    }));
    render(<RedactPanel request={{ authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-redact-panel", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={{ status: async () => ({ data: null, status: "completed" }), submit: async () => ({ data: null, status: "completed" }), data: async () => ({ pdf }) }} />);
    await waitFor(() => expect(screen.getByText("Redaction complete.")).toBeInTheDocument());
    const panel = screen.getByRole("region", { name: "Redaction Ready" });
    const rows = screen.getAllByRole("listitem");
    expect(rows.at(-1)).toHaveAttribute("data-phase", "completed");
    expect(rows.at(-1)).toContainElement(panel);
    expect(within(panel).getByRole("group", { name: "Redaction actions" })).toBeVisible();
    const button = screen.getByRole("button", { name: "Download Redacted PDF" });
    expect(button).toHaveStyle({ fontWeight: "600", minHeight: "2.75rem", minWidth: "10rem", padding: "0.5rem 1rem" });
    fireEvent.click(button);
    const downloading = (await screen.findAllByText("Preparing redacted PDF download...")).at(-1)!;
    const downloadingRow = downloading.closest("li");
    expect(downloadingRow).toHaveAttribute("data-phase", "started");
    expect(within(downloadingRow!).getByLabelText("In progress")).toBeVisible();
    expect(within(rows.at(-1)!).getByRole("button", { name: "Download Redacted PDF" })).toBeDisabled();
    completeDownload({ blob: new Blob(["redact"]), name: "redacted.pdf" });
    await waitFor(() => expect(screen.getAllByText("Redacted PDF downloaded.")).toHaveLength(2));
    const downloaded = screen.getAllByText("Redacted PDF downloaded.").at(-1)!.closest("li");
    expect(downloaded).toHaveAttribute("data-phase", "completed");
    expect(button.compareDocumentPosition(downloaded!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.compareDocumentPosition(screen.getAllByText("Redacted PDF downloaded.").at(0)!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(downloadBlob).toHaveBeenCalledWith(pdf);
    expect(screen.queryByRole("button", { name: /back to start/i })).not.toBeInTheDocument();
  });

  it("keeps a redacted download failure in the progress timeline", async () => {
    const pdf = "https://storage.test/subscription/s/redacted.pdf?sig=token";
    downloadBlob.mockRejectedValueOnce(new Error("Download unavailable"));
    render(<RedactPanel request={{ authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-redact-download-failed", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={{ status: async () => ({ data: null, status: "completed" }), submit: async () => ({ data: null, status: "completed" }), data: async () => ({ pdf }) }} />);

    await screen.findByText("Redaction complete.");
    fireEvent.click(screen.getByRole("button", { name: "Download Redacted PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Download unavailable");
    const failed = screen.getByText("Redacted PDF download failed.").closest("li");
    expect(failed).toHaveAttribute("data-phase", "failed");
  });
});
