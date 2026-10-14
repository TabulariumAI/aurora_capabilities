import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  return <ComputeDetails data={result} onEndorse={vi.fn()} openSegment={openSegment} segments={segments} setOpenSegment={setOpenSegment} shortcuts={new Map([["fee", "f"], ["fund", "u"]])} />;
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

  it.each(["Fees", "Funds"])("confirms every %s header action without changing data or opening the section", (section) => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    render(<View />);
    const trigger = screen.getByRole("button", { name: section });
    const expanded = trigger.getAttribute("aria-expanded");
    for (const action of ["Reprocess", "Clear", "Add"]) {
      const button = screen.getByRole("button", { name: `${action} ${section}` });
      fireEvent.click(button);
      expect(alert).not.toHaveBeenCalled();
      expect(button).toHaveAttribute("data-armed", "true");
      expect(trigger).toHaveAttribute("aria-expanded", expanded);
      fireEvent.click(button);
      expect(alert).toHaveBeenCalledExactlyOnceWith(`${action} ${section}`);
      alert.mockClear();
      expect(trigger).toHaveAttribute("aria-expanded", expanded);
    }
    expect(screen.getByText("$26.00", { exact: true })).toBeVisible();
    expect(screen.getByText("$1,203.50", { exact: true })).toBeVisible();
    expect(data.fees).toHaveLength(2);
  });

  it.each([
    ["Fees", "Recording Fee", "$26.00", "26.0"],
    ["Fees", "Page Fee", "$1,203.50", "base + pages"],
    ["Funds", "Recording Fund", "$73.00", "remaining"],
  ])("confirms mutations and expands the formula for %s / %s", (section, name, amount, formula) => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    render(<View />);
    fireEvent.click(screen.getByRole("button", { name: section }));
    const row = screen.getByText(name, { exact: true }).closest("article")!;
    for (const action of ["Delete", "Edit"]) {
      const button = within(row).getByRole("button", { name: `${action} ${name}` });
      fireEvent.click(button);
      expect(alert).not.toHaveBeenCalled();
      expect(button).toHaveAttribute("aria-label", "Confirm");
      expect(button.querySelector("[data-confirm-progress='true']")).not.toBeNull();
      fireEvent.click(button);
      expect(alert).toHaveBeenCalledExactlyOnceWith(`${action} ${name}: ${amount}`);
      alert.mockClear();
      expect(row).toBeVisible();
      expect(row).toHaveTextContent(amount);
    }
    expect(row).not.toHaveTextContent("Formula:");
    expect(within(row).queryByRole("button", { name: `Formula ${name}` })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Expand details" }));
    expect(row).toHaveTextContent(`Formula: ${formula}`);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(alert).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole("button", { name: "Collapse details" }));
    expect(row).not.toHaveTextContent("Formula:");
  });

  it("expires confirmation after four seconds and never executes another action", () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    render(<View />);
    vi.useFakeTimers();
    const remove = screen.getByRole("button", { name: "Delete Recording Fee" });
    fireEvent.click(remove);
    act(() => vi.advanceTimersByTime(4_000));
    expect(remove).toHaveAttribute("aria-label", "Delete Recording Fee");
    expect(alert).not.toHaveBeenCalled();
    fireEvent.click(remove);
    fireEvent.click(screen.getByRole("button", { name: "Edit Recording Fee" }));
    expect(alert).not.toHaveBeenCalled();
    fireEvent.click(remove);
    expect(alert).toHaveBeenCalledExactlyOnceWith("Delete Recording Fee: $26.00");
  });

  it("orders copy, delete, edit, expand and preserves copy and explanations", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<View />);
    const row = screen.getByText("Recording Fee", { exact: true }).closest("article")!;
    expect(within(row).getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual(["Copy value $26.00", "Delete Recording Fee", "Edit Recording Fee", "Expand details"]);
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
