import type { ComputeWorkerClient, ComputeModelClient, ComputeRequest, WorkerConfig } from "../../../shared/type/capability.types";
import { dataCompute, statusCompute, submitCompute, requestComputeModel } from "./ComputeWorker";

export async function generateCompute(input: Pick<ComputeRequest, "authToken" | "session"> & { apiGatewayUrl: string }) {
  const response = await submitCompute(input.apiGatewayUrl, input.authToken, input.session, null, false);
  if (response.status === "error") throw { error: response.data };
  return response;
}

export function createComputeWorkerClient(config: WorkerConfig): ComputeWorkerClient & ComputeModelClient {
  return {
    model: (token, session) => requestComputeModel(config.apiBaseUrl, token, session),
    patch: (token, session, etag, patch) => requestComputeModel(config.apiBaseUrl, token, session, { etag, patch }),
    submit: (token, session, etag, refresh) => submitCompute(config.apiBaseUrl, token, session, etag, refresh),
    status: (token, session) => statusCompute(config.apiBaseUrl, token, session),
    data: (token, session) => dataCompute(config.apiBaseUrl, token, session),
  };
}
