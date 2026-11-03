import type { ExitBlocker, ExitReason } from "aurora-core";
import { computeQueueStore } from "../store/computeQueueStore";

export function getBlockers(reason: ExitReason): ExitBlocker[] {
  const tasks = computeQueueStore.getState().tasks;
  const sessions = [...new Set(tasks.filter(task => task.status !== "processing").map(task => task.session))]
    .filter(session => !tasks.some(task => task.session === session && task.status === "processing"));
  if (reason !== "logout" || !sessions.length) return [];
  return [{ id: "compute", title: "Fees and funds changes", items: sessions,
    async cancel() {
      for (const session of sessions) {
        await computeQueueStore.getState().discard(session);
        if (computeQueueStore.getState().tasks.some(task => task.session === session && task.status !== "processing")) {
          throw new Error("The queued fees and funds changes could not be canceled.");
        }
      }
    } }];
}
