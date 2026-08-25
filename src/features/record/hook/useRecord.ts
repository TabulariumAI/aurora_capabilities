import { useEffect, useMemo } from "react";
import type { ProgressEvent } from "../../progressview/type/progress.types";
import { workerError } from "../../../shared/worker/capabilityHttp";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import type { RecordFailure, RecordPanelProps } from "../../../shared/type/capability.types";
import { prepareRecordMetadata } from "../data/recordData";
import { useRecordStore } from "../store/recordStore";
import { createRecordWorkerClient } from "../worker/recordWorkerClient";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
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
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Record status failed." };
        let complete = isComplete(response.status);
        if (!complete) {
          operation = "compute-data";
          progressId = "metadata";
          message = "Preparing endorsement details...";
          onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
          const metadata = await client.computeData(request.authToken, request.session);
          if (metadata === "") throw { code: "INVALID_JSON_INPUT_HEAD", error: "Invalid JSON input: missing heading" };
          operation = "submit";
          progressId = "endorsement";
          message = "Creating endorsement pages...";
          onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
          await client.submit(request.authToken, request.session, prepareRecordMetadata(metadata));
          progressId = "recording";
          message = "Recording the document now...";
          onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
          for (let attempt = 0; !complete && attempt < 21; attempt += 1) {
            await wait(request.intervalMs);
            operation = "status";
            response = await client.status(request.authToken, request.session);
            if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Record status failed." };
            complete = isComplete(response.status);
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
