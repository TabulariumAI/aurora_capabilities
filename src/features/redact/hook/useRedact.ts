import { useEffect, useMemo } from "react";
import { workerError } from "../../../shared/worker/capabilityHttp";
import type { RedactFailure, RedactPanelProps } from "../../../shared/type/capability.types";
import { useRedactStore } from "../store/redactStore";
import { createRedactWorkerClient } from "../worker/redactWorkerClient";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isComplete = (status: unknown) => typeof status === "string" && status.toLowerCase() === "completed";
const isFailed = (status: unknown) => typeof status === "string" && ["error", "failed"].includes(status.toLowerCase());

export function useRedact({ onComplete, onError, request, workerClient }: Pick<RedactPanelProps, "onComplete" | "onError" | "request" | "workerClient">) {
  const client = useMemo(() => workerClient ?? createRedactWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  useEffect(() => {
    useRedactStore.getState().open(request);
    if (!useRedactStore.getState().setRunning(request.requestId)) return;
    let canceled = false;
    const fail = (operation: RedactFailure["operation"], error: unknown, defaultMessage: string) => {
      const failure: RedactFailure = {
        capability: "redact",
        error: workerError(error, defaultMessage),
        operation,
        requestId: request.requestId,
        session: request.session,
      };
      useRedactStore.getState().setError(failure);
      onError(failure);
    };
    void (async () => {
      try {
        let response = await client.status(request.authToken, request.session);
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Redaction status check failed." };
        let complete = isComplete(response.status);
        if (!complete) {
          response = await client.submit(request.authToken, request.session);
          if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Redaction submit failed." };
        }
        for (let attempt = 0; !complete && attempt < 21; attempt += 1) {
          await wait(request.intervalMs);
          response = await client.status(request.authToken, request.session);
          if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Redaction status check failed." };
          complete = isComplete(response.status);
        }
        if (!complete) throw { code: "REDACT_TIMEOUT_REFRESH", error: "Redaction timed out." };
        const result = await client.data(request.authToken, request.session);
        if (canceled) return;
        useRedactStore.getState().setReady(request.requestId, result);
        onComplete({ capability: "redact", outcome: "completed", requestId: request.requestId, result, session: request.session });
      } catch (error) {
        if (!canceled) fail("status", error, "Redaction status check failed.");
      }
    })();
    return () => {
      canceled = true;
    };
  }, [client, onComplete, onError, request]);
}
