import type { ComputeResult } from "../../../shared/type/capability.types";
import { blobJson, capabilityFetch, pollFromResponse } from "../../../shared/worker/capabilityHttp";

export async function submitCompute(apiBaseUrl: string, token: string, session: string, etag: string | null, refresh: boolean) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/compute/${session}/${refresh ? "recalculate" : "calculate"}`, { method: "POST", body: { etag } }));
}

export async function statusCompute(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/compute/${session}/status`, { method: "GET" }));
}

export async function dataCompute(apiBaseUrl: string, token: string, session: string): Promise<ComputeResult> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/compute/${session}/data`, { method: "GET" });
  if (response.status !== "completed") throw { code: "compute_not_completed", details: response, error: response.status };
  if (typeof response.data !== "string" || !response.data) throw { code: "parse_error", error: "Computedata path is missing." };
  const data = await blobJson(response.data);
  if (!data || typeof data !== "object") throw { code: "parse_error", error: "Computedata is not a valid object." };
  return data as ComputeResult;
}
