import type { RedactWorkerClient, WorkerConfig } from "../../../shared/type/capability.types";
import { dataRedact, statusRedact, submitRedact } from "./RedactWorker";

export function createRedactWorkerClient(config: WorkerConfig): RedactWorkerClient {
  return {
    status: (token, session) => statusRedact(config.apiBaseUrl, token, session),
    submit: (token, session) => submitRedact(config.apiBaseUrl, token, session),
    data: (token, session) => dataRedact(config.apiBaseUrl, token, session),
  };
}
