import type { ComputeWorkerClient, ComputeModelClient, WorkerConfig } from "../../../shared/type/capability.types";
import { dataCompute, statusCompute, submitCompute, requestComputeModel } from "./ComputeWorker";

export function createComputeWorkerClient(config: WorkerConfig): ComputeWorkerClient & ComputeModelClient {
  return {
    model: (token, session) => requestComputeModel(config.apiBaseUrl, token, session),
    patch: (token, session, etag, patch) => requestComputeModel(config.apiBaseUrl, token, session, { etag, patch }),
    submit: (token, session, etag, refresh) => submitCompute(config.apiBaseUrl, token, session, etag, refresh),
    status: (token, session) => statusCompute(config.apiBaseUrl, token, session),
    data: (token, session) => dataCompute(config.apiBaseUrl, token, session),
  };
}
