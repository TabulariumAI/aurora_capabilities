import { useEffect, useMemo } from "react";
import type { ProgressEvent } from "../../progressview/type/progress.types";
import { workerError } from "../../../shared/worker/capabilityHttp";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import type { ManifestFailure, ManifestPanelProps } from "../../../shared/type/capability.types";
import { useManifestStore } from "../store/manifestStore";
import { createManifestWorkerClient } from "../worker/manifestWorkerClient";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isComplete = (status: unknown) => status === "completed";
const isFailed = (status: unknown) => status === "error";

function toManifestError(error: unknown, context: string) {
  const fallback = `${context}.`;
  const base = workerError(error, fallback);
  return base.error === fallback
    ? base
    : { ...base, error: `${context}: ${base.error}` };
}

export function useManifest({ onComplete, onError, onProgress, request, workerClient }: Pick<ManifestPanelProps, "onComplete" | "onError" | "request" | "workerClient"> & { onProgress(event: ProgressEvent): void }) {
  const client = useMemo(() => workerClient ?? createManifestWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  useEffect(() => {
    useManifestStore.getState().open(request);
    if (!useManifestStore.getState().setRunning(request.requestId)) return;
    let canceled = false;
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
      useManifestStore.getState().setError(failure);
      onProgress({ error: failure.error.error, jobId: `${request.requestId}-${progressId}`, message, phase: "failed" });
      onError(failure);
    };
    void (async () => {
      try {
        let response = await client.status(request.authToken, request.session);
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : `${context}.` };
        let complete = isComplete(response.status);
        if (!complete) {
          operation = "submit";
          context = "Manifest submit failed";
          progressId = "generating";
          message = "Generating document manifest...";
          onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
          response = await client.submit(request.authToken, request.session);
          if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : `${context}.` };
          for (let attempt = 0; !complete && attempt < 21; attempt += 1) {
            await wait(request.intervalMs);
            operation = "status";
            context = "Manifest checkStatus failed";
            response = await client.status(request.authToken, request.session);
            if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : `${context}.` };
            complete = isComplete(response.status);
          }
        }
        if (!complete) throw { code: "REPORT_TIMEOUT", error: "Report timed out." };
        operation = "data";
        context = "Manifest data retrieval failed";
        progressId = "download";
        message = "Preparing manifest download...";
        onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
        const result = await client.data(request.authToken, request.session);
        if (canceled) return;
        onProgress({ jobId: `${request.requestId}-complete`, message: "Manifest is ready to download.", phase: "started" });
        onProgress({ jobId: `${request.requestId}-complete`, message: "Manifest is ready to download.", phase: "completed" });
        useCapabilityDataStore.getState().setData("manifest", request.session, result);
        useManifestStore.getState().setReady(request.requestId);
        onComplete({ capability: "manifest", outcome: "completed", requestId: request.requestId, result, session: request.session });
      } catch (error) {
        if (!canceled) fail(operation, error, context);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [client, onComplete, onError, onProgress, request]);
}
