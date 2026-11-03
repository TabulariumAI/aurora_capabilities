import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { indexSegments } from "aurora-core";
import { ComputeDetails } from "../component/ComputeDetails";
import type { ComputeResult } from "../../../shared/type/capability.types";
import { computeQueueStore } from "../store/computeQueueStore";

afterEach(() => { cleanup(); vi.restoreAllMocks(); computeQueueStore.setState({ tasks: [] }); });
it("retains the mutation lock in a failed section while Save is processing", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  computeQueueStore.setState({ tasks: [{ id: "task", session: "session", status: "processing", error: null, patch: [], change: { action: "remove", segment: "fees", item: { name: "Fee", amount: "1", formula: "1" } } }] });
  render(<ComputeDetails data={{ fees: {} } as unknown as ComputeResult} session="session" onAddFee={vi.fn()} onAddFund={vi.fn()} onEndorse={vi.fn()}
    openSegment="fee" segments={{ ...indexSegments, TITLE: "title", FEE: "fee", FUND: "fund", FEEFACTOR: "factor" }} setOpenSegment={vi.fn()} shortcuts={new Map()} />);
  expect(screen.getByRole("button", { name: "Fees error" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Add Fees" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Add Funds" })).toBeDisabled();
});
it.each([["fee_factors", "Factors"], ["fees", "Fees"], ["funds", "Funds"]])("isolates invalid %s and retains the other fiscal sections", (field, title) => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const data = { fee_factors: [], fees: [], funds: [], [field]: {} } as unknown as ComputeResult;
  render(<ComputeDetails data={data} session="session" onAddFee={vi.fn()} onAddFund={vi.fn()} onEndorse={vi.fn()}
    openSegment="fee" segments={{ ...indexSegments, TITLE: "title", FEE: "fee", FUND: "fund", FEEFACTOR: "factor" }} setOpenSegment={vi.fn()} shortcuts={new Map()} />);
  expect(screen.getByRole("button", { name: `${title} error` })).toBeVisible();
  for (const other of ["Factors", "Fees", "Funds"].filter(value => value !== title)) expect(screen.getByRole("button", { name: other })).toBeEnabled();
  if (field !== "fee_factors") {
    expect(screen.getByRole("button", { name: "Total fees error" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Endorse" })).toBeDisabled();
  }
});
