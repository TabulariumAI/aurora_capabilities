import { getParcelOptions, type MetadataPayload } from "aurora-core";
import type { CompositionResult } from "../../../shared/type/capability.types";
import { blobJson, capabilityFetch, pollFromResponse } from "../../../shared/worker/capabilityHttp";

export async function submitComposition(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/composition/${session}/link`, { method: "POST" }));
}

export async function statusComposition(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/composition/${session}/status`, { method: "GET" }));
}

async function compositionData(apiBaseUrl: string, token: string, session: string): Promise<unknown> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/composition/${encodeURIComponent(session)}/data`, { method: "GET" });
  if (response.status !== "completed") {
    throw { code: "composition_not_completed", details: response, error: response.status };
  }
  if (typeof response.data !== "string" || !response.data) {
    throw { code: "parse_error", error: "Response data is not valid JSON." };
  }
  return blobJson(response.data);
}

export async function dataComposition(apiBaseUrl: string, token: string, session: string): Promise<CompositionResult> {
  const data = await compositionData(apiBaseUrl, token, session);
  if (!data || typeof data !== "object") {
    throw { code: "parse_error", error: "Response data is not valid JSON." };
  }
  return data as CompositionResult;
}

export async function optionsComposition(apiBaseUrl: string, token: string, session: string): Promise<string[]> {
  const data = await compositionData(apiBaseUrl, token, session);
  const metadata = data as MetadataPayload;
  if (!data || typeof data !== "object" || !Array.isArray(metadata.indexes)) {
    throw { code: "parse_error", error: "Response data is not valid JSON." };
  }
  const parcel = getParcelOptions(metadata.indexes);
  return [parcel.parcel_address, parcel.parcel_id]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .filter((value, index, values) => values.indexOf(value) === index);
}
