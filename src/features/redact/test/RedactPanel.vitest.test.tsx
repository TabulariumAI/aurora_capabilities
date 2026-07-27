import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RedactPanel } from "../component/RedactPanel";

describe("RedactPanel", () => {
  it("renders ready action and notice", async () => {
    render(<RedactPanel request={{ authToken: "t", capability: "redact", document: "d", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-redact-panel", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} onDownloadPdf={vi.fn(async () => undefined)} workerClient={{ status: async () => ({ data: null, status: "completed" }), submit: async () => ({ data: null, status: "completed" }), data: async () => ({ pdf: "redacted.pdf" }) }} />);
    await waitFor(() => expect(screen.getByText("Redaction Ready")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Download Redacted PDF"));
    await waitFor(() => expect(screen.getByText("Redacted PDF downloaded.")).toBeInTheDocument());
  });
});
