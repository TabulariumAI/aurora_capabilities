import { useCallback, useMemo, useRef, useState } from "react";
import type { ProgressEvent, ProgressJob } from "../type/progress.types";

type ProgressState = {
  jobs: readonly ProgressJob[];
  receive(event: ProgressEvent): void;
};

export function useProgress(requestId: string): ProgressState {
  const activeId = useRef(requestId);
  activeId.current = requestId;
  const [state, setState] = useState({ jobs: [] as readonly ProgressJob[], requestId });
  const jobs = state.requestId === requestId ? state.jobs : [];

  const receive = useCallback((event: ProgressEvent) => {
    if (activeId.current !== requestId) return;
    setState((current) => {
      const jobs = current.requestId === requestId ? current.jobs : [];
      if (event.phase === "started") {
        const next = { jobId: event.jobId, message: event.message, phase: event.phase } as const;
        const exists = jobs.some((job) => job.jobId === event.jobId);
        return {
          jobs: exists
            ? jobs.map<ProgressJob>((job) => job.jobId === event.jobId ? next : job.phase === "started" ? { ...job, phase: "completed" } : job)
            : [...jobs.map<ProgressJob>((job) => job.phase === "started" ? { ...job, phase: "completed" } : job), next],
          requestId,
        };
      }

      return { jobs: jobs.map<ProgressJob>((job) => job.jobId === event.jobId
        ? {
            ...job,
            ...(event.phase === "failed" ? { error: event.error } : {}),
            message: event.message,
            phase: event.phase,
          }
        : job), requestId };
    });
  }, [requestId]);

  return useMemo(() => ({ jobs, receive }), [jobs, receive]);
}
