import { describe, expect, it, vi } from "vitest";
import { prepareRecordMetadata } from "../data/recordData";

describe("record data", () => {
  it("prepares record metadata", () => {
    vi.setSystemTime(new Date("2026-07-26T12:00:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0);
    const prepared = prepareRecordMetadata({ heading: { class: "deed", title: "Title" } });
    expect((prepared.heading as { number?: string })?.number).toBe("10000");
    expect((prepared.heading as { date?: string })?.date).toBe("2026-07-26");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
