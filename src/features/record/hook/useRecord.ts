import { useEffect, useMemo } from "react";
import type { ProgressEvent } from "../../progressview/type/progress.types";
import { pollSteps, workerError } from "../../../shared/worker/capabilityHttp";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import type { RecordFailure, RecordPanelProps } from "../../../shared/type/capability.types";
import { useRecordStore } from "../store/recordStore";
import { createRecordWorkerClient } from "../worker/recordWorkerClient";

const isComplete = (status: unknown) => status === "completed";
const isFailed = (status: unknown) => status === "error";

export function useRecord({ onComplete, onError, onProgress, request, workerClient }: Pick<RecordPanelProps, "onComplete" | "onError" | "request" | "workerClient"> & { onProgress(event: ProgressEvent): void }) {
  const client = useMemo(() => workerClient ?? createRecordWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  useEffect(() => {
    useRecordStore.getState().open(request);
    if (!useRecordStore.getState().setRunning(request.requestId)) return;
    let canceled = false;
    let operation: RecordFailure["operation"] = "status";
    let progressId = "status";
    let message = "Checking recording status...";
    onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
    const fail = (operation: RecordFailure["operation"], error: unknown) => {
      const defaultMessage = operation === "data" ? "Retrieve metadata failed." : "Record request failed.";
      const failure: RecordFailure = {
        capability: "record",
        error: operation === "data" ? { code: "RETRIEVE_METADATA_FAILED", error: "Retrieve metadata failed." } : workerError(error, defaultMessage),
        operation,
        requestId: request.requestId,
        session: request.session,
      };
      useRecordStore.getState().setError(failure);
      onProgress({ error: failure.error.error, jobId: `${request.requestId}-${progressId}`, message, phase: "failed" });
      onError(failure);
    };
    void (async () => {
      try {
        let response = await client.status(request.authToken, request.session);
        if (canceled) return;
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Record status failed." };
        let complete = isComplete(response.status);
        if (!complete) {
          if (response.status === "pending") {
            operation = "compute";
            progressId = "compute";
            message = "Calculating document fees...";
            onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
            let computation = await client.calculate(request.authToken, request.session);
            if (isFailed(computation.status)) throw { error: String(computation.data) };
            if (!isComplete(computation.status)) {
              for await (const _step of pollSteps(request.intervalMs, 27)) {
                if (canceled) return;
                computation = await client.computation(request.authToken, request.session);
                if (isFailed(computation.status)) throw { error: String(computation.data) };
                if (isComplete(computation.status)) break;
              }
            }
            if (!isComplete(computation.status)) throw { code: "COMPUTE_TIMEOUT", error: "Compute timed out." };
            if (canceled) return;
            onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "completed" });
            operation = "submit";
            progressId = "endorsement";
            message = "Creating endorsement pages...";
            onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
            response = await client.submit(request.authToken, request.session);
            if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Record request failed." };
          }
          progressId = "recording";
          message = "Recording the document now...";
          onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started", progress: { completed: 0, total: 21, unit: "steps" } });
          for await (const step of pollSteps(request.intervalMs, 21)) {
            if (canceled) return;
            onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started", progress: { completed: step + 1, total: 21, unit: "steps" } });
            operation = "status";
            response = await client.status(request.authToken, request.session);
            if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Record status failed." };
            complete = isComplete(response.status);
            if (complete) break;
          }
        }
        if (!complete) throw { code: "RECORD_TIMEOUT", error: "Record timed out." };
        operation = "data";
        progressId = "document";
        message = "Preparing your recorded file...";
        onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
        const result = await client.data(request.authToken, request.session);
        if (canceled) return;
        onProgress({ jobId: `${request.requestId}-complete`, message: "Recording complete.", phase: "started" });
        onProgress({ jobId: `${request.requestId}-complete`, message: "Recording complete.", phase: "completed" });
        useCapabilityDataStore.getState().setData("record", request.session, result);
        useRecordStore.getState().setReady(request.requestId);
        onComplete({ capability: "record", outcome: "completed", requestId: request.requestId, result, session: request.session });
      } catch (error) {
        if (!canceled) fail(operation, error);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [client, onComplete, onError, onProgress, request]);
}
