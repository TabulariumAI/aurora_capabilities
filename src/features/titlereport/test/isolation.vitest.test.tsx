import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChainPanel } from "../component/ChainPanel";
import { prepareTitleReport } from "../data/titleReportData";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it.each([["records", "Records in Chain"], ["summary", "Chain Summary"], ["conveyances", "Conveyance"], ["mortgages", "Mortgage"], ["encumbrances", "Encumbrance"], ["issues", "Title issues"], ["completeness", "Chain status"]])("isolates invalid chain %s and preserves other sections", (field, label) => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const chain = prepareTitleReport([{ title: "Main chain", explanation: "Healthy summary", root_of_title_ref: "Healthy root" }], "Batch").chains[0];
  render(<ChainPanel chain={{ ...chain, [field]: null }} first multiple={false} onSession={vi.fn()} />);
  expect(screen.getByRole("button", { name: `${label} error` })).toBeVisible();
  if (field !== "issues" && field !== "completeness") expect(screen.getByText(label, { exact: true })).toBeVisible();
  expect(screen.getByText("Healthy root")).toBeVisible();
});
