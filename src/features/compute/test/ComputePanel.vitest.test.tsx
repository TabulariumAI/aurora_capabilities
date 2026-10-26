import type { ResourceRequest } from "aurora-core";
import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeQueueStore } from "../store/computeQueueStore";
import { ComputePanel } from "../component/ComputePanel";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ComputePanel", () => {
  it("renders placeholders while the initial calculation is pending", async () => {
    render(<ComputePanel onAddFee={() => undefined} onAddFund={() => undefined} onResource={(request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" })} request={{ document: "document.pdf", authToken: "t", capability: "compute", refresh: false, documentApiGatewayUrl: "u", intervalMs: 1_000, requestId: "r-cp-progress", session: "s" }} segments={{ ACKNOWLEDGMENT: "acknowledgment", JUDGMENT: "judgment", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" }} onComplete={vi.fn()} onEndorse={vi.fn()} onError={vi.fn()} workerClient={{ model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }), submit: async () => ({ data: null, status: "processing" }), status: async () => ({ data: null, status: "processing" }), data: vi.fn() }} />);

    expect(screen.getByRole("status", { name: "Loading fees and funds" })).toHaveAttribute("aria-busy", "true");
    const loading = screen.getByRole("status", { name: "Loading fees and funds" });
    for (const title of ["Factors", "Fees", "Funds", "Total fees"]) expect(within(loading).getByText(title, { exact: true })).toBeVisible();
    expect(loading.querySelectorAll(".compute-row")).toHaveLength(2);
    expect(loading.querySelectorAll(".compute-row-actions")).toHaveLength(2);
    expect(within(loading).queryByRole("button")).not.toBeInTheDocument();
    expect(loading).not.toHaveTextContent(/\$|Ready to endorse|No fee|Loading fees and funds…/);
    expect(screen.queryByText("CALCULATING FEES AND FUNDS")).not.toBeInTheDocument();
  });

  it("replaces progress rows for a new fee calculation", async () => {
    const request = { document: "document.pdf", authToken: "t", capability: "compute" as const, refresh: true, documentApiGatewayUrl: "u", intervalMs: 10_000, session: "s" };
    const view = render(<ComputePanel onAddFee={() => undefined} onAddFund={() => undefined} onResource={(request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" })} request={{ ...request, requestId: "compute-1" }} segments={{ ACKNOWLEDGMENT: "acknowledgment", JUDGMENT: "judgment", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" }} onComplete={vi.fn()} onEndorse={vi.fn()} onError={vi.fn()} workerClient={{ model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }), submit: async () => ({ data: null, status: "processing" }), status: async () => ({ data: null, status: "processing" }), data: vi.fn() }} />);

    await screen.findByText("Calculating document fees...");
    view.rerender(<ComputePanel onAddFee={() => undefined} onAddFund={() => undefined} onResource={(request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" })} request={{ ...request, requestId: "compute-2" }} segments={{ ACKNOWLEDGMENT: "acknowledgment", JUDGMENT: "judgment", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" }} onComplete={vi.fn()} onEndorse={vi.fn()} onError={vi.fn()} workerClient={{ model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }), submit: async () => ({ data: null, status: "processing" }), status: async () => ({ data: null, status: "processing" }), data: vi.fn() }} />);

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Starting fee calculation...");
  });

  it("renders fee details directly without the document title or progress view", async () => {
    const onEndorse = vi.fn();
    render(<ComputePanel onAddFee={() => undefined} onAddFund={() => undefined} onResource={(request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" })} request={{ document: "document.pdf", authToken: "t", capability: "compute", refresh: false, documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-cp", session: "s" }} segments={{ ACKNOWLEDGMENT: "acknowledgment", JUDGMENT: "judgment", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" }} onComplete={vi.fn()} onEndorse={onEndorse} onError={vi.fn()} workerClient={{ model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }), submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => ({ chain: [{ class: "deed", required: "true", role: "owner", title: "Hidden owner" }], fee_factors: [{ amount: "40", code: "factor-1", explanation: "Taxable consideration.", name: "Consideration" }], fees: [{ amount: "40", code: "fee-1", explanation: "County recording charge.", formula: "base + pages", name: "Recording fee" }, { amount: "$203.50", code: "fee-2", explanation: "Additional county charge.", formula: "flat", name: "Additional fee" }], funds: [{ amount: "243.50", code: "fund-1", explanation: "Archive allocation.", formula: "flat", name: "Archive fund" }], heading: { class: "deed", title: "Title" }, history: { conveyance: [] } }) }} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Factors/i })).toBeVisible());
    expect(screen.queryByRole("heading", { name: "Deed" })).not.toBeInTheDocument();
    expect(document.querySelector("[data-metadata-context='true']")).toBeNull();
    expect(screen.queryByTestId("progress-caption")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Factors/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Fees/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Funds/i })).toBeVisible();
    for (const name of [
      /^Pages/i,
      /^Confidential/i,
      /^Titles/i,
      /^Endorsements/i,
      /^Parties\(Party Clause\)/i,
      /^References\(Recital\)/i,
      /^Property\(Exhibits\)/i,
      /^Legal Description/i,
      /^Monetary/i,
      /^Acknowledgment/i,
      /^Transactional/i,
      /^Vital/i,
    ]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /^Chain/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^History/i })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Compute" })).toHaveStyle({
      display: "flex",
      flex: "1 1 auto",
      flexDirection: "column",
      minHeight: "0",
      overflow: "hidden",
    });
    expect(screen.queryByRole("button", { name: /back to start/i })).not.toBeInTheDocument();
    const feeRow = screen.getByText("$40.00").closest("article");
    expect(feeRow).toHaveTextContent("Recording fee");
    expect(feeRow).not.toHaveTextContent("Formula:");
    fireEvent.click(within(feeRow!).getByRole("button", { name: "Expand details" }));
    expect(feeRow).toHaveTextContent("Formula: base + pages");
    expect(feeRow).toHaveTextContent("Explanation: County recording charge.");
    expect(screen.getByText("$203.50", { exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Factors/i }));
    const factorRow = screen.getByText("Consideration").closest("article");
    expect(factorRow).toHaveTextContent("40");
    expect(factorRow).not.toHaveTextContent("$40.00");
    fireEvent.click(screen.getByRole("button", { name: /^Funds/i }));
    expect(screen.getByText("$243.50", { exact: true, selector: ".compute-value" })).toBeVisible();
    expect(screen.queryByText(/\"amount\"/)).not.toBeInTheDocument();

    const actions = screen.getByRole("group", { name: "Compute actions" });
    expect(actions).toHaveStyle({ marginTop: "0.75rem" });
    vi.useFakeTimers();
    const endorse = screen.getByRole("button", { name: "Endorse" });
    fireEvent.click(endorse);

    expect(onEndorse).not.toHaveBeenCalled();
    expect(endorse).toHaveAttribute("data-armed", "true");
    expect(endorse).toHaveStyle({ outline: "2px solid var(--primary-dark)", outlineOffset: "2px" });
    expect(endorse.querySelector("[data-confirm-progress='true']")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeVisible();
    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByRole("button", { name: "Endorse" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Endorse" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onEndorse).toHaveBeenCalledOnce();
  });

  it("keeps a fee failure as the final timeline step", async () => {
    render(<ComputePanel onAddFee={() => undefined} onAddFund={() => undefined} onResource={(request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" })} request={{ document: "document.pdf", authToken: "t", capability: "compute", refresh: false, documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-cp-failed", session: "s" }} segments={{ ACKNOWLEDGMENT: "acknowledgment", JUDGMENT: "judgment", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" }} onComplete={vi.fn()} onEndorse={vi.fn()} onError={vi.fn()} workerClient={{ model: async () => ({ model: { fee_factors: [], fees: [], funds: [] }, etag: '"v1"' }), submit: async () => ({ data: "Fee service unavailable", status: "error" }), status: vi.fn(), data: vi.fn() }} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Fee service unavailable");
    expect(screen.getAllByRole("listitem").at(-1)).toHaveAttribute("data-phase", "failed");
    expect(screen.getByText("CALCULATING FEES AND FUNDS")).toBeVisible();
    expect(screen.queryByRole("button", { name: /back to start/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Endorse" })).not.toBeInTheDocument();
  });
});

it("requests the current result with an eTag while preserving local Compute drafts", async () => {
  const model = { fee_factors: [], fees: [["Recording", "Recording", "10"] as [string, string, string]], funds: [] };
  const result = { fee_factors: [], fees: [{ name: "Recording", formula: "10", explanation: "Recording", amount: "10" }], funds: [] };
  const client = { model: vi.fn(async () => ({ model, etag: "v1" })), patch: vi.fn(), submit: vi.fn(async () => ({ status: "completed", data: "" })), status: vi.fn(async () => ({ status: "completed", data: "" })), data: vi.fn(async () => result) };
  await computeQueueStore.getState().restore("owner", { authToken: "token", client, onChange: vi.fn() });
  await computeQueueStore.getState().setModel("cached-session", { model, etag: "v1" });
  await computeQueueStore.getState().setResult("cached-session", { fee_factors: [], fees: [{ name: "Recording", formula: "10", explanation: "Recording", amount: "10" }], funds: [] });
  await computeQueueStore.getState().enqueue("cached-session", { action: "add", fee: { name: "Extra", value: "2.50" } });
  const onResource = vi.fn((request: ResourceRequest) => request.callback({ ok: true, data: "metadata-etag" }));
  const onComplete = vi.fn();
  render(<ComputePanel onAddFee={vi.fn()} onAddFund={vi.fn()} onResource={onResource} onComplete={onComplete} onEndorse={vi.fn()} onError={vi.fn()} workerClient={client}
    request={{ document: "document.pdf", authToken: "token", capability: "compute", refresh: false, documentApiGatewayUrl: "https://api.test", intervalMs: 0, requestId: "cached-request", session: "cached-session" }} segments={{ ACKNOWLEDGMENT: "acknowledgment", JUDGMENT: "judgment", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" }} />);
  expect(await screen.findByText("Added")).toBeVisible();
  expect(screen.getByRole("group", { name: "Compute total" })).toHaveTextContent("$12.50");
  expect(client.submit).toHaveBeenCalledExactlyOnceWith("token", "cached-session", "metadata-etag", false);
  expect(client.status).toHaveBeenCalledOnce();
  expect(client.data).toHaveBeenCalledOnce();
  expect(onResource).toHaveBeenCalledOnce();
  expect(onComplete).toHaveBeenCalledOnce();
  cleanup();
  computeQueueStore.getState().reset();
});
