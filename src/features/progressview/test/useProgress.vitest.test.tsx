import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useProgress } from "../hook/useProgress";

it("keeps title resets separate from another capability's progress", () => {
  const { result } = renderHook(() => ({ title: useProgress("Batch"), compute: useProgress("session") }));
  act(() => {
    result.current.title.receive({ jobId: "link", message: "Linking sessions...", phase: "started" });
    result.current.compute.receive({ jobId: "compute", message: "Calculating fees...", phase: "started" });
  });
  act(() => result.current.title.reset());
  expect(result.current.title.jobs).toEqual([]);
  expect(result.current.compute.jobs).toEqual([{ jobId: "compute", message: "Calculating fees...", phase: "started" }]);
});

it("completes the active stage when an earlier job starts again", () => {
  const { result } = renderHook(() => useProgress("request"));
  act(() => {
    result.current.receive({ jobId: "status", message: "Checking status...", phase: "started" });
    result.current.receive({ jobId: "data", message: "Retrieving data...", phase: "started" });
    result.current.receive({ jobId: "status", message: "Checking status...", phase: "started" });
  });
  expect(result.current.jobs).toEqual([
    { jobId: "status", message: "Checking status...", phase: "started" },
    { jobId: "data", message: "Retrieving data...", phase: "completed" },
  ]);
});

describe("useProgress", () => {
  it("retains counters on terminal events and clears a stale counter on restart", () => {
    const { result } = renderHook(() => useProgress("request-1"));

    act(() => {
      result.current.receive({ jobId: "manifest", message: "Generating document manifest...", phase: "started", progress: { completed: 8, total: 21, unit: "steps" } });
      result.current.receive({ jobId: "manifest", message: "Generating document manifest...", phase: "failed", error: "Unavailable" });
      result.current.receive({ jobId: "manifest", message: "Generating document manifest...", phase: "started" });
    });

    expect(result.current.jobs).toEqual([{ jobId: "manifest", message: "Generating document manifest...", phase: "started" }]);
  });

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

describe("title report progress", () => {
  it("preserves an omitted count on terminal updates and clears it on restart", () => {
    const { result } = renderHook(() => useProgress("Batch A"));

    act(() => {
      result.current.receive({ jobId: "data", message: "Retrieving Report...", phase: "started", progress: { completed: 18, total: 18, unit: "steps" } });
      result.current.receive({ jobId: "data", message: "Retrieving Report...", phase: "failed", error: "Unavailable" });
      result.current.receive({ jobId: "data", message: "Retrieving Report...", phase: "started" });
    });

    expect(result.current.jobs).toEqual([{ jobId: "data", message: "Retrieving Report...", phase: "started" }]);
  });

  it("updates one numbered job in place and completes it when the next stage starts", () => {
    const { result } = renderHook(() => useProgress("Batch A"));
    for (let index = 1; index <= 7; index++) {
      act(() => result.current.receive({ jobId: "link", message: `Linking session ${index} of 7...`, phase: "started" }));
      expect(result.current.jobs).toEqual([
        { jobId: "link", message: `Linking session ${index} of 7...`, phase: "started" },
      ]);
    }
    act(() => result.current.receive({ jobId: "generate", message: "Starting report generation...", phase: "started" }));
    expect(result.current.jobs).toEqual([
      { jobId: "link", message: "Linking session 7 of 7...", phase: "completed" },
      { jobId: "generate", message: "Starting report generation...", phase: "started" },
    ]);
  });

  it("keeps different jobs separate even when their display text matches", () => {
    const { result } = renderHook(() => useProgress("Batch A"));
    act(() => {
      result.current.receive({ jobId: "status-1", message: "Retrieving Report...", phase: "started" });
      result.current.receive({ jobId: "status-2", message: "Retrieving Report...", phase: "started" });
      result.current.receive({ jobId: "status-2", message: "Retrieving Report...", phase: "started" });
    });
    expect(result.current.jobs).toEqual([
      { jobId: "status-1", message: "Retrieving Report...", phase: "completed" },
      { jobId: "status-2", message: "Retrieving Report...", phase: "started" },
    ]);
  });

  it("fails the single numbered row and clears it before a retry", () => {
    const { result } = renderHook(() => useProgress("Batch A"));
    act(() => {
      result.current.receive({ jobId: "link", message: "Linking session 1 of 3...", phase: "started" });
      result.current.receive({ jobId: "link", message: "Linking session 2 of 3...", phase: "started" });
      result.current.receive({ jobId: "link", message: "Linking session 2 of 3...", phase: "failed", error: "Link failed" });
    });
    expect(result.current.jobs).toEqual([
      { jobId: "link", message: "Linking session 2 of 3...", phase: "failed", error: "Link failed" },
    ]);
    act(() => {
      result.current.reset();
      result.current.receive({ jobId: "link", message: "Linking session 1 of 3...", phase: "started" });
    });
    expect(result.current.jobs).toEqual([
      { jobId: "link", message: "Linking session 1 of 3...", phase: "started" },
    ]);
  });

  it("retains completed title work and updates the active job", () => {
    const { result } = renderHook(() => useProgress("Batch A"));

    act(() => {
      result.current.receive({ jobId: "status", message: "Retrieving Indexes...", phase: "started" });
      result.current.receive({ jobId: "generate", message: "Generating Report...", phase: "started" });
      result.current.receive({ jobId: "generate", message: "Generating Report...", phase: "completed" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "status", message: "Retrieving Indexes...", phase: "completed" },
      { jobId: "generate", message: "Generating Report...", phase: "completed" },
    ]);
  });

  it("clears title progress and ignores stale updates for another batch", () => {
    const { rerender, result } = renderHook(({ batch }) => useProgress(batch), {
      initialProps: { batch: "Batch A" },
    });

    act(() => result.current.receive({ jobId: "status", message: "Retrieving Indexes...", phase: "started" }));
    const staleReceive = result.current.receive;
    rerender({ batch: "Batch B" });
    act(() => staleReceive({ jobId: "status", message: "Stale update", phase: "failed", error: "stale" }));

    expect(result.current.jobs).toEqual([]);
  });

  it("starts a fresh timeline when the same batch is regenerated", () => {
    const { result } = renderHook(() => useProgress("Batch A"));

    act(() => {
      result.current.receive({ jobId: "Batch A-status-0", message: "Retrieving Indexes...", phase: "started" });
      result.current.receive({ jobId: "Batch A-data", message: "Retrieving Report...", phase: "started" });
      result.current.reset();
      result.current.receive({ jobId: "Batch A-status-0", message: "Retrieving Indexes...", phase: "started" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "Batch A-status-0", message: "Retrieving Indexes...", phase: "started" },
    ]);
  });
});
