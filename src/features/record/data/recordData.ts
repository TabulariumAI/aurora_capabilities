import type { MetadataPayload } from "aurorra-index";
import type { RecordHeading, RecordResult } from "../../../shared/type/capability.types";

export function prepareRecordMetadata(metadata: MetadataPayload): MetadataPayload {
  if (!metadata || typeof metadata !== "object" || !metadata.heading || typeof metadata.heading !== "object") {
    throw { code: "INVALID_JSON_INPUT_HEAD", error: "Invalid JSON input: missing heading" };
  }
  const heading = metadata.heading as Record<string, unknown>;
  return {
    ...metadata,
    heading: {
      ...heading,
      number: Math.floor(10000 + Math.random() * 90000).toString(),
      date: new Date().toISOString().split("T")[0],
    } as MetadataPayload["heading"],
  };
}

export function validateRecordResult(data: unknown): RecordResult {
  if (!data || typeof data !== "object") {
    throw { code: "validation_error", error: "Validation failed: Record is not a valid object." };
  }
  const record = data as RecordResult;
  for (const key of ["heading", "cover", "document"] as const) {
    if (!(key in record)) {
      throw { code: "validation_error", error: `Validation failed: Missing required key: ${key}` };
    }
  }
  if (!record.heading || typeof record.heading !== "object" || !record.heading.title || !record.heading.class) {
    throw { code: "validation_error", error: "Validation failed: Invalid or missing 'heading' section." };
  }
  return record;
}

export function capitalizeFirst(value: unknown): string {
  const text = String(value ?? "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function getRecordSummaryItems(session: string, data: RecordResult, heading: RecordHeading): Array<[string, string]> {
  const items: Array<[string, string]> = [
    ["Class", capitalizeFirst(heading.class)],
    ["Title", String(heading.title ?? "")],
    ["Instrument #", String(heading.number ?? "")],
    ["Recorded on", String(heading.date ?? "")],
    ["Reference", session],
  ];
  if (Object.prototype.hasOwnProperty.call(heading, "total")) {
    items.push(["Total", heading.total == null ? "-" : `$${heading.total}`]);
  }
  if (data.status) items.push(["Status", data.status]);
  if (data.queueId) items.push(["Queue Id", data.queueId]);
  return items;
}
