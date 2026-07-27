import type { RecordWorkerClient, WorkerConfig } from "../../../shared/type/capability.types";
import { computeDataRecord, dataRecord, statusRecord, submitRecord } from "./RecordWorker";

export function createRecordWorkerClient(config: WorkerConfig): RecordWorkerClient {
  return {
    status: (token, session) => statusRecord(config.apiBaseUrl, token, session),
    computeData: (token, session) => computeDataRecord(config.apiBaseUrl, token, session),
    submit: (token, session, metadata) => submitRecord(config.apiBaseUrl, token, session, metadata),
    data: (token, session) => dataRecord(config.apiBaseUrl, token, session),
  };
}
