import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import { useCompositionStore } from "../store/compositionStore";
import { CompositionPanel } from "../component/CompositionPanel";

afterEach(() => {
  cleanup();
  useCompositionStore.getState().reset();
});

const request = {
  authToken: "t",
  capability: "composition" as const,
  documentApiGatewayUrl: "u",
  intervalMs: 0,
  requestId: "composition-1",
  session: "s",
};

const result = {
  chain: [{
    address: "10 Main Street",
    class: "deed",
    code: "chain-1",
    date: "2025-01-02",
    explanation: "Current vesting deed.",
    page: "3",
    required: "YES",
    role: "vesting",
    source: "Recorded deed",
    title: "Grant Deed",
  }],
  fee_factors: [{ amount: "$1.00", name: "Hidden factor" }],
  fees: [{ amount: "$125.00", formula: "flat", name: "Hidden fee" }],
  funds: [{ amount: "$75.00", formula: "flat", name: "Hidden fund" }],
  heading: { class: "deed", title: "Hidden title" },
  history: {
    conveyance: [{ amount: "$640,000.00", date: "2025-01-02", grantees: "Grantee Family Trust", grantors: "Grantor Holdings", title_company: "Title Company" }],
    encumbrance: [{ amount: "$2,000.00", date: "2025-01-03", enc_type: "Lien", parties: "Lienholder LLC", status: "Active" }],
    mortgage: [{ amount: "$480,000.00", borrowers: "Borrower Family Trust", date: "2025-01-02", lender: "Citywide Bank", status: "Active" }],
  },
  indexes: [{ aspect: "parcel_address", segment: "property", value: "Hidden property" }],
};

describe("CompositionPanel", () => {
  it("renders document composition progress while the worker is pending", async () => {
    render(<CompositionPanel callbacks={{}} request={{ ...request, intervalMs: 1_000 }} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={vi.fn()} onViewBatch={vi.fn()} workerClient={{ submit: async () => ({ data: null, status: "processing" }), status: () => new Promise<never>(() => undefined), data: vi.fn(), options: vi.fn() }} />);

    expect(await screen.findByText("COMPOSING DOCUMENT METADATA")).toBeVisible();
    expect(screen.getByText("I’ll keep you updated while I compose the document and prepare its metadata.")).toBeVisible();
    expect(await screen.findByText("Starting document composition...")).toBeVisible();
    expect(await screen.findByText("Composing document metadata...")).toBeVisible();
  });

  it("replaces progress rows for a new composition", async () => {
    const workerClient = { submit: async () => ({ data: null, status: "processing" }), status: () => new Promise<never>(() => undefined), data: vi.fn(), options: vi.fn() };
    const view = render(<CompositionPanel callbacks={{}} request={request} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={vi.fn()} onViewBatch={vi.fn()} workerClient={workerClient} />);

    await screen.findByText("Composing document metadata...");
    view.rerender(<CompositionPanel callbacks={{}} request={{ ...request, requestId: "composition-2" }} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={vi.fn()} onViewBatch={vi.fn()} workerClient={workerClient} />);

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Starting document composition...");
  });

  it("replaces progress with a composition view containing only Chain and History", async () => {
    render(<CompositionPanel callbacks={{}} request={request} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={vi.fn()} onViewBatch={vi.fn()} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => result, options: async () => [] }} />);

    expect(await screen.findByRole("region", { name: "Composition" })).toBeVisible();
    const chain = screen.getByRole("button", { name: "Chain" });
    const history = screen.getByRole("button", { name: "History" });
    expect(chain).toBeVisible();
    expect(chain.parentElement?.lastElementChild).toHaveTextContent("1");
    expect(history).toBeVisible();
    expect(history.parentElement?.lastElementChild).toHaveTextContent("3");
    expect(screen.getByText("Grant Deed").closest("article")).toHaveTextContent("Role: vesting");
    expect(screen.queryByRole("region", { name: "Metadata" })).not.toBeInTheDocument();
    expect(screen.queryByText("COMPOSING DOCUMENT METADATA")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden title")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden property")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fee Factors/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Fees/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Funds/i })).not.toBeInTheDocument();
    const accordion = screen.getByRole("region", { name: "Composition accordion" });
    expect(accordion).toHaveAttribute("data-panel-scroll", "true");
    expect(accordion).toHaveStyle({ flex: "1 1 0" });
    expect(capabilityStyles.compositionAccordion).toMatchObject({ padding: "0 var(--panel-content-padding)" });
    expect(capabilityStyles.composition).toMatchObject({ gap: 0, overflow: "hidden", padding: "0.75rem 0 0" });
    expect(capabilityStyles.batchActions).toMatchObject({ padding: "0.75rem var(--panel-content-padding) var(--panel-content-padding)" });

    fireEvent.click(history);

    expect(screen.getByText("Grantee Family Trust").closest("article")).toHaveTextContent("Grantors: Grantor Holdings");
    expect(screen.getByText("Borrower Family Trust").closest("article")).toHaveTextContent("Lender: Citywide Bank");
    expect(screen.getByText("Lienholder LLC").closest("article")).toHaveTextContent("Type: Lien");
  });

  it("shows only batch-link progress after linking the visible batch name", async () => {
    const linked = { code: "batch-1", id: "batch-1", name: "My Batch" };
    let completeLink!: (value: typeof linked) => void;
    const onLinkBatch = vi.fn(() => new Promise<typeof linked>((resolve) => {
      completeLink = resolve;
    }));
    const onViewBatch = vi.fn();
    const options = vi.fn(async () => ["10 Main Street", "APN-123"]);
    render(<CompositionPanel callbacks={{}} request={request} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={onLinkBatch} onViewBatch={onViewBatch} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => result, options }} />);
    await screen.findByRole("region", { name: "Composition" });

    const input = await screen.findByRole("combobox", { name: "Batch name" });
    await waitFor(() => expect(input).toHaveValue("10 Main Street"));
    expect(Array.from(document.querySelectorAll<HTMLOptionElement>("#composition-batch-names option"), (option) => option.value)).toEqual([
      "10 Main Street",
      "APN-123",
    ]);
    expect(options).toHaveBeenCalledWith("t", "s");
    expect(screen.queryByTestId("progress-view")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "My Batch" } });
    fireEvent.click(screen.getByRole("button", { name: "Link to batch" }));

    await waitFor(() => expect(onLinkBatch).toHaveBeenCalledWith("My Batch"));
    expect(screen.queryByRole("button", { name: "Link to batch" })).not.toBeInTheDocument();
    const progress = screen.getByTestId("progress-view");
    expect(progress).toHaveTextContent("LINKING DOCUMENT TO BATCH");
    expect(progress).not.toHaveTextContent("Starting document composition...");
    expect(screen.getByText("Linking session to batch...").closest("li")).toHaveAttribute("data-phase", "started");
    expect(screen.queryByRole("combobox", { name: "Batch name" })).not.toBeInTheDocument();

    completeLink(linked);
    const view = await screen.findByRole("button", { name: "View batch" });
    const completedRow = screen.getByText("Session linked to batch.").closest("li");
    expect(completedRow).toHaveAttribute("data-phase", "completed");
    expect(completedRow).toContainElement(view);
    expect(screen.queryByRole("group", { name: "Composition actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link to batch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Batch name" })).not.toBeInTheDocument();
    expect(screen.queryByText("Document linked to batch.")).not.toBeInTheDocument();
    expect(view).toHaveStyle({ fontWeight: "600", minHeight: "2.75rem", minWidth: "10rem", padding: "0.5rem 1rem" });
    expect(progress).toContainElement(view);

    fireEvent.click(view);

    expect(onViewBatch).toHaveBeenCalledWith(linked);
  });

  it("does not report success when the session was not linked", async () => {
    const onLinkBatch = vi.fn(async () => null);
    render(<CompositionPanel callbacks={{}} request={request} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={onLinkBatch} onViewBatch={vi.fn()} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => result, options: async () => ["10 Main Street"] }} />);
    await screen.findByRole("region", { name: "Composition" });

    await screen.findByRole("combobox", { name: "Batch name" });
    fireEvent.click(screen.getByRole("button", { name: "Link to batch" }));

    await waitFor(() => expect(onLinkBatch).toHaveBeenCalledWith("10 Main Street"));
    expect(screen.getByText("Batch link failed.").closest("li")).toHaveAttribute("data-phase", "failed");
    expect(screen.queryByText("Document linked to batch.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View batch" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link to batch" })).toBeVisible();
  });

  it("shows a failed progress row when batch linking rejects", async () => {
    render(<CompositionPanel callbacks={{}} request={request} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={async () => { throw new Error("Link unavailable"); }} onViewBatch={vi.fn()} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => result, options: async () => ["10 Main Street"] }} />);
    await screen.findByRole("combobox", { name: "Batch name" });

    fireEvent.click(screen.getByRole("button", { name: "Link to batch" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Link unavailable");
    expect(screen.getByText("Batch link failed.").closest("li")).toHaveAttribute("data-phase", "failed");
    expect(screen.getByRole("button", { name: "Link to batch" })).toBeEnabled();
  });

  it("allows manual entry when no recommended batch name exists", async () => {
    const onLinkBatch = vi.fn(async (name: string) => ({ code: "batch-manual", id: "batch-manual", name }));
    render(<CompositionPanel callbacks={{}} request={request} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={onLinkBatch} onViewBatch={vi.fn()} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => result, options: async () => [] }} />);

    const input = await screen.findByRole("combobox", { name: "Batch name" });
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Enter batch name");
    expect(screen.getByRole("button", { name: "Link to batch" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "Manual Batch" } });
    fireEvent.click(screen.getByRole("button", { name: "Link to batch" }));

    await waitFor(() => expect(onLinkBatch).toHaveBeenCalledWith("Manual Batch"));
  });

  it("reports batch-name option failures through onError", async () => {
    const onError = vi.fn();
    render(<CompositionPanel callbacks={{}} request={request} onComplete={vi.fn()} onError={onError} onLinkBatch={vi.fn()} onViewBatch={vi.fn()} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => result, options: async () => { throw new Error("Batch names unavailable"); } }} />);
    await screen.findByRole("region", { name: "Composition" });

    await waitFor(() => expect(onError).toHaveBeenCalledWith({
      capability: "composition",
      error: expect.objectContaining({ error: "Batch names unavailable" }),
      operation: "options",
      requestId: "composition-1",
      session: "s",
    }));
  });

  it("keeps a composition failure as the final timeline step", async () => {
    render(<CompositionPanel callbacks={{}} request={{ ...request, requestId: "composition-failed" }} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={vi.fn()} onViewBatch={vi.fn()} workerClient={{ submit: async () => ({ data: "Composition unavailable", status: "error" }), status: vi.fn(), data: vi.fn(), options: vi.fn() }} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Composition unavailable");
    expect(screen.getAllByRole("listitem").at(-1)).toHaveAttribute("data-phase", "failed");
    expect(screen.getByText("COMPOSING DOCUMENT METADATA")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Link to batch" })).not.toBeInTheDocument();
  });
});
