import type { RecordWorkerClient, WorkerConfig } from "../../../shared/type/capability.types";
import { dataRecord, statusRecord, submitRecord } from "./RecordWorker";

import { submitCompute, statusCompute } from "../../compute/worker/ComputeWorker";

export function createRecordWorkerClient(config: WorkerConfig): RecordWorkerClient {
  return {
    calculate: (token, session) => submitCompute(config.apiBaseUrl, token, session, null, true),
    computation: (token, session) => statusCompute(config.apiBaseUrl, token, session),
    status: (token, session) => statusRecord(config.apiBaseUrl, token, session),
    submit: (token, session) => submitRecord(config.apiBaseUrl, token, session),
    data: (token, session) => dataRecord(config.apiBaseUrl, token, session),
  };
}
