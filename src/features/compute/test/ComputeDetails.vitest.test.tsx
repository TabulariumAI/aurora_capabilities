import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeQueueStore } from "../store/computeQueueStore";
import { ComputeDetails } from "../component/ComputeDetails";
import type { ComputeResult } from "../../../shared/type/capability.types";

const segments = { ACKNOWLEDGMENT: "acknowledgment", JUDGMENT: "judgment", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" };
const data: ComputeResult = {
  fee_factors: [{ amount: "15", explanation: "Counted pages.", name: "Total Pages" }, { amount: "5", name: "Total Parties" }],
  fees: [
    { amount: "26", code: "fee-1", explanation: "Recording charge.", formula: "26.0", name: "Recording Fee" },
    { amount: "$1,203.50", formula: "base + pages", name: "Page Fee" },
  ],
  funds: [{ amount: "73", formula: "remaining", name: "Recording Fund" }],
};

function View({ result = data }: { result?: ComputeResult }) {
  const [openSegment, setOpenSegment] = useState("fee");
  return <ComputeDetails session="session" data={result} onAddFee={vi.fn()} onAddFund={vi.fn()} onEndorse={vi.fn()} openSegment={openSegment} segments={segments} setOpenSegment={setOpenSegment} shortcuts={new Map([["fee", "f"], ["fund", "u"]])} />;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Compute details", () => {
  it("owns its UI without rendering metadata components", () => {
    const errors = vi.spyOn(console, "error");
    const { container } = render(<View />);
    expect(screen.getByRole("region", { name: "Compute" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Compute" })).toHaveStyle({ textAlign: "left" });
    expect(screen.getByRole("region", { name: "Compute accordion" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Metadata" })).toBeNull();
    expect(container.querySelector(".metadata-row")).toBeNull();
    expect(screen.getByRole("button", { name: "Factors" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Factors" })).toHaveStyle({ boxShadow: "none", borderRadius: "0" });
    expect(screen.queryByRole("button", { name: "Fee Factors" })).toBeNull();
    expect(errors.mock.calls.flat().join(" ")).not.toContain("same key");
  });

  it("removes refresh, clear and edit actions and opens Add Fee immediately", () => {
    const onAddFee = vi.fn();
    render(<ComputeDetails session="session" data={data} onAddFee={onAddFee} onAddFund={vi.fn()} onEndorse={vi.fn()} openSegment="fee" segments={segments} setOpenSegment={vi.fn()} shortcuts={new Map()} />);
    expect(screen.queryByRole("button", { name: /Reprocess Fees|Clear Fees|Reprocess Funds|Clear Funds|Edit / })).toBeNull();
    const button = screen.getByRole("button", { name: "Add Fees" });
    fireEvent.click(button);
    expect(onAddFee).toHaveBeenCalledExactlyOnceWith(button);
  });

  it.each([
    ["Fees", "Recording Fee", "$26.00", "26.0"],
    ["Fees", "Page Fee", "$1,203.50", "base + pages"],
    ["Funds", "Recording Fund", "$73.00", "remaining"],
  ])("confirms mutations and expands the formula for %s / %s", (section, name, amount, formula) => {
    const enqueue = vi.spyOn(computeQueueStore.getState(), "enqueue").mockResolvedValue(undefined);
    render(<View />);
    fireEvent.click(screen.getByRole("button", { name: section }));
    const row = screen.getByText(name, { exact: true }).closest("article")!;
    for (const action of ["Delete"]) {
      const button = within(row).getByRole("button", { name: `${action} ${name}` });
      fireEvent.click(button);
      expect(enqueue).not.toHaveBeenCalled();
      expect(button).toHaveAttribute("aria-label", "Confirm");
      expect(button.querySelector("[data-confirm-progress='true']")).not.toBeNull();
      fireEvent.click(button);
      expect(enqueue).toHaveBeenCalledExactlyOnceWith("session", { action: "remove", segment: section === "Fees" ? "fees" : "funds", item: expect.objectContaining({ name, formula }) });
      enqueue.mockClear();
      expect(row).toBeVisible();
      expect(row).toHaveTextContent(amount);
    }
    expect(row).not.toHaveTextContent("Formula:");
    expect(within(row).queryByRole("button", { name: `Formula ${name}` })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Expand details" }));
    expect(row).toHaveTextContent(`Formula: ${formula}`);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(enqueue).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole("button", { name: "Collapse details" }));
    expect(row).not.toHaveTextContent("Formula:");
  });

  it("expires confirmation after four seconds and never executes another action", () => {
    const enqueue = vi.spyOn(computeQueueStore.getState(), "enqueue").mockResolvedValue(undefined);
    render(<View />);
    vi.useFakeTimers();
    const remove = screen.getByRole("button", { name: "Delete Recording Fee" });
    fireEvent.click(remove);
    act(() => vi.advanceTimersByTime(4_000));
    expect(remove).toHaveAttribute("aria-label", "Delete Recording Fee");
    expect(enqueue).not.toHaveBeenCalled();
    fireEvent.click(remove);
    fireEvent.click(within(remove.closest("article")!).getByRole("button", { name: "Expand details" }));
    expect(enqueue).not.toHaveBeenCalled();
    fireEvent.click(remove);
    expect(enqueue).toHaveBeenCalledExactlyOnceWith("session", { action: "remove", segment: "fees", item: data.fees![0] });
  });

  it("orders copy, delete, expand and preserves copy and explanations", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<View />);
    const row = screen.getByText("Recording Fee", { exact: true }).closest("article")!;
    expect(within(row).getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual(["Copy value $26.00", "Delete Recording Fee", "Expand details"]);
    fireEvent.click(within(row).getByRole("button", { name: "Copy value $26.00" }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith("$26.00");
    expect(within(row).queryByText("Recording charge.", { exact: true })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Expand details" }));
    expect(row).toHaveTextContent("Explanation: Recording charge.");
    expect(row).toHaveTextContent("Formula: 26.0");
    fireEvent.click(within(row).getByRole("button", { name: "Collapse details" }));
    expect(within(row).queryByText("Recording charge.", { exact: true })).toBeNull();
    vi.unstubAllGlobals();
  });

  it("right-aligns factor and currency values and limits new controls to Fees and Funds", () => {
    render(<View />);
    expect(screen.getByText("$26.00", { exact: true })).toHaveStyle({ textAlign: "right", fontVariantNumeric: "tabular-nums" });
    fireEvent.click(screen.getByRole("button", { name: "Factors" }));
    for (const value of ["15", "5"]) expect(screen.getByText(value, { exact: true })).toHaveStyle({ textAlign: "right" });
    const row = screen.getByText("Total Pages", { exact: true }).closest("article")!;
    expect(within(row).getByRole("button", { name: "Copy value 15" })).toBeVisible();
    expect(within(row).getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual(["Copy value 15", "Expand details"]);
    expect(within(row).getByRole("group")).toHaveStyle({ width: "4.125rem" });
    expect(within(row).queryByRole("button", { name: /Delete|Edit|Formula/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reprocess Factors|Clear Factors|Add Factors/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Funds" }));
    expect(screen.getByText("$73.00", { exact: true })).toHaveStyle({ textAlign: "right" });
  });

  it("retains zero filtering, explained zero rows, and empty section actions", () => {
    render(<View result={{ fee_factors: [], fees: [{ amount: "0", formula: "0", name: "Hidden fee" }, { amount: "0", explanation: "Exempt.", formula: "0", name: "Exempt fee" }], funds: [] }} />);
    expect(screen.queryByText("Hidden fee")).toBeNull();
    expect(screen.getByText("Exempt fee")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Factors" }));
    expect(screen.getByText("No fee factors found.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Funds" }));
    expect(screen.getByText("No fund distributions found.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add Funds" })).toBeVisible();
  });

  it("preserves ambiguity status and section shortcut markings", () => {
    render(<View result={{ fee_factors: [{ amount: "26", ambiguous: "YES", name: "Recording Factor" }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Factors" }));
    expect(screen.getByText("Recording Factor").closest("article")).toHaveAttribute("data-status", "warning");
    expect(screen.getByRole("button", { name: "Fees" }).querySelector("u")).toHaveTextContent("F");
    expect(screen.getByRole("button", { name: "Funds" }).querySelector("u")).toHaveTextContent("u");
  });
});

it("shows draft status and Save failure, and blocks Endorse until Save or Cancel", () => {
  computeQueueStore.getState().reset();
  computeQueueStore.setState({ tasks: [{ id: "queued", session: "session", change: { action: "add", fee: { name: "Extra", value: "1.00" } }, status: "failed", error: "Unavailable", patch: [] }] });
  const save = vi.spyOn(computeQueueStore.getState(), "save").mockResolvedValue(undefined);
  const discard = vi.spyOn(computeQueueStore.getState(), "discard").mockResolvedValue(undefined);
  render(<View result={{ ...data, fees: [{ code: "queued:fees", name: "Extra", amount: "1.00", formula: "1.00" }, ...data.fees!] }} />);
  expect(screen.getByText("Added")).toBeVisible();
  expect(screen.getByRole("alert", { name: "Save failed" })).toHaveTextContent("Unavailable");
  expect(screen.getByRole("button", { name: "Endorse" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith("session");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(discard).toHaveBeenCalledWith("session");
  computeQueueStore.getState().reset();
});

it("opens Add Fund and moves funds with shared boundary controls while preserving disclosures", () => {
  computeQueueStore.getState().reset();
  const onAddFund = vi.fn();
  const enqueue = vi.spyOn(computeQueueStore.getState(), "enqueue").mockResolvedValue(undefined);
  const first = { code: "one", name: "First Fund", amount: "1.00", formula: "1.00" };
  const last = { code: "two", name: "Last Fund", amount: "2.00", formula: "total_amount" };
  const props = { session: "session", data: { funds: [first, last] }, onAddFee: vi.fn(), onAddFund, onEndorse: vi.fn(), openSegment: "fund", segments, setOpenSegment: vi.fn(), shortcuts: new Map<string, string>() };
  const view = render(<ComputeDetails {...props} />);
  const add = screen.getByRole("button", { name: "Add Funds" });
  fireEvent.click(add);
  expect(onAddFund).toHaveBeenCalledExactlyOnceWith(add);
  expect(screen.getByRole("button", { name: "Move First Fund up" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Move Last Fund down" })).toBeDisabled();
  const down = screen.getByRole("button", { name: "Move First Fund down" });
  down.focus();
  fireEvent.click(down);
  expect(enqueue).toHaveBeenCalledExactlyOnceWith("session", { action: "move", segment: "funds", item: first, target: last });
  fireEvent.click(within(screen.getByText("First Fund").closest("article")!).getByRole("button", { name: "Expand details" }));
  view.rerender(<ComputeDetails {...props} data={{ funds: [last, first] }} />);
  expect(screen.getByText("First Fund").closest("article")).toHaveTextContent("Formula: 1.00");
  expect(screen.getByText("Last Fund").closest("article")).not.toHaveTextContent("Formula:");
  expect(screen.getByRole("button", { name: "Move First Fund down" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Move First Fund up" }));
  expect(enqueue).toHaveBeenLastCalledWith("session", { action: "move", segment: "funds", item: first, target: last });
});


it("disables all mutation controls while Save is processing", () => {
  computeQueueStore.getState().reset();
  computeQueueStore.setState({ tasks: [{ id: "saving", session: "session", change: { action: "add", fee: { name: "Extra", value: "1.00" } }, status: "processing", error: null, patch: [] }] });
  render(<View />);
  expect(screen.getByRole("button", { name: "Add Fees" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  computeQueueStore.getState().reset();
});

it("keeps the Added marker during local fund moves", () => {
  computeQueueStore.getState().reset();
  const item = { code: "add:funds", name: "Extra", amount: "1.00", formula: "1.00" };
  const target = { code: "other", name: "Other", amount: "2.00", formula: "2.00" };
  computeQueueStore.setState({ tasks: [
    { id: "add", session: "session", change: { action: "add", fund: { name: "Extra", value: "1.00" } }, status: "queued", error: null, patch: [] },
    { id: "move", session: "session", change: { action: "move", segment: "funds", item, target }, status: "queued", error: null, patch: [] },
  ] });
  render(<ComputeDetails session="session" data={{ funds: [target, item] }} onAddFee={vi.fn()} onAddFund={vi.fn()} onEndorse={vi.fn()} openSegment="fund" segments={segments} setOpenSegment={vi.fn()} shortcuts={new Map()} />);
  expect(screen.getByText("Extra").closest("article")).toHaveTextContent("Added");
  computeQueueStore.getState().reset();
});


it("drags funds through the existing move queue without enabling fee dragging", () => {
  computeQueueStore.getState().reset();
  const enqueue = vi.spyOn(computeQueueStore.getState(), "enqueue").mockResolvedValue(undefined).mockClear();
  const funds = ["First", "Middle", "Last"].map(name => ({ code: name, name, amount: "1.00", formula: "1.00" }));
  render(<View result={{ ...data, funds }} />);
  expect(screen.queryByRole("button", { name: /^Drag / })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Funds" }));
  const handle = screen.getByRole("button", { name: "Drag First to reorder" });
  const target = screen.getByText("Last", { exact: true }).closest("article")!;
  const dataTransfer = { setData: vi.fn(), effectAllowed: "none", dropEffect: "none" };
  fireEvent.dragStart(handle, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  expect(target).toHaveAttribute("data-drop", "after");
  fireEvent.drop(target, { dataTransfer });
  expect(enqueue).toHaveBeenCalledExactlyOnceWith("session", { action: "move", segment: "funds", item: funds[0], target: funds[2] });
});
