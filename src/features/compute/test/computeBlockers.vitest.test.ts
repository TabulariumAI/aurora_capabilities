import { afterEach, expect, it, vi } from "vitest";
import { getBlockers } from "../data/computeBlockers";
import { computeQueueStore } from "../store/computeQueueStore";

const discard = computeQueueStore.getState().discard;
afterEach(() => { vi.restoreAllMocks(); computeQueueStore.getState().reset(); computeQueueStore.setState({ discard }); });
it("collects compute sessions once and keeps their edits across session switches", async () => {
  const discard = vi.spyOn(computeQueueStore.getState(), "discard").mockImplementation(async session => { computeQueueStore.setState(state => ({ tasks: state.tasks.filter(task => task.session !== session) })); });
  computeQueueStore.setState({ tasks: ["one", "two"].map(id => ({ id, session: "session", status: "queued", error: null, patch: [],
    change: { action: "add" as const, fee: { name: "Recording", value: "10" } } })) });
  expect(getBlockers("session")).toEqual([]);
  const blockers = getBlockers("logout");
  expect(blockers).toHaveLength(1);
  expect(blockers[0].items.join(" ")).toContain("session");
  await blockers[0].cancel();
  expect(discard).toHaveBeenCalledExactlyOnceWith("session");
});

it("rejects cancellation when a compute queue write fails to remove the changes", async () => {
  vi.spyOn(computeQueueStore.getState(), "discard").mockResolvedValue();
  computeQueueStore.setState({ tasks: [{ id: "one", session: "session", status: "queued", error: null, patch: [],
    change: { action: "add", fee: { name: "Recording", value: "10" } } }] });
  await expect(getBlockers("logout")[0].cancel()).rejects.toThrow("The queued fees and funds changes could not be canceled.");
});
