import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecordPanel } from "../component/RecordPanel";

describe("RecordPanel", () => {
  it("renders summary and delivery notices", async () => {
    const onDownloadDocument = vi.fn(async () => undefined);
    render(<RecordPanel request={{ authToken: "t", capability: "record", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-record-panel", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} onDownloadCover={vi.fn(async () => undefined)} onDownloadDocument={onDownloadDocument} workerClient={{ status: async () => ({ data: null, status: "completed" }), computeData: async () => ({ heading: { class: "deed", title: "Title" } }), submit: async () => ({ data: null, status: "completed" }), data: async () => ({ cover: "cover.pdf", document: "record.pdf", heading: { class: "deed", title: "Seeded Recording", number: "12345", date: "2026-07-26", total: 125 }, status: "Completed", queueId: "q" }) }} />);
    await waitFor(() => expect(screen.getByText("Recording Summary")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Recorded Document"));
    await waitFor(() => expect(screen.getByText("Recorded document downloaded")).toBeInTheDocument());
    expect(onDownloadDocument).toHaveBeenCalledWith("record.pdf");
  });
});
