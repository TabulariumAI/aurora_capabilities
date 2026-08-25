import type { ManifestResult } from "../../../shared/type/capability.types";
import { capabilityFetch, parseCapabilityData, pollFromResponse } from "../../../shared/worker/capabilityHttp";

export async function statusManifest(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/manifest/${session}/status`, { method: "GET" }));
}

export async function submitManifest(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/manifest/${session}/report`, { method: "POST", body: {} }));
}

export async function dataManifest(apiBaseUrl: string, token: string, session: string): Promise<ManifestResult> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/manifest/${session}/data`, { method: "GET" });
  return parseCapabilityData(response.data) as ManifestResult;
}
