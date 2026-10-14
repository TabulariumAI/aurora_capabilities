import type { RecordResult } from "../../../shared/type/capability.types";
import { capabilityFetch, parseCapabilityData, pollFromResponse } from "../../../shared/worker/capabilityHttp";

export async function statusRecord(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/record/${session}/status`, { method: "GET" }));
}

export async function submitRecord(apiBaseUrl: string, token: string, session: string) {
  return pollFromResponse(await capabilityFetch(token, `${apiBaseUrl}/v1/record/${session}/endorsement`, {
    method: "POST",
    body: {
      choices: {
        pdf_confirmation: true,
        pdf_record: true,
        tif_record: false,
      },
    },
  }));
}

export async function dataRecord(apiBaseUrl: string, token: string, session: string): Promise<RecordResult> {
  const response = await capabilityFetch(token, `${apiBaseUrl}/v1/record/${session}/data`, { method: "GET" });
  return parseCapabilityData(response.data) as RecordResult;
}
