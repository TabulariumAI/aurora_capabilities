import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CompositionView } from "../component/CompositionView";
import type { CompositionResult } from "../../../shared/type/capability.types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("prepares each history collection once and restores rows after a source refresh", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const conveyance = [{ grantees: "Healthy grantee" }];
  const mapping = vi.spyOn(conveyance, "map");
  const props = { callbacks: {}, canLink: true, onError: vi.fn(), onLinkBatch: vi.fn(), onViewBatch: vi.fn(), openSegment: "history", requestId: "request", session: "session",
    setOpenSegment: vi.fn(), shortcuts: new Map(), token: "token", workerClient: { options: () => new Promise<string[]>(() => undefined) } as never };
  const view = render(<CompositionView {...props} metadata={{ chain: [], history: { conveyance: {} } } as unknown as CompositionResult} />);
  expect(screen.getByRole("button", { name: "History error" })).toBeVisible();
  const stage = screen.getByRole("button", { name: "Stage" });
  view.rerender(<CompositionView {...props} metadata={{ chain: [], history: { conveyance } }} />);
  expect(screen.queryByRole("button", { name: "History error" })).toBeNull();
  expect(screen.getByText("Healthy grantee")).toBeVisible();
  expect(mapping).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Stage" })).toBe(stage);
});
it.each([["Chain", { chain: {} }], ["History", { history: { conveyance: {} } }]])("isolates invalid %s processing", (title, invalid) => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(<CompositionView metadata={{ chain: [], history: {}, ...invalid } as unknown as CompositionResult}
    callbacks={{}} canLink onError={vi.fn()} onLinkBatch={vi.fn()} onViewBatch={vi.fn()} openSegment="chain" requestId="request" session="session"
    setOpenSegment={vi.fn()} shortcuts={new Map()} token="token" workerClient={{ options: async () => [] } as never} />);
  expect(screen.getByRole("button", { name: `${title} error` })).toBeVisible();
  expect(screen.getByRole("button", { name: title === "Chain" ? "History" : "Chain" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Stage" })).toBeVisible();
});
