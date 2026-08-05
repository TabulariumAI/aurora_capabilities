import { useEffect, useMemo } from "react";
import { workerError } from "../../../shared/worker/capabilityHttp";
import type { ManifestFailure, ManifestPanelProps } from "../../../shared/type/capability.types";
import { useManifestStore } from "../store/manifestStore";
import { createManifestWorkerClient } from "../worker/manifestWorkerClient";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isComplete = (status: unknown) => status === "completed";
const isFailed = (status: unknown) => status === "error";

export function useManifest({ onComplete, onError, request, workerClient }: Pick<ManifestPanelProps, "onComplete" | "onError" | "request" | "workerClient">) {
  const client = useMemo(() => workerClient ?? createManifestWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  useEffect(() => {
    useManifestStore.getState().open(request);
    if (!useManifestStore.getState().setRunning(request.requestId)) return;
    let canceled = false;
    let operation: ManifestFailure["operation"] = "status";
    let prefix = "Manifest checkStatus failed";
    const fail = (operation: ManifestFailure["operation"], error: unknown, prefix: string) => {
      const base = workerError(error, `${prefix} failed.`);
      const failure: ManifestFailure = {
        capability: "manifest",
        error: { ...base, error: `${prefix}: ${base.error}` },
        operation,
        requestId: request.requestId,
        session: request.session,
      };
      useManifestStore.getState().setError(failure);
      onError(failure);
    };
    void (async () => {
      try {
        let response = await client.status(request.authToken, request.session);
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Manifest checkStatus failed." };
        let complete = isComplete(response.status);
        if (!complete) {
          operation = "submit";
          prefix = "Manifest submit failed";
          response = await client.submit(request.authToken, request.session);
          if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Manifest submit failed." };
          for (let attempt = 0; !complete && attempt < 21; attempt += 1) {
            await wait(request.intervalMs);
            operation = "status";
            prefix = "Manifest checkStatus failed";
            response = await client.status(request.authToken, request.session);
            if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Manifest checkStatus failed." };
            complete = isComplete(response.status);
          }
        }
        if (!complete) throw { code: "REPORT_TIMEOUT", error: "Report timed out." };
        operation = "data";
        prefix = "Manifest data retrieval failed";
        const result = await client.data(request.authToken, request.session);
        if (canceled) return;
        useManifestStore.getState().setReady(request.requestId, result);
        onComplete({ capability: "manifest", outcome: "completed", requestId: request.requestId, result, session: request.session });
      } catch (error) {
        if (!canceled) fail(operation, error, prefix);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [client, onComplete, onError, request]);
}
