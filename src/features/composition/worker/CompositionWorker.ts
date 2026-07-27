import type { CompositionResult } from "../../../shared/type/capability.types";
import { capabilityFetch, parseCapabilityData, pollFromResponse } from "../../../shared/worker/capabilityHttp";

export async function submitComposition(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/composition/${session}/link`, { method: "POST" }));
}

export async function statusComposition(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/composition/${session}/status`, { method: "GET" }));
}

export async function dataComposition(apiBaseUrl: string, token: string, session: string): Promise<CompositionResult> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/composition/${session}/data`, { method: "GET" });
  const parsed = parseCapabilityData(response.data);
  if (parsed === "" || !parsed || typeof parsed !== "object") {
    throw { code: "parse_error", error: "Response data is not valid JSON." };
  }
  return parsed as CompositionResult;
}
