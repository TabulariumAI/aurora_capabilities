import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DownloadButton } from "../component/DownloadButton";

const downloadBlob = vi.hoisted(() => vi.fn());

vi.mock("../worker/capabilityData", () => ({ downloadBlob }));

afterEach(() => {
  downloadBlob.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DownloadButton", () => {
  it("uses the shared primary control and downloads the full Azure Blob URL", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => "blob:record");
    const revokeObjectURL = vi.fn();
    class DownloadUrl extends URL {}
    Object.assign(DownloadUrl, { createObjectURL, revokeObjectURL });
    vi.stubGlobal("URL", DownloadUrl);
    const onStart = vi.fn();
    const onSuccess = vi.fn();
    downloadBlob.mockResolvedValue({ blob: new Blob(["record"]), name: "record.pdf" });
    render(<DownloadButton disabled={false} label="Endorsed Document" onError={vi.fn()} onStart={onStart} onSuccess={onSuccess} url="https://storage.test/subscription/s/record.pdf?sig=token" />);

    const button = screen.getByRole("button", { name: "Endorsed Document" });
    expect(button).toHaveStyle({
      backgroundColor: "var(--primary)",
      borderRadius: "var(--radius-control)",
      minHeight: "2.75rem",
    });
    expect(button).toHaveAttribute("data-variant", "primary");
    fireEvent.click(button);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(onStart).toHaveBeenCalledOnce();
    expect(downloadBlob).toHaveBeenCalledWith("https://storage.test/subscription/s/record.pdf?sig=token");
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:record");
  });
});
