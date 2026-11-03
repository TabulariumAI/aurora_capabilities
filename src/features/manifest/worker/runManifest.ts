import { pollSteps, workerError } from "../../../shared/worker/capabilityHttp";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import type { ManifestFailure, ManifestPanelProps } from "../../../shared/type/capability.types";
import { useManifestStore } from "../store/manifestStore";
import { createManifestWorkerClient } from "../worker/manifestWorkerClient";
import { runCapabilityJob } from "../../../shared/worker/capabilityRunner";
const isComplete = (status: unknown) => status === "completed";
const isFailed = (status: unknown) => status === "error";
function toManifestError(error: unknown, context: string) {
  const fallback = `${context}.`;
  const base = workerError(error, fallback);
  return base.error === fallback
    ? base
    : { ...base, error: `${context}: ${base.error}` };
}
export function runManifest({ onComplete, onError, request, workerClient }: Pick<ManifestPanelProps, "onComplete" | "onError" | "request" | "workerClient">) {
  const client = workerClient ?? createManifestWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl });
  runCapabilityJob(request, async ({ isActive, onProgress, finish }) => {
    useManifestStore.getState().open(request);
    useManifestStore.getState().setRunning(request.requestId);
    let operation: ManifestFailure["operation"] = "status";
    let context = "Manifest checkStatus failed";
    let progressId = "status";
    let message = "Checking manifest status...";
    onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
    const fail = (operation: ManifestFailure["operation"], error: unknown, context: string) => {
      const failure: ManifestFailure = {
        capability: "manifest",
        error: toManifestError(error, context),
        operation,
        requestId: request.requestId,
        session: request.session,
      };
      finish("failed");
      useManifestStore.getState().setError(failure);
      onProgress({ error: failure.error.error, jobId: `${request.requestId}-${progressId}`, message, phase: "failed" });
      onError(failure);
    };
    try {
      let response = await client.status(request.authToken, request.session);
      if (!isActive())
        return;
      if (isFailed(response.status))
        throw { error: typeof response.data === "string" ? response.data : `${context}.` };
      let complete = isComplete(response.status);
      if (!complete) {
        operation = "submit";
        context = "Manifest submit failed";
        progressId = "generating";
        message = "Generating document manifest...";
        onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started", progress: { completed: 0, total: 21, unit: "steps" } });
        response = await client.submit(request.authToken, request.session);
        if (!isActive())
          return;
        if (isFailed(response.status))
          throw { error: typeof response.data === "string" ? response.data : `${context}.` };
        for await (const step of pollSteps(request.intervalMs, 21)) {
          if (!isActive())
            return;
          onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started", progress: { completed: step + 1, total: 21, unit: "steps" } });
          operation = "status";
          context = "Manifest checkStatus failed";
          response = await client.status(request.authToken, request.session);
          if (!isActive())
            return;
          if (isFailed(response.status))
            throw { error: typeof response.data === "string" ? response.data : `${context}.` };
          complete = isComplete(response.status);
          if (complete)
            break;
        }
      }
      if (!complete)
        throw { code: "REPORT_TIMEOUT", error: "Report timed out." };
      operation = "data";
      context = "Manifest data retrieval failed";
      progressId = "download";
      message = "Preparing manifest download...";
      onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
      const result = await client.data(request.authToken, request.session);
      if (!isActive())
        return;
      onProgress({ jobId: `${request.requestId}-complete`, message: "Manifest is ready to download.", phase: "started" });
      onProgress({ jobId: `${request.requestId}-complete`, message: "Manifest is ready to download.", phase: "completed" });
      useCapabilityDataStore.getState().setData("manifest", request.session, result);
      finish("completed");
      useManifestStore.getState().setReady(request.requestId);
      onComplete({ capability: "manifest", outcome: "completed", requestId: request.requestId, result, session: request.session });
    }
    catch (error) {
      if (isActive())
        fail(operation, error, context);
    }
  });
}
