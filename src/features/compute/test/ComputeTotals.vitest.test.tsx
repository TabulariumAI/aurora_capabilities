import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ComputeDetails } from "../component/ComputeDetails";
import type { ComputeResult } from "../../../shared/type/capability.types";

const segments = { ACKNOWLEDGMENT: "acknowledgment", JUDGMENT: "judgment", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" };

function View({ data }: { data: ComputeResult }) {
  const [openSegment, setOpenSegment] = useState<string | null>(null);
  return <ComputeDetails session="totals-session" onAddFee={() => undefined} onAddFund={() => undefined} data={data} onEndorse={() => undefined} openSegment={openSegment} segments={segments} setOpenSegment={setOpenSegment} shortcuts={new Map()} />;
}

afterEach(cleanup);

describe("Compute totals", () => {
  it("sums fees rather than factors and stays visible outside the accordions", () => {
    render(<View data={{ fee_factors: [{ amount: "999", name: "Total Amount" }], fees: [{ amount: "26", formula: "26", name: "Recording" }, { amount: "3", formula: "3", name: "Party" }, { amount: "52", formula: "52", name: "Page" }, { amount: "10", formula: "10", name: "Reference" }], funds: [{ amount: "91", formula: "91", name: "Distribution" }] }} />);
    const total = screen.getByRole("group", { name: "Compute total" });
    expect(within(total).getByText("Total", { exact: true })).toBeVisible();
    expect(within(total).getByText("$91.00", { exact: true })).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
    for (const section of ["Factors", "Fees", "Funds"]) {
      fireEvent.click(screen.getByRole("button", { name: section }));
      expect(total).toBeVisible();
      expect(total).toHaveTextContent("$91.00");
    }
    expect(total.closest("[data-state]")).toBeNull();
    expect(screen.getByRole("button", { name: "Endorse" })).toBeVisible();
  });

  it("shows both totals in an error below the total row when they differ", () => {
    render(<View data={{ fees: [{ amount: "91", formula: "91", name: "Fees" }], funds: [{ amount: "40", formula: "40", name: "Housing" }, { amount: "50", formula: "50", name: "Recording" }] }} />);
    const total = screen.getByRole("group", { name: "Compute total" });
    const error = screen.getByRole("alert");
    expect(within(total).getByText("$91.00", { exact: true })).toBeVisible();
    expect(error).toHaveTextContent("Fees ($91.00) and Funds ($90.00) do not match.");
    expect(error).toHaveStyle({ textAlign: "center", alignSelf: "center" });
    expect(total.nextElementSibling).toBe(error);
  });

  it.each([
    [["0.10", "0.20"], ["0.30"], "$0.30"],
    [["$1,203.50", "26"], ["1,000", "229.50"], "$1,229.50"],
    [["100", "-9", "0"], ["91"], "$91.00"],
    [[], [], "$0.00"],
  ])("compares monetary totals accurately for %j and %j", (fees, funds, total) => {
    render(<View data={{ fees: fees.map((amount, index) => ({ amount, formula: amount, name: `Fee ${index}` })), funds: funds.map((amount, index) => ({ amount, formula: amount, name: `Fund ${index}` })) }} />);
    expect(screen.getByRole("group", { name: "Compute total" })).toHaveTextContent(total);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("updates totals and clears a mismatch when new data arrives", () => {
    const fees = [{ amount: "91", formula: "91", name: "Recording" }];
    const view = render(<View data={{ fees, funds: [] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Funds ($0.00)");
    view.rerender(<View data={{ fees, funds: [{ amount: "91", formula: "91", name: "Distribution" }] }} />);
    expect(screen.queryByRole("alert")).toBeNull();
    view.rerender(<View data={{ fees: [{ amount: "100", formula: "100", name: "Recording" }], funds: [{ amount: "100", formula: "100", name: "Distribution" }] }} />);
    expect(screen.getByRole("group", { name: "Compute total" })).toHaveTextContent("$100.00");
  });
});
