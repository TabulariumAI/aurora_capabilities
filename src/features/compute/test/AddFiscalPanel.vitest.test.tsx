import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AddFiscalPanel } from "../component/AddFiscalPanel";
import { computeQueueStore } from "../store/computeQueueStore";

const request = { authToken: "token", session: "session", documentApiGatewayUrl: "https://api.test" };
const model = { fee_factors: [], fees: [], funds: [] };
const client = { model: vi.fn(async () => ({ model, etag: '"v1"' })), patch: vi.fn() };
beforeEach(async () => {
  computeQueueStore.getState().reset();
  await computeQueueStore.getState().restore("owner", { authToken: "token", client, onChange: vi.fn() });
  await computeQueueStore.getState().setResult("session", { fee_factors: [], fees: [], funds: [] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each([[false, "0"], [false, "2.5"], [true, "0"], [true, "2.5"]] as const)("stores literal fee/fund changes locally; dedicated=%s, value=%s", async (dedicated, value) => {
  const onQueued = vi.fn();
  render(<AddFiscalPanel segment="fees" request={request} workerClient={client} onQueued={onQueued} />);
  expect(screen.getByLabelText("Fund Name")).toBeDisabled();
  expect(screen.queryByLabelText("Fund Value")).toBeNull();
  fireEvent.change(screen.getByLabelText("Fee Name"), { target: { value: "Extra Fee" } });
  fireEvent.change(screen.getByLabelText("Fee Value"), { target: { value } });
  if (dedicated) {
    fireEvent.click(screen.getByLabelText("Fee has a dedicated fund"));
    fireEvent.change(screen.getByLabelText("Fund Name"), { target: { value: "Dedicated Fund" } });
  }
  await waitFor(() => expect(screen.getByRole("button", { name: "Add" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  await waitFor(() => expect(onQueued).toHaveBeenCalledOnce());
  expect(computeQueueStore.getState().tasks).toHaveLength(1);
  expect(computeQueueStore.getState().tasks[0].change).toEqual({ action: "add", fee: { name: "Extra Fee", value: Number(value).toFixed(2), ...(dedicated ? { fund: { name: "Dedicated Fund" } } : {}) } });
  expect(client.patch).not.toHaveBeenCalled();
});
it("keeps Add disabled for invalid fields and the host owns Close", async () => {
  render(<AddFiscalPanel segment="fees" request={request} workerClient={client} onQueued={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  const add = screen.getByRole("button", { name: "Add" });
  expect(add).toHaveAttribute("data-variant", "primary");
  expect(add.parentElement).toHaveStyle({ justifyContent: "center" });
  fireEvent.change(screen.getByLabelText("Fee Name"), { target: { value: " " } });
  fireEvent.change(screen.getByLabelText("Fee Value"), { target: { value: "2.50" } });
  expect(add).toBeDisabled();
  await act(async () => undefined);
});
it("does not accept changes after a model load failure", async () => {
  const unavailable = { model: vi.fn(async () => { throw new Error("Model unavailable"); }), patch: vi.fn() };
  render(<AddFiscalPanel segment="fees" request={request} workerClient={unavailable} onQueued={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Fee Name"), { target: { value: "Extra" } });
  fireEvent.change(screen.getByLabelText("Fee Value"), { target: { value: "2.50" } });
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Model unavailable"));
  expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
});

it("uses the locally restored model without fetching it again", async () => {
  await computeQueueStore.getState().setModel("session", { model, etag: '"v1"' });
  client.model.mockClear();
  render(<AddFiscalPanel segment="fees" request={request} workerClient={client} onQueued={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Fee Name"), { target: { value: "Extra" } });
  fireEvent.change(screen.getByLabelText("Fee Value"), { target: { value: "2.50" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Add" })).toBeEnabled());
  expect(client.model).not.toHaveBeenCalled();
});
