import type { ManifestWorkerClient, WorkerConfig } from "../../../shared/type/capability.types";
import { dataManifest, statusManifest, submitManifest } from "./ManifestWorker";

export function createManifestWorkerClient(config: WorkerConfig): ManifestWorkerClient {
  return {
    status: (token, session) => statusManifest(config.apiBaseUrl, token, session),
    submit: (token, session, options) => submitManifest(config.apiBaseUrl, token, session, options),
    data: (token, session) => dataManifest(config.apiBaseUrl, token, session),
  };
}
