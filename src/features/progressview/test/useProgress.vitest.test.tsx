import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useProgress } from "../hook/useProgress";

describe("useProgress", () => {
  it("completes each active job as the next job begins", () => {
    const { result } = renderHook(() => useProgress("request-1"));

    act(() => {
      result.current.receive({ jobId: "status", message: "Checking manifest status...", phase: "started" });
      result.current.receive({ jobId: "submit", message: "Generating document manifest...", phase: "started" });
      result.current.receive({ jobId: "data", message: "Preparing manifest download...", phase: "started" });
      result.current.receive({ jobId: "complete", message: "Manifest is ready to download.", phase: "started" });
      result.current.receive({ jobId: "complete", message: "Manifest is ready to download.", phase: "completed" });
      result.current.receive({ jobId: "manifest-download", message: "Downloading manifest...", phase: "started" });
      result.current.receive({ jobId: "manifest-download", message: "Manifest downloaded.", phase: "completed" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "status", message: "Checking manifest status...", phase: "completed" },
      { jobId: "submit", message: "Generating document manifest...", phase: "completed" },
      { jobId: "data", message: "Preparing manifest download...", phase: "completed" },
      { jobId: "complete", message: "Manifest is ready to download.", phase: "completed" },
      { jobId: "manifest-download", message: "Manifest downloaded.", phase: "completed" },
    ]);
  });

  it("keeps the failed job and clears progress for a new request", () => {
    const { rerender, result } = renderHook(({ requestId }) => useProgress(requestId), {
      initialProps: { requestId: "request-1" },
    });

    act(() => {
      result.current.receive({ jobId: "submit", message: "Generating document manifest...", phase: "started" });
      result.current.receive({ error: "Manifest service unavailable", jobId: "submit", message: "Generating document manifest...", phase: "failed" });
    });

    expect(result.current.jobs).toEqual([
      { error: "Manifest service unavailable", jobId: "submit", message: "Generating document manifest...", phase: "failed" },
    ]);

    const staleReceive = result.current.receive;
    rerender({ requestId: "request-2" });
    expect(result.current.jobs).toEqual([]);

    act(() => staleReceive({ jobId: "stale", message: "Stale progress", phase: "started" }));
    expect(result.current.jobs).toEqual([]);
  });

  it("restarts a matching job without duplicating its identifier", () => {
    const { result } = renderHook(() => useProgress("request-1"));

    act(() => {
      result.current.receive({ jobId: "manifest-download", message: "Downloading manifest...", phase: "started" });
      result.current.receive({ jobId: "manifest-download", message: "Manifest downloaded.", phase: "completed" });
      result.current.receive({ jobId: "manifest-download", message: "Downloading manifest again...", phase: "started" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "manifest-download", message: "Downloading manifest again...", phase: "started" },
    ]);
  });

});
