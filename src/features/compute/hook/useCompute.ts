import { useEffect, useMemo } from "react";
import { workerError } from "../../../shared/worker/capabilityHttp";
import type { ComputeFailure, ComputePanelProps } from "../../../shared/type/capability.types";
import { useComputeStore } from "../store/computeStore";
import { createComputeWorkerClient } from "../worker/computeWorkerClient";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isComplete = (status: unknown) => status === "completed";
const isFailed = (status: unknown) => status === "error";

export function useCompute({ onComplete, onError, request, workerClient }: Pick<ComputePanelProps, "onComplete" | "onError" | "request" | "workerClient">) {
  const client = useMemo(() => workerClient ?? createComputeWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);

  useEffect(() => {
    useComputeStore.getState().open(request, "fee");
    if (!useComputeStore.getState().setRunning(request.requestId)) return;
    let canceled = false;
    let operation: ComputeFailure["operation"] = "submit";

    const fail = (operation: ComputeFailure["operation"], error: unknown) => {
      const failure: ComputeFailure = {
        capability: "compute",
        error: workerError(error, operation === "data" ? "Retrieve metadata failed." : "Compute request failed."),
        operation,
        requestId: request.requestId,
        session: request.session,
      };
      useComputeStore.getState().setError(failure);
      onError(failure);
    };

    void (async () => {
      try {
        let response = await client.submit(request.authToken, request.session);
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Compute request failed." };
        operation = "status";
        response = await client.status(request.authToken, request.session);
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Compute request failed." };
        let complete = isComplete(response.status);
        if (!complete) {
          operation = "submit";
          response = await client.submit(request.authToken, request.session);
          if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Compute request failed." };
          for (let attempt = 0; !complete && attempt < 27; attempt += 1) {
            await wait(request.intervalMs);
            operation = "status";
            response = await client.status(request.authToken, request.session);
            if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Compute request failed." };
            complete = isComplete(response.status);
          }
        }
        if (!complete) throw { code: "COMPUTE_TIMEOUT", error: "Compute timed out." };
        operation = "data";
        const result = await client.data(request.authToken, request.session);
        if (canceled) return;
        useComputeStore.getState().setReady(request.requestId, result);
        onComplete({ capability: "compute", outcome: "completed", requestId: request.requestId, result, session: request.session });
      } catch (error) {
        if (!canceled) fail(operation, error);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [client, onComplete, onError, request]);
}
