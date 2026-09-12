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
    expect(accordion).toHaveStyle({ flex: "0 1 auto" });
    expect(capabilityStyles.compositionAccordion).toMatchObject({ padding: "0 var(--panel-content-padding)" });
    expect(capabilityStyles.composition).toMatchObject({ gap: 0, overflow: "hidden", padding: "0.75rem 0 0" });
    expect(capabilityStyles.batchActions).toMatchObject({ padding: "0.75rem var(--panel-content-padding) var(--panel-content-padding)" });

    fireEvent.click(history);

    expect(screen.getByText("Grantee Family Trust").closest("article")).toHaveTextContent("Grantors: Grantor Holdings");
    expect(screen.getByText("Borrower Family Trust").closest("article")).toHaveTextContent("Lender: Citywide Bank");
    expect(screen.getByText("Lienholder LLC").closest("article")).toHaveTextContent("Type: Lien");
  });

  it("opens batch selection with suggestions without a textbox or premature linking progress", async () => {
    const linked = { batch: { code: "batch-1", id: "batch-1", name: "My Batch" }, group: "user" as const };
    let resolve!: (value: typeof linked | null) => void;
    const onLinkBatch = vi.fn(() => new Promise<typeof linked | null>((done) => { resolve = done; }));
    const onViewBatch = vi.fn();
    const options = vi.fn(async () => ["10 Main Street", "APN-123"]);
    render(<CompositionPanel callbacks={{}} request={request} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={onLinkBatch} onViewBatch={onViewBatch} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => result, options }} />);
    const link = await screen.findByRole("button", { name: "Link to batch" });
    await waitFor(() => expect(options).toHaveBeenCalledWith("t", "s"));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(link).toHaveAttribute("type", "button");
    fireEvent.click(link);
    expect(onLinkBatch).toHaveBeenCalledExactlyOnceWith("user", ["10 Main Street", "APN-123"]);
    expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-view")).not.toBeInTheDocument();
    fireEvent.click(link);
    expect(onLinkBatch).toHaveBeenCalledTimes(1);
    resolve(linked);
    const view = await screen.findByRole("button", { name: "View batch" });
    expect(screen.getByText("Session linked to batch.").closest("li")).toContainElement(view);
    expect(screen.queryByRole("group", { name: "Composition actions" })).not.toBeInTheDocument();
    fireEvent.click(view);
    expect(onViewBatch).toHaveBeenCalledWith(linked);
  });

  it("keeps Link available after cancelling the dialog, without reporting failure", async () => {
    const onLinkBatch = vi.fn(async () => null);
    render(<CompositionPanel callbacks={{}} request={request} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={onLinkBatch} onViewBatch={vi.fn()} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => result, options: async () => [] }} />);
    const link = await screen.findByRole("button", { name: "Link to batch" });
    fireEvent.click(link);
    await waitFor(() => expect(onLinkBatch).toHaveBeenCalledWith("user", []));
    await waitFor(() => expect(link).toBeEnabled());
    expect(screen.queryByTestId("progress-view")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View batch" })).not.toBeInTheDocument();
  });

  it("allows retry after the host rejects batch selection", async () => {
    render(<CompositionPanel callbacks={{}} request={request} onComplete={vi.fn()} onError={vi.fn()} onLinkBatch={async () => { throw new Error("Link unavailable"); }} onViewBatch={vi.fn()} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => result, options: async () => [] }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Link to batch" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Link unavailable");
    expect(screen.getByRole("button", { name: "Link to batch" })).toBeEnabled();
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
