import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManifestPanel } from "../component/ManifestPanel";

describe("ManifestPanel", () => {
  it("reports loader text while manifest creation is pending", async () => {
    const onLoaderChange = vi.fn();
    const view = render(<ManifestPanel request={{ authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 1_000, requestId: "r-manifest-loader", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} onLoaderChange={onLoaderChange} onReadyChange={vi.fn()} onDownloadPdf={vi.fn(async () => undefined)} workerClient={{ status: () => new Promise<never>(() => undefined), submit: vi.fn(), data: vi.fn() }} />);

    await waitFor(() => expect(onLoaderChange).toHaveBeenCalledWith(["Retrieving Indexes..."]));
    view.unmount();
  });

  it("renders ready action and notice", async () => {
    const onReadyChange = vi.fn();
    render(<ManifestPanel request={{ authToken: "t", capability: "manifest", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-manifest-panel", session: "s" }} onComplete={vi.fn()} onError={vi.fn()} onReadyChange={onReadyChange} onDownloadPdf={vi.fn(async () => undefined)} workerClient={{ status: async () => ({ data: null, status: "completed" }), submit: async () => ({ data: null, status: "completed" }), data: async () => ({ pdf: "https://storage.test/manifest.pdf" }) }} />);
    expect(onReadyChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.getByText("Manifest Ready")).toBeInTheDocument());
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByText("Download Manifest PDF"));
    await waitFor(() => expect(screen.getByText("Manifest PDF downloaded.")).toBeInTheDocument());
  });
});
