import type { ComputeResult } from "../../../shared/type/capability.types";
import { capabilityFetch, parseCapabilityData, pollFromResponse } from "../../../shared/worker/capabilityHttp";

export async function submitCompute(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/compute/${session}/calculate`, { method: "POST" }));
}

export async function statusCompute(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/compute/${session}/status`, { method: "GET" }));
}

export async function dataCompute(apiBaseUrl: string, token: string, session: string): Promise<ComputeResult> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/compute/${session}/data`, { method: "GET" });
  return parseCapabilityData(response.data) as ComputeResult;
}
