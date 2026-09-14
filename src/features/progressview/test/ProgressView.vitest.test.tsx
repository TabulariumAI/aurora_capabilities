import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressView } from "../component/ProgressView";

const scroll = vi.fn();
let scrollDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  scroll.mockClear();
  scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
});

afterEach(() => {
  cleanup();
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
  else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

describe("ProgressView", () => {
  it("renders the uppercase process caption using the intake convention", () => {
    render(
      <ProgressView
        fillCompletion={false}
        intro="I’ll keep you updated as I calculate document fees."
        jobs={[{ jobId: "fees", message: "Calculating document fees...", phase: "started" }]}
        process="CALCULATING FEES AND FUNDS"
      />,
    );

    expect(screen.getByTestId("progress-view")).toHaveAttribute("data-panel-scroll", "true");
    expect(screen.getByTestId("progress-caption")).toHaveTextContent("CALCULATING FEES AND FUNDS");
    expect(screen.getByTestId("progress-caption")).toHaveStyle({ color: "var(--slate-500)", textTransform: "uppercase" });
    expect(screen.getByText("I’ll keep you updated as I calculate document fees.")).toBeVisible();
    expect(screen.getByRole("list", { name: "CALCULATING FEES AND FUNDS updates" })).toBeVisible();
    expect(screen.getByTestId("progress-intro").firstElementChild).toHaveAttribute("style", expect.stringContaining("border: 1px solid var(--primary-dark)"));
    expect(screen.getByTestId("progress-intro").firstElementChild).toHaveStyle({
      backgroundColor: "var(--gray-50)",
      color: "var(--primary-dark)",
    });
    expect(screen.getByTestId("progress-intro-connector")).toHaveStyle({ bottom: "-1.35rem", top: "2.5rem" });
    expect(screen.getByTestId("progress-intro-connector")).toHaveStyle({ borderLeftColor: "var(--gray-300)" });
  });

  it("renders failure as the final timeline step without a recovery button", () => {
    render(
      <ProgressView
        fillCompletion={false}
        intro="I’ll keep you updated as I generate the manifest."
        jobs={[
          { jobId: "status", message: "Checking manifest status...", phase: "completed" },
          { jobId: "submit", message: "Generating document manifest...", phase: "started" },
          { error: "Manifest service unavailable", jobId: "data", message: "Preparing manifest download...", phase: "failed" },
        ]}
        process="GENERATING THE INDEX MANIFEST"
      />,
    );

    const rows = within(screen.getByRole("list", { name: "GENERATING THE INDEX MANIFEST updates" })).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByLabelText("Completed")).toBeVisible();
    expect(within(rows[1]).getByLabelText("In progress")).toHaveAttribute("aria-current", "step");
    expect(within(rows[2]).getByRole("alert")).toHaveTextContent("Manifest service unavailable");
    expect(within(rows[2]).getByRole("alert")).toHaveStyle({ overflowWrap: "anywhere" });
    expect(rows[2]).toHaveAttribute("data-phase", "failed");
    expect(screen.getAllByTestId("progress-connector")).toHaveLength(2);
    expect(screen.getByTestId("progress-intro-connector")).toBeVisible();
    expect(screen.queryByRole("button", { name: /back to start/i })).not.toBeInTheDocument();
  });

  it("uses the documented active, completed, and failed phase presentation", () => {
    render(
      <ProgressView
        fillCompletion={false}
        intro="I’ll keep you updated as I generate the manifest."
        jobs={[
          { jobId: "active", message: "Generating manifest...", phase: "started" },
          { jobId: "done", message: "Manifest generated.", phase: "completed" },
          { error: "Download unavailable", jobId: "failed", message: "Downloading manifest...", phase: "failed" },
        ]}
        process="GENERATING THE INDEX MANIFEST"
      />,
    );

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByLabelText("In progress")).toHaveAttribute("style", expect.stringContaining("border: 1px solid var(--primary-dark)"));
    expect(within(rows[0]).getByLabelText("In progress")).toHaveStyle({
      backgroundColor: "var(--gray-50)",
      color: "var(--primary-dark)",
      height: "3.25rem",
      width: "3.25rem",
    });
    expect(within(rows[0]).getByTestId("progress-spinner")).toHaveClass("progressview-active");
    expect(within(rows[0]).getByText("Generating manifest...").parentElement).toHaveStyle({ backgroundColor: "var(--accent-surface)" });
    expect(within(rows[1]).getByLabelText("Completed")).toHaveStyle({
      backgroundColor: "#ECFDF3",
      border: "1px solid #15803D",
      color: "#15803D",
    });
    expect(within(rows[2]).getByLabelText("Failed")).toHaveStyle({ backgroundColor: "#FEF2F2", color: "#991B1B" });
    expect(within(rows[2]).getByText("Downloading manifest...").parentElement).toHaveStyle({ backgroundColor: "#FEF2F2" });
  });

  it("renders success content only in the final completed step", () => {
    render(
      <ProgressView
        completion={<a href="manifest.pdf">Download manifest</a>}
        fillCompletion={false}
        intro="I’ll keep you updated as I generate the manifest."
        jobs={[
          { jobId: "status", message: "Checking manifest status...", phase: "completed" },
          { jobId: "complete", message: "Manifest is ready to download.", phase: "completed" },
        ]}
        process="GENERATING THE INDEX MANIFEST"
      />,
    );

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByTestId("progress-completed-check")).toBeVisible();
    expect(within(rows[1]).getByTestId("progress-success-star")).toBeVisible();
    expect(within(rows[1]).getByTestId("progress-success-star").querySelector("path")).toHaveAttribute("d", "m12 2.5 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.5Z");
    expect(within(rows[1]).getByLabelText("Completed")).toHaveAttribute("style", expect.stringContaining("border: 1px solid var(--primary-dark)"));
    expect(within(rows[1]).getByLabelText("Completed")).toHaveStyle({
      backgroundColor: "var(--gray-50)",
      color: "var(--primary-dark)",
    });
    expect(within(rows[0]).getByText("Checking manifest status...").parentElement).toHaveStyle({ backgroundColor: "#ECFDF3" });
    expect(within(rows[1]).getByText("Manifest is ready to download.").parentElement).toHaveStyle({ backgroundColor: "var(--accent-surface)" });
    expect(within(rows[0]).queryByRole("link", { name: "Download manifest" })).not.toBeInTheDocument();
    expect(within(rows[1]).getByRole("link", { name: "Download manifest" })).toHaveAttribute("href", "manifest.pdf");
  });

  it("keeps completion content with its assigned step when a later progress step is added", () => {
    render(
      <ProgressView
        completion={<button type="button">Download manifest</button>}
        completionJobId="ready"
        fillCompletion={false}
        intro="I’ll keep you updated as I generate the manifest."
        jobs={[
          { jobId: "ready", message: "Manifest is ready to download.", phase: "completed" },
          { jobId: "download", message: "Downloading manifest...", phase: "started" },
        ]}
        process="GENERATING THE INDEX MANIFEST"
      />,
    );

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByRole("button", { name: "Download manifest" })).toBeVisible();
    expect(within(rows[1]).queryByRole("button", { name: "Download manifest" })).not.toBeInTheDocument();
  });

  it("scrolls the newest row into view when progress changes", () => {
    const props = {
      fillCompletion: false,
      intro: "I’ll keep you updated as I generate the manifest.",
      process: "GENERATING THE INDEX MANIFEST",
    };

    const view = render(<ProgressView {...props} jobs={[{ jobId: "status", message: "Checking manifest status...", phase: "started" }]} />);
    expect(scroll).toHaveBeenCalledWith({ block: "end" });
    expect(scroll.mock.instances[0]).toBe(screen.getByRole("listitem"));

    view.rerender(
      <ProgressView
        {...props}
        jobs={[
          { jobId: "status", message: "Checking manifest status...", phase: "completed" },
          { jobId: "submit", message: "Generating document manifest...", phase: "started" },
        ]}
      />,
    );

    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroll.mock.instances[1]).toBe(screen.getAllByRole("listitem")[1]);
  });

  it("fills the remaining timeline area for a full-height completion", () => {
    render(
      <ProgressView
        completion={<div>Full result</div>}
        fillCompletion
        intro="I’ll keep you updated while I compose the document."
        jobs={[
          { jobId: "compose", message: "Composing document metadata...", phase: "completed" },
          { jobId: "complete", message: "Document composition complete.", phase: "completed" },
        ]}
        process="COMPOSING DOCUMENT METADATA"
      />,
    );

    const rows = screen.getAllByRole("listitem");
    expect(screen.getByTestId("progress-content")).toHaveStyle({ height: "100%" });
    expect(rows[1]).toHaveStyle({ minHeight: "0", overflow: "hidden" });
    expect(screen.getByText("Full result").parentElement).toHaveStyle({ minHeight: "0", overflow: "hidden" });
  });
});
