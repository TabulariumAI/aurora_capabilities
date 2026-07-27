import { useEffect, useMemo } from "react";
import { workerError } from "../../../shared/worker/capabilityHttp";
import type { CompositionFailure, CompositionPanelProps } from "../../../shared/type/capability.types";
import { useCompositionStore } from "../store/compositionStore";
import { createCompositionWorkerClient } from "../worker/compositionWorkerClient";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isComplete = (status: unknown) => status === "completed";
const isFailed = (status: unknown) => status === "error";

export function useComposition({ onComplete, onError, request, workerClient }: Pick<CompositionPanelProps, "onComplete" | "onError" | "request" | "workerClient">) {
  const client = useMemo(() => workerClient ?? createCompositionWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);

  useEffect(() => {
    useCompositionStore.getState().open(request, "chain");
    if (!useCompositionStore.getState().setRunning(request.requestId)) return;
    let canceled = false;
    const fail = (operation: CompositionFailure["operation"], error: unknown) => {
      const failure: CompositionFailure = {
        capability: "composition",
        error: workerError(error, "Composition request failed."),
        operation,
        requestId: request.requestId,
        session: request.session,
      };
      useCompositionStore.getState().setError(failure);
      onError(failure);
    };
    void (async () => {
      try {
        let response = await client.submit(request.authToken, request.session);
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Composition request failed." };
        response = await client.status(request.authToken, request.session);
        if (isFailed(response.status)) throw { code: "COMPOSITION_ERR", error: `An error occurred during composition: ${(response.data as { data?: unknown })?.data}` };
        let complete = isComplete(response.status);
        for (let attempt = 0; !complete && attempt < 27; attempt += 1) {
          await wait(request.intervalMs);
          response = await client.status(request.authToken, request.session);
          if (isFailed(response.status)) throw { code: "COMPOSITION_ERR", error: `An error occurred during composition: ${(response.data as { data?: unknown })?.data}` };
          complete = isComplete(response.status);
        }
        if (!complete) throw { code: "COMPOSITION_TIMEOUT", error: "Composition timed out." };
        const result = await client.data(request.authToken, request.session);
        if (canceled) return;
        useCompositionStore.getState().setReady(request.requestId, result);
        onComplete({ capability: "composition", outcome: "completed", requestId: request.requestId, result, session: request.session });
      } catch (error) {
        if (!canceled) fail("submit", error);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [client, onComplete, onError, request]);
}
