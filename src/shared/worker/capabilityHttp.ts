import type { CapabilityError, CapabilityPoll } from "../type/capability.types";

type RawResponse = {
  model?: unknown;
  etag?: string;
  code?: string;
  data?: unknown;
  error?: string;
  message?: string;
  status?: unknown;
  success?: boolean;
};

export function parseCapabilityData(data: unknown): unknown {
  if (typeof data !== "string") return data;
  if (data === "") return "";
  try {
    return JSON.parse(data);
  } catch {
    throw {
      code: "parse_error",
      error: "Response data is not valid JSON.",
      details: { data },
    } satisfies CapabilityError;
  }
}

function toError(response: Response, data: RawResponse): CapabilityError {
  return {
    code: data.code ?? (response.status === 401 ? "unauthorized" : "server_error"),
    details: data,
    error: data.error ?? data.message ?? response.statusText,
    status: response.status,
  };
}

export async function capabilityFetch(
  token: string,
  url: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: unknown; headers?: Record<string, string> },
): Promise<RawResponse> {
  const response = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    body: init.body === undefined || init.body === null ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const raw = await response.text();
  let payload: RawResponse = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as RawResponse;
    } catch {
      throw {
        code: "parse_error",
        details: { body: raw },
        error: "Response body is not valid JSON.",
        status: response.status,
      } satisfies CapabilityError;
    }
  }
  if (!response.ok || payload.success === false) throw toError(response, payload);
  const etag = response.headers.get("ETag");
  if (etag) payload.etag = etag;
  return payload;
}

export async function blobJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw {
      code: "server_error",
      error: `HTTP ${response.status} ${response.statusText}`,
      status: response.status,
    } satisfies CapabilityError;
  }
  try {
    return await response.json();
  } catch {
    throw {
      code: "parse_error",
      error: "Azure Blob response is not valid JSON.",
      status: response.status,
    } satisfies CapabilityError;
  }
}

export function pollFromResponse(response: RawResponse): CapabilityPoll {
  return {
    data: response.data,
    status: response.status,
  };
}

export function workerError(error: unknown, defaultMessage: string): CapabilityError {
  const candidate = error as CapabilityError & { message?: string };
  return {
    code: candidate?.code,
    details: candidate?.details,
    error: candidate?.error ?? candidate?.message ?? defaultMessage,
    status: candidate?.status,
  };
}


export async function* pollSteps(intervalMs: number, steps: number) {
  const stepMs = 7500;
  const started = Date.now();
  const deadline = started + steps * stepMs;
  for (let check = 0; check < steps * 15 && Date.now() < deadline; check++) {
    await new Promise<void>(resolve => setTimeout(resolve, Math.min(intervalMs, deadline - Date.now())));
    yield Math.min(steps - 1, Math.max(0, Math.ceil((Date.now() - started) / stepMs) - 1));
  }
}
