import { getParcelOptions, type MetadataPayload } from "aurorra-index";
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

export async function optionsComposition(apiBaseUrl: string, token: string, session: string): Promise<string[]> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/index/${encodeURIComponent(session)}/data`, { method: "GET" });
  const parsed = parseCapabilityData(response.data);
  const metadata = parsed as MetadataPayload;
  if (parsed === "" || !parsed || typeof parsed !== "object" || !Array.isArray(metadata.indexes)) {
    throw { code: "parse_error", error: "Response data is not valid JSON." };
  }
  const parcel = getParcelOptions(metadata.indexes);
  return [parcel.parcel_address, parcel.parcel_id]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .filter((value, index, values) => values.indexOf(value) === index);
}
