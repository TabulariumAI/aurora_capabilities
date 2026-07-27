import type { CompositionWorkerClient, WorkerConfig } from "../../../shared/type/capability.types";
import { dataComposition, statusComposition, submitComposition } from "./CompositionWorker";

export function createCompositionWorkerClient(config: WorkerConfig): CompositionWorkerClient {
  return {
    submit: (token, session) => submitComposition(config.apiBaseUrl, token, session),
    status: (token, session) => statusComposition(config.apiBaseUrl, token, session),
    data: (token, session) => dataComposition(config.apiBaseUrl, token, session),
  };
}
