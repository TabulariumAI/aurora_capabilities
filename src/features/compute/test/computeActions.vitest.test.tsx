import { IDBFactory } from "fake-indexeddb";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ComputeDetails } from "../component/ComputeDetails";
import { computeQueueStore } from "../store/computeQueueStore";

beforeEach(() => { computeQueueStore.getState().reset(); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(cleanup);

it.each(["total_amount", "10.0"])("switches action groups through discard, saving, failure, and saved totals using fund formula %s", async formula => {
  const saved = { model: { fee_factors: [], fees: [["Extra", "Extra", "2.50"], ["Fee", "fee", "10.0"]] as [string, string, string][], funds: [["Fund", "fund", formula]] as [string, string, string][] }, etag: '"v2"' };
  let finishSave!: () => void;
  const client = { model: vi.fn(), patch: vi.fn(() => new Promise<typeof saved>(resolve => { finishSave = () => resolve(saved); })) };
  await computeQueueStore.getState().restore("owner", { client, authToken: "token", onChange: vi.fn() });
  await computeQueueStore.getState().setModel("session", { model: { fee_factors: [], fees: [["Fee", "fee", "10.0"]], funds: [["Fund", "fund", formula]] }, etag: '"v1"' });
  await computeQueueStore.getState().setResult("session", { fee_factors: [], fees: [{ name: "fee", amount: "10.00", formula: "10.0", explanation: "Fee" }], funds: [{ name: "fund", amount: "10.00", formula, explanation: "Fund" }] });
  function View() {
    const result = computeQueueStore(state => state.data.session);
    return <ComputeDetails session="session" data={result} onAddFee={vi.fn()} onAddFund={vi.fn()} onEndorse={vi.fn()} openSegment="fee" setOpenSegment={vi.fn()} shortcuts={new Map()} segments={{ ACKNOWLEDGMENT: "acknowledgment", JUDGMENT: "judgment", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" }} />;
  }
  render(<View />);
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull();
  await act(async () => { await computeQueueStore.getState().enqueue("session", { action: "add", fee: { name: "Extra", value: "2.50" } }); });
  expect(screen.getByRole("group", { name: "Compute total" })).toHaveTextContent("$12.50");
  expect(screen.getByRole("status", { name: "Save status" })).toHaveTextContent("Unsaved changes. Save changes before endorsing.");
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Endorse" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  await waitFor(() => expect(screen.getByRole("group", { name: "Compute total" })).toHaveTextContent("$10.00"));
  expect(client.patch).not.toHaveBeenCalled();
  expect(screen.getByRole("status", { name: "Save status" })).toHaveTextContent("Ready to endorse.");
  expect(screen.getByRole("button", { name: "Endorse" })).toBeEnabled();
  await act(async () => { await computeQueueStore.getState().enqueue("session", { action: "add", fee: { name: "Extra", value: "2.50" } }); });
  client.patch.mockRejectedValueOnce(new Error("Save unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.getByRole("alert", { name: "Save failed" })).toHaveTextContent("Save unavailable"));
  expect(screen.queryByRole("button", { name: "Endorse" })).toBeNull();
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Discard changes" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.getByRole("status", { name: "Save status" })).toHaveTextContent("Saving changes…"));
  expect(screen.queryByRole("button", { name: "Endorse" })).toBeNull();
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled();
  await act(async () => { finishSave(); });
  await waitFor(() => expect(screen.getByRole("button", { name: "Endorse" })).toBeVisible());
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull();
  if (formula === "total_amount") expect(screen.getByRole("button", { name: "Endorse" })).toBeEnabled();
  else expect(screen.getByRole("button", { name: "Endorse" })).toBeDisabled();
});
