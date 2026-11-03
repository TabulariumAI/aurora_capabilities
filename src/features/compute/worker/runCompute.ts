import { pollSteps, workerError } from "../../../shared/worker/capabilityHttp";
import type { ComputeFailure, ComputePanelProps } from "../../../shared/type/capability.types";
import { computeQueueStore } from "../store/computeQueueStore";
import { updateComputeMetadata, useComputeStore } from "../store/computeStore";
import { createComputeWorkerClient } from "../worker/computeWorkerClient";
import { runCapabilityJob } from "../../../shared/worker/capabilityRunner";
const isComplete = (status: unknown) => status === "completed";
const isFailed = (status: unknown) => status === "error";
export function runCompute({ onComplete, onError, onResource, request, segments, workerClient }: Pick<ComputePanelProps, "onComplete" | "onError" | "onResource" | "request" | "segments" | "workerClient">) {
  const client = workerClient ?? createComputeWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl });
  runCapabilityJob(request, async ({ isActive, onProgress, finish }) => {
    useComputeStore.getState().open(request, segments.FEE);
    useComputeStore.getState().setRunning(request.requestId);
    let operation: ComputeFailure["operation"] = "submit";
    let progressId = "start";
    let message = "Starting fee calculation...";
    onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
    const fail = (operation: ComputeFailure["operation"], error: unknown) => {
      const failure: ComputeFailure = {
        capability: "compute",
        error: workerError(error, operation === "data" ? "Retrieve fees failed." : "Compute request failed."),
        operation,
        requestId: request.requestId,
        session: request.session,
      };
      finish("failed");
      useComputeStore.getState().setError(failure);
      onProgress({ error: failure.error.error, jobId: `${request.requestId}-${progressId}`, message, phase: "failed" });
      onError(failure);
    };
    try {
      const generation = useComputeStore.getState().metadataGeneration;
      const etag = await new Promise<string | null>((resolve, reject) => {
        onResource({ resource: "metadata_etag", session: request.session, callback(result) {
            if (result.ok)
              resolve(result.data as string | null);
            else
              reject(result);
          } });
      });
      if (!isActive())
        return;
      if (useComputeStore.getState().request?.requestId === request.requestId && useComputeStore.getState().metadataGeneration === generation)
        updateComputeMetadata({ session: request.session, etag });
      let response = await client.submit(request.authToken, request.session, request.refresh ? null : etag, request.refresh);
      if (!isActive())
        return;
      if (isFailed(response.status))
        throw { error: typeof response.data === "string" ? response.data : "Compute request failed." };
      operation = "status";
      progressId = "status";
      message = "Checking fee calculation progress...";
      onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
      response = await client.status(request.authToken, request.session);
      if (!isActive())
        return;
      if (isFailed(response.status))
        throw { error: typeof response.data === "string" ? response.data : "Compute request failed." };
      let complete = isComplete(response.status);
      if (!complete) {
        operation = "status";
        progressId = "calculating";
        message = "Calculating document fees...";
        onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started", progress: { completed: 0, total: 27, unit: "steps" } });
        for await (const step of pollSteps(request.intervalMs, 27)) {
          if (!isActive())
            return;
          onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started", progress: { completed: step + 1, total: 27, unit: "steps" } });
          operation = "status";
          response = await client.status(request.authToken, request.session);
          if (!isActive())
            return;
          if (isFailed(response.status))
            throw { error: typeof response.data === "string" ? response.data : "Compute request failed." };
          complete = isComplete(response.status);
          if (complete)
            break;
        }
      }
      if (!complete)
        throw { code: "COMPUTE_TIMEOUT", error: "Compute timed out." };
      operation = "data";
      progressId = "details";
      message = "Preparing fee details...";
      onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
      const { result, metadataEtag } = await client.data(request.authToken, request.session);
      if (!isActive())
        return;
      onProgress({ jobId: `${request.requestId}-complete`, message: "Fee calculation complete.", phase: "started" });
      onProgress({ jobId: `${request.requestId}-complete`, message: "Fee calculation complete.", phase: "completed" });
      const resource = await client.model(request.authToken, request.session);
      if (!isActive())
        return;
      await computeQueueStore.getState().setModel(request.session, resource);
      if (!isActive())
        return;
      await computeQueueStore.getState().setResult(request.session, result);
      if (!isActive())
        return;
      finish("completed");
      useComputeStore.getState().setReady(request.requestId, metadataEtag);
      onComplete({ capability: "compute", outcome: "completed", requestId: request.requestId, result, session: request.session });
    }
    catch (error) {
      if (!isActive())
        return;
      fail(operation, error);
    }
  });
}
