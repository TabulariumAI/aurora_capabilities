import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AddFiscalPanel } from "../component/AddFiscalPanel";
import { computeQueueStore } from "../store/computeQueueStore";

const request = { authToken: "token", session: "session", documentApiGatewayUrl: "https://api.test" };
beforeEach(() => { computeQueueStore.getState().reset();  });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(["0", "2.5"])("requires name and value, accepts zero, and queues a fund only; value=%s", async value => {
  const client = { model: vi.fn(async () => ({ model: { fees: [], funds: [], fee_factors: [] }, etag: '\"v1\"' })), patch: vi.fn(() => new Promise<never>(() => {})) };
  const onQueued = vi.fn();
  await computeQueueStore.getState().restore("owner", { authToken: "token", client, onChange: vi.fn() });
  await computeQueueStore.getState().setResult("session", { fees: [], funds: [] });
  render(<AddFiscalPanel segment="funds" request={request} workerClient={client} onQueued={onQueued} />);
  const add = screen.getByRole("button", { name: "Add" });
  expect(add).toBeDisabled();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByLabelText("Fee Name")).toBeNull();
  fireEvent.change(screen.getByLabelText("Fund Name"), { target: { value: "   " } });
  fireEvent.change(screen.getByLabelText("Fund Value"), { target: { value } });
  expect(add).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Fund Name"), { target: { value: " Extra Fund " } });
  await waitFor(() => expect(add).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Fund Value"), { target: { value: "" } });
  expect(add).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Fund Value"), { target: { value } });
  fireEvent.click(add);
  await waitFor(() => expect(onQueued).toHaveBeenCalledOnce());
  expect(client.patch).not.toHaveBeenCalled();
});

it("keeps Add disabled while loading and after a load error", async () => {
  let fail!: (reason: Error) => void;
  const client = { model: vi.fn(() => new Promise<never>((_, reject) => { fail = reject; })), patch: vi.fn() };
  render(<AddFiscalPanel segment="funds" request={request} workerClient={client} onQueued={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Fund Name"), { target: { value: "Extra" } });
  fireEvent.change(screen.getByLabelText("Fund Value"), { target: { value: "2.50" } });
  expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  await act(async () => fail(new Error("Unavailable")));
  expect(screen.getByRole("alert")).toHaveTextContent("Unavailable");
  expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  expect(client.patch).not.toHaveBeenCalled();
});
