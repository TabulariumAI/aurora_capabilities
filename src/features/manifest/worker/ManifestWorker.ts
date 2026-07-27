import type { ManifestResult } from "../../../shared/type/capability.types";
import { capabilityFetch, parseCapabilityData, pollFromResponse } from "../../../shared/worker/capabilityHttp";

function validateManifest(data: unknown): ManifestResult {
  if (!data || typeof data !== "object" || typeof (data as ManifestResult).pdf !== "string" || !(data as ManifestResult).pdf) {
    throw { error: "Manifest PDF is not available." };
  }
  return data as ManifestResult;
}

export async function statusManifest(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/manifest/${session}/status`, { method: "GET" }));
}

export async function submitManifest(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/manifest/${session}/report`, { method: "POST", body: {} }));
}

export async function dataManifest(apiBaseUrl: string, token: string, session: string): Promise<ManifestResult> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/manifest/${session}/data`, { method: "GET" });
  return validateManifest(parseCapabilityData(response.data));
}
