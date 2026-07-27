import { describe, expect, it, vi } from "vitest";
import { getRecordSummaryItems, prepareRecordMetadata, validateRecordResult } from "../data/recordData";

describe("record data", () => {
  it("prepares heading and validates required result fields", () => {
    vi.setSystemTime(new Date("2026-07-26T12:00:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0);
    const prepared = prepareRecordMetadata({ heading: { class: "deed", title: "Title" } });
    expect((prepared.heading as { number?: string })?.number).toBe("10000");
    expect((prepared.heading as { date?: string })?.date).toBe("2026-07-26");
    const result = validateRecordResult({ cover: "c", document: "d", heading: { class: "deed", title: "Title", total: null }, status: "Completed" });
    expect(getRecordSummaryItems("s", result, result.heading)).toContainEqual(["Total", "-"]);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
