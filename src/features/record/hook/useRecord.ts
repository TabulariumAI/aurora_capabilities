import { useEffect, useMemo } from "react";
import { workerError } from "../../../shared/worker/capabilityHttp";
import type { RecordFailure, RecordPanelProps } from "../../../shared/type/capability.types";
import { prepareRecordMetadata } from "../data/recordData";
import { useRecordStore } from "../store/recordStore";
import { createRecordWorkerClient } from "../worker/recordWorkerClient";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isComplete = (status: unknown) => status === "completed";
const isFailed = (status: unknown) => status === "error";

export function useRecord({ onComplete, onError, request, workerClient }: Pick<RecordPanelProps, "onComplete" | "onError" | "request" | "workerClient">) {
  const client = useMemo(() => workerClient ?? createRecordWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  useEffect(() => {
    useRecordStore.getState().open(request);
    if (!useRecordStore.getState().setRunning(request.requestId)) return;
    let canceled = false;
    const fail = (operation: RecordFailure["operation"], error: unknown) => {
      const defaultMessage = operation === "data" ? "Retrive metadata failed." : "Record request failed.";
      const failure: RecordFailure = {
        capability: "record",
        error: operation === "data" ? { code: "RETRIVE_METADATA_FAILED", error: "Retrive metadata failed." } : workerError(error, defaultMessage),
        operation,
        requestId: request.requestId,
        session: request.session,
      };
      useRecordStore.getState().setError(failure);
      onError(failure);
    };
    void (async () => {
      try {
        let response = await client.status(request.authToken, request.session);
        if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Record status failed." };
        let complete = isComplete(response.status);
        if (!complete) {
          const metadata = await client.computeData(request.authToken, request.session);
          if (metadata === "") throw { code: "INVALID_JSON_INPUT_HEAD", error: "Invalid JSON input: missing heading" };
          await client.submit(request.authToken, request.session, prepareRecordMetadata(metadata));
          for (let attempt = 0; !complete && attempt < 21; attempt += 1) {
            await wait(request.intervalMs);
            response = await client.status(request.authToken, request.session);
            if (isFailed(response.status)) throw { error: typeof response.data === "string" ? response.data : "Record status failed." };
            complete = isComplete(response.status);
          }
        }
        if (!complete) throw { code: "RECORD_TIMEOUT", error: "Record timed out." };
        const result = await client.data(request.authToken, request.session);
        if (canceled) return;
        useRecordStore.getState().setReady(request.requestId, result);
        onComplete({ capability: "record", outcome: "completed", requestId: request.requestId, result, session: request.session });
      } catch (error) {
        if (!canceled) fail("data", error);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [client, onComplete, onError, request]);
}
