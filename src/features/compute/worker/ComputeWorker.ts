import type { ComputeData, ComputeResult, ComputeModel } from "../../../shared/type/capability.types";
import { blobJson, capabilityFetch, pollFromResponse } from "../../../shared/worker/capabilityHttp";

export async function requestComputeModel(apiBaseUrl: string, token: string, session: string, update?: { etag: string; patch: unknown }) {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/compute/${session}/model`, update ? { method: "PATCH", body: update.patch, headers: { "If-Match": update.etag, "Content-Type": "application/json-patch+json" } } : { method: "GET" });
  if (!response.etag || !response.model || typeof response.model !== "object") throw { code: "parse_error", error: "Compute model or ETag is missing." };
  return { model: response.model as ComputeModel, etag: response.etag };
}

export async function submitCompute(apiBaseUrl: string, token: string, session: string, etag: string | null, refresh: boolean) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/compute/${session}/${refresh ? "recalculate" : "calculate"}`, { method: "POST", body: refresh ? {} : { etag } }));
}

export async function statusCompute(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/compute/${session}/status`, { method: "GET" }));
}

export async function dataCompute(apiBaseUrl: string, token: string, session: string): Promise<ComputeData> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/compute/${session}/data`, { method: "GET" });
  if (response.status !== "completed") throw { code: "compute_not_completed", details: response, error: response.status };
  if (typeof response.data !== "string" || !response.data) throw { code: "parse_error", error: "Computedata path is missing." };
  if (typeof response.metadata_etag !== "string") throw { code: "parse_error", error: "Compute metadata ETag is missing." };
  const data = await blobJson(response.data);
  if (!data || typeof data !== "object") throw { code: "parse_error", error: "Computedata is not a valid object." };
  return { result: data as ComputeResult, metadataEtag: response.metadata_etag };
}
