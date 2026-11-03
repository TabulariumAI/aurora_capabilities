import { useCallback, useMemo, useRef, useState } from "react";
import type { ProgressJob } from "aurora-core";

function mergeJob(current: ProgressJob, event: ProgressJob): ProgressJob {
  const restarting = event.phase === "started" && (current.phase === "completed" || current.phase === "failed");
  const next = { ...current, ...event };
  if (!restarting) return next;

  const { error: _error, ...withoutError } = next;
  if (Object.hasOwn(event, "progress")) return withoutError;
  const { progress: _progress, ...withoutProgress } = withoutError;
  return withoutProgress;
}

type ProgressState = {
  jobs: readonly ProgressJob[];
  receive(event: ProgressJob): void;
  reset(): void;
};

export function useProgress(requestId: string): ProgressState {
  const activeId = useRef(requestId);
  activeId.current = requestId;
  const [state, setState] = useState({ jobs: [] as readonly ProgressJob[], requestId });
  const jobs = state.requestId === requestId ? state.jobs : [];

  const receive = useCallback((event: ProgressJob) => {
    if (activeId.current !== requestId) return;
    setState((current) => {
      const jobs = current.requestId === requestId ? current.jobs : [];
      if (event.phase === "started") {
        const jobIndex = jobs.findIndex((job) => job.jobId === event.jobId);
        return {
          jobs: jobIndex >= 0
            ? jobs.map<ProgressJob>((job) => job.jobId === event.jobId
              ? mergeJob(job, event)
              : job.phase === "started" ? { ...job, phase: "completed" } : job)
            : [...jobs.map<ProgressJob>((job) => job.phase === "started" ? { ...job, phase: "completed" } : job), event],
          requestId,
        };
      }

      return { jobs: jobs.map<ProgressJob>((job) => job.jobId === event.jobId
        ? mergeJob(job, event)
        : job), requestId };
    });
  }, [requestId]);

  const reset = useCallback(() => {
    setState({ jobs: [], requestId });
  }, [requestId]);

  return useMemo(() => ({ jobs, receive, reset }), [jobs, receive, reset]);
}
