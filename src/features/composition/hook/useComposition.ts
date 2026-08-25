import { useEffect, useMemo } from "react";
import type { ProgressEvent } from "../../progressview/type/progress.types";
import { workerError } from "../../../shared/worker/capabilityHttp";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import { COMPOSITION_SEGMENTS, type CompositionFailure, type CompositionPanelProps } from "../../../shared/type/capability.types";
import { useCompositionStore } from "../store/compositionStore";
import { createCompositionWorkerClient } from "../worker/compositionWorkerClient";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isComplete = (status: unknown) => status === "completed";
const isFailed = (status: unknown) => status === "error";

export function useComposition({ onComplete, onError, onProgress, request, workerClient }: Pick<CompositionPanelProps, "onComplete" | "onError" | "request" | "workerClient"> & { onProgress(event: ProgressEvent): void }) {
  const client = useMemo(() => workerClient ?? createCompositionWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);

  useEffect(() => {
    useCompositionStore.getState().open(request, COMPOSITION_SEGMENTS.CHAIN);
    if (!useCompositionStore.getState().setRunning(request.requestId)) return;
    let canceled = false;
    let operation: CompositionFailure["operation"] = "submit";
    let progressId = "start";
    let message = "Starting document composition...";
    onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
    const fail = (operation: CompositionFailure["operation"], error: unknown) => {
      const failure: CompositionFailure = {
        capability: "composition",
        error: workerError(error, "Composition request failed."),
        operation,
        requestId: request.requestId,
        session: request.session,
      };
      useCompositionStore.getState().setError(failure);
      onProgress({ error: failure.error.error, jobId: `${request.requestId}-${progressId}`, message, phase: "failed" });
      onError(failure);
    };
    void (async () => {
      try {
        let response = await client.submit(request.authToken, request.session);
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Composition request failed." };
        operation = "status";
        progressId = "composition";
        message = "Composing document metadata...";
        onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
        response = await client.status(request.authToken, request.session);
        if (isFailed(response.status)) throw { code: "COMPOSITION_ERR", error: `An error occurred during composition: ${(response.data as { data?: unknown })?.data}` };
        let complete = isComplete(response.status);
        for (let attempt = 0; !complete && attempt < 27; attempt += 1) {
          await wait(request.intervalMs);
          operation = "status";
          response = await client.status(request.authToken, request.session);
          if (isFailed(response.status)) throw { code: "COMPOSITION_ERR", error: `An error occurred during composition: ${(response.data as { data?: unknown })?.data}` };
          complete = isComplete(response.status);
        }
        if (!complete) throw { code: "COMPOSITION_TIMEOUT", error: "Composition timed out." };
        operation = "data";
        progressId = "details";
        message = "Preparing composition details...";
        onProgress({ jobId: `${request.requestId}-${progressId}`, message, phase: "started" });
        const result = await client.data(request.authToken, request.session);
        if (canceled) return;
        onProgress({ jobId: `${request.requestId}-complete`, message: "Document composition complete.", phase: "started" });
        onProgress({ jobId: `${request.requestId}-complete`, message: "Document composition complete.", phase: "completed" });
        useCapabilityDataStore.getState().setData("composition", request.session, result);
        useCompositionStore.getState().setReady(request.requestId);
        onComplete({ capability: "composition", outcome: "completed", requestId: request.requestId, result, session: request.session });
      } catch (error) {
        if (!canceled) fail(operation, error);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [client, onComplete, onError, onProgress, request]);

  return client;
}
