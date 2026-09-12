import type { MetadataPayload } from "aurora-core";

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
