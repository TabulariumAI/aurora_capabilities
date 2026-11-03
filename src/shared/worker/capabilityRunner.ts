import type { ProgressJob } from "aurora-core";
import type { CapabilityRequest } from "../type/capability.types";
import { useCapabilityDataStore } from "./capabilityData";

type RunContext = {
  isActive(): boolean;
  onProgress(event: ProgressJob): void;
  finish(outcome: "completed" | "failed"): void;
};

export function runCapabilityJob(request: CapabilityRequest, execute: (context: RunContext) => Promise<void>): void {
  const token = useCapabilityDataStore.getState().beginRun(request);
  if (token === null) return;
  void execute({
    isActive: () => useCapabilityDataStore.getState().runs.get(request.requestId)?.token === token,
    onProgress: event => useCapabilityDataStore.getState().progressRun(request.requestId, token, event),
    finish: outcome => useCapabilityDataStore.getState().finishRun(request.requestId, token, outcome),
  });
}
