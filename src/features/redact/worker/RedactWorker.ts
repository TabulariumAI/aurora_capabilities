import type { RedactResult } from "../../../shared/type/capability.types";
import { capabilityFetch, parseCapabilityData, pollFromResponse } from "../../../shared/worker/capabilityHttp";

function validateRedact(data: unknown): RedactResult {
  if (!data || typeof data !== "object" || typeof (data as RedactResult).pdf !== "string" || !(data as RedactResult).pdf) {
    throw { code: "RETRIEVE_METADATA_FAILED", error: "Retrieve metadata failed." };
  }
  return data as RedactResult;
}

export async function statusRedact(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/redact/${session}/status`, { method: "GET" }));
}

export async function submitRedact(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/redact/${session}/mask`, { method: "POST", body: { data: null } }));
}

export async function dataRedact(apiBaseUrl: string, token: string, session: string): Promise<RedactResult> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/redact/${session}/data`, { method: "GET" });
  return validateRedact(parseCapabilityData(response.data));
}
