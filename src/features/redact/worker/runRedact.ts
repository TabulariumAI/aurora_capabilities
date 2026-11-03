import { pollSteps, workerError } from "../../../shared/worker/capabilityHttp";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import type { RedactFailure, RedactPanelProps } from "../../../shared/type/capability.types";
import { useRedactStore } from "../store/redactStore";
import { createRedactWorkerClient } from "../worker/redactWorkerClient";
import { runCapabilityJob } from "../../../shared/worker/capabilityRunner";
const isComplete = (status: unknown) => typeof status === "string" && status.toLowerCase() === "completed";
const isFailed = (status: unknown) => typeof status === "string" && ["error", "failed"].includes(status.toLowerCase());
export function runRedact({ onComplete, onError, request, workerClient }: Pick<RedactPanelProps, "onComplete" | "onError" | "request" | "workerClient">) {
  const client = workerClient ?? createRedactWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl });
  runCapabilityJob(request, async ({ isActive, onProgress, finish }) => {
    useRedactStore.getState().open(request);
    useRedactStore.getState().setRunning(request.requestId);
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
      finish("failed");
      useRedactStore.getState().setError(failure);
      onProgress({ error: failure.error.error, jobId: `${request.requestId}-${progressId}`, message, phase: "failed" });
      onError(failure);
    };
    try {
      let response = await client.status(request.authToken, request.session);
      if (!isActive())
        return;
      if (isFailed(response.status))
        throw { error: typeof response.data === "string" ? response.data : "Redaction status check failed." };
      let complete = isComplete(response.status);
      if (!complete) {
        operation = "submit";
        progressId = "redacting";
        message = "Redacting confidential information...";
        onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started", progress: { completed: 0, total: 21, unit: "steps" } });
        response = await client.submit(request.authToken, request.session);
        if (!isActive())
          return;
        if (isFailed(response.status))
          throw { error: typeof response.data === "string" ? response.data : "Redaction submit failed." };
      }
      if (!complete) {
        for await (const step of pollSteps(request.intervalMs, 21)) {
          if (!isActive())
            return;
          onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started", progress: { completed: step + 1, total: 21, unit: "steps" } });
          operation = "status";
          response = await client.status(request.authToken, request.session);
          if (!isActive())
            return;
          if (isFailed(response.status))
            throw { error: typeof response.data === "string" ? response.data : "Redaction status check failed." };
          complete = isComplete(response.status);
          if (complete)
            break;
        }
      }
      if (!complete)
        throw { code: "REDACT_TIMEOUT_REFRESH", error: "Redaction timed out." };
      operation = "data";
      progressId = "document";
      message = "Preparing your redacted file...";
      onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
      const result = await client.data(request.authToken, request.session);
      if (!isActive())
        return;
      onProgress({ jobId: `${request.requestId}-complete`, message: "Redaction complete.", phase: "started" });
      onProgress({ jobId: `${request.requestId}-complete`, message: "Redaction complete.", phase: "completed" });
      useCapabilityDataStore.getState().setData("redact", request.session, result);
      finish("completed");
      useRedactStore.getState().setReady(request.requestId);
      onComplete({ capability: "redact", outcome: "completed", requestId: request.requestId, result, session: request.session });
    }
    catch (error) {
      if (isActive())
        fail(operation, error, `Redaction ${operation} failed.`);
    }
  });
}
