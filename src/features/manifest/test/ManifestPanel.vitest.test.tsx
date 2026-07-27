import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManifestPanel } from "../component/ManifestPanel";

describe("ManifestPanel", () => {
  it("renders ready action and notice", async () => {
    render(<ManifestPanel request={{ authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-manifest-panel", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} onDownloadPdf={vi.fn(async () => undefined)} workerClient={{ status: async () => ({ data: null, status: "completed" }), submit: async () => ({ data: null, status: "completed" }), data: async () => ({ pdf: "https://storage.test/manifest.pdf" }) }} />);
    await waitFor(() => expect(screen.getByText("Manifest Ready")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Download Manifest PDF"));
    await waitFor(() => expect(screen.getByText("Manifest PDF downloaded.")).toBeInTheDocument());
  });
});
