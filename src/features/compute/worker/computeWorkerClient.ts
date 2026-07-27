import type { ComputeWorkerClient, WorkerConfig } from "../../../shared/type/capability.types";
import { dataCompute, statusCompute, submitCompute } from "./ComputeWorker";

export function createComputeWorkerClient(config: WorkerConfig): ComputeWorkerClient {
  return {
    submit: (token, session) => submitCompute(config.apiBaseUrl, token, session),
    status: (token, session) => statusCompute(config.apiBaseUrl, token, session),
    data: (token, session) => dataCompute(config.apiBaseUrl, token, session),
  };
}
