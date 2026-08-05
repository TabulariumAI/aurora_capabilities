import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecordPanel } from "../component/RecordPanel";

describe("RecordPanel", () => {
  it("reports loader text while recording is pending", async () => {
    const onLoaderChange = vi.fn();
    const view = render(<RecordPanel request={{ authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 1_000, requestId: "r-record-loader", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} onLoaderChange={onLoaderChange} onReadyChange={vi.fn()} onDownloadCover={vi.fn(async () => undefined)} onDownloadDocument={vi.fn(async () => undefined)} workerClient={{ status: () => new Promise<never>(() => undefined), computeData: vi.fn(), submit: vi.fn(), data: vi.fn() }} />);

    await waitFor(() => expect(onLoaderChange).toHaveBeenCalledWith(["Retrieving Indexes..."]));
    view.unmount();
  });

  it("renders summary and delivery notices", async () => {
    const onDownloadDocument = vi.fn(async () => undefined);
    const onReadyChange = vi.fn();
    render(<RecordPanel request={{ authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-record-panel", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} onReadyChange={onReadyChange} onDownloadCover={vi.fn(async () => undefined)} onDownloadDocument={onDownloadDocument} workerClient={{ status: async () => ({ data: null, status: "completed" }), computeData: async () => ({ heading: { class: "deed", title: "Title" } }), submit: async () => ({ data: null, status: "completed" }), data: async () => ({ cover: "cover.pdf", document: "record.pdf", heading: { class: "deed", title: "Seeded Recording", number: "12345", date: "2026-07-26", total: 125 }, status: "Completed", queueId: "q" }) }} />);
    expect(onReadyChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.getByText("Recording Summary")).toBeInTheDocument());
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByText("Recorded Document"));
    await waitFor(() => expect(screen.getByText("Recorded document downloaded")).toBeInTheDocument());
    expect(onDownloadDocument).toHaveBeenCalledWith("record.pdf");
  });
});
