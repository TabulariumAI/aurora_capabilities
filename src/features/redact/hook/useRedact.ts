import { useEffect, useMemo } from "react";
import type { ProgressEvent } from "../../progressview/type/progress.types";
import { workerError } from "../../../shared/worker/capabilityHttp";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import type { RedactFailure, RedactPanelProps } from "../../../shared/type/capability.types";
import { useRedactStore } from "../store/redactStore";
import { createRedactWorkerClient } from "../worker/redactWorkerClient";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isComplete = (status: unknown) => typeof status === "string" && status.toLowerCase() === "completed";
const isFailed = (status: unknown) => typeof status === "string" && ["error", "failed"].includes(status.toLowerCase());

export function useRedact({ onComplete, onError, onProgress, request, workerClient }: Pick<RedactPanelProps, "onComplete" | "onError" | "request" | "workerClient"> & { onProgress(event: ProgressEvent): void }) {
  const client = useMemo(() => workerClient ?? createRedactWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  useEffect(() => {
    useRedactStore.getState().open(request);
    if (!useRedactStore.getState().setRunning(request.requestId)) return;
    let canceled = false;
    let operation: RedactFailure["operation"] = "status";
    let progressId = "status";
    let message = "Checking redaction status...";
    onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
    const fail = (operation: RedactFailure["operation"], error: unknown, defaultMessage: string) => {
      const failure: RedactFailure = {
        capability: "redact",
        error: workerError(error, defaultMessage),
        operation,
        requestId: request.requestId,
        session: request.session,
      };
      useRedactStore.getState().setError(failure);
      onProgress({ error: failure.error.error, jobId: `${request.requestId}-${progressId}`, message, phase: "failed" });
      onError(failure);
    };
    void (async () => {
      try {
        let response = await client.status(request.authToken, request.session);
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Redaction status check failed." };
        let complete = isComplete(response.status);
        if (!complete) {
          operation = "submit";
          progressId = "redacting";
          message = "Redacting confidential information...";
          onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
          response = await client.submit(request.authToken, request.session);
          if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Redaction submit failed." };
        }
        for (let attempt = 0; !complete && attempt < 21; attempt += 1) {
          await wait(request.intervalMs);
          operation = "status";
          response = await client.status(request.authToken, request.session);
          if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Redaction status check failed." };
          complete = isComplete(response.status);
        }
        if (!complete) throw { code: "REDACT_TIMEOUT_REFRESH", error: "Redaction timed out." };
        operation = "data";
        progressId = "document";
        message = "Preparing your redacted file...";
        onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
        const result = await client.data(request.authToken, request.session);
        if (canceled) return;
        onProgress({ jobId: `${request.requestId}-complete`, message: "Redaction complete.", phase: "started" });
        onProgress({ jobId: `${request.requestId}-complete`, message: "Redaction complete.", phase: "completed" });
        useCapabilityDataStore.getState().setData("redact", request.session, result);
        useRedactStore.getState().setReady(request.requestId);
        onComplete({ capability: "redact", outcome: "completed", requestId: request.requestId, result, session: request.session });
      } catch (error) {
        if (!canceled) fail(operation, error, `Redaction ${operation} failed.`);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [client, onComplete, onError, onProgress, request]);
}
