import type { RedactResult } from "../../../shared/type/capability.types";
import { capabilityFetch, parseCapabilityData, pollFromResponse } from "../../../shared/worker/capabilityHttp";

export async function statusRedact(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/redact/${session}/status`, { method: "GET" }));
}

export async function submitRedact(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/redact/${session}/mask`, { method: "POST", body: { data: null } }));
}

export async function dataRedact(apiBaseUrl: string, token: string, session: string): Promise<RedactResult> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/redact/${session}/data`, { method: "GET" });
  return parseCapabilityData(response.data) as RedactResult;
}
