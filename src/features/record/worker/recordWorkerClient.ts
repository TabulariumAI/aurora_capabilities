import type { RecordWorkerClient, WorkerConfig } from "../../../shared/type/capability.types";
import { dataRecord, statusRecord, submitRecord } from "./RecordWorker";

export function createRecordWorkerClient(config: WorkerConfig): RecordWorkerClient {
  return {
    status: (token, session) => statusRecord(config.apiBaseUrl, token, session),
    submit: (token, session) => submitRecord(config.apiBaseUrl, token, session),
    data: (token, session) => dataRecord(config.apiBaseUrl, token, session),
  };
}
