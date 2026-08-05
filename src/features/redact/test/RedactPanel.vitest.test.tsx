import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RedactPanel } from "../component/RedactPanel";

describe("RedactPanel", () => {
  it("reports loader text while redaction is pending", async () => {
    const onLoaderChange = vi.fn();
    const view = render(<RedactPanel request={{ authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 1_000, requestId: "r-redact-loader", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} onLoaderChange={onLoaderChange} onReadyChange={vi.fn()} onDownloadPdf={vi.fn(async () => undefined)} workerClient={{ status: () => new Promise<never>(() => undefined), submit: vi.fn(), data: vi.fn() }} />);

    await waitFor(() => expect(onLoaderChange).toHaveBeenCalledWith(["Retrieving Confidential Information..."]));
    view.unmount();
  });

  it("renders ready action and notice", async () => {
    const onReadyChange = vi.fn();
    render(<RedactPanel request={{ authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-redact-panel", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} onReadyChange={onReadyChange} onDownloadPdf={vi.fn(async () => undefined)} workerClient={{ status: async () => ({ data: null, status: "completed" }), submit: async () => ({ data: null, status: "completed" }), data: async () => ({ pdf: "redacted.pdf" }) }} />);
    expect(onReadyChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.getByText("Redaction Ready")).toBeInTheDocument());
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByText("Download Redacted PDF"));
    await waitFor(() => expect(screen.getByText("Redacted PDF downloaded.")).toBeInTheDocument());
  });
});
