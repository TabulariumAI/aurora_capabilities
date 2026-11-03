import { useCallback, useMemo } from "react";
import type { ProgressJob } from "aurora-core";
import type { RecordPanelProps } from "../../../shared/type/capability.types";
import { useCapabilityRun } from "../../../shared/hook/useCapabilityRun";
import { createRecordWorkerClient } from "../worker/recordWorkerClient";
import { runRecord } from "../worker/runRecord";

export function useRecord({ onComplete, onError, onProgress, request, workerClient }: Pick<RecordPanelProps, "onComplete" | "onError" | "request" | "workerClient"> & { onProgress(event: ProgressJob): void }) {
  const client = useMemo(() => workerClient ?? createRecordWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  const start = useCallback(() => runRecord({ onComplete, onError, request, workerClient: client }), [client, onComplete, onError, request]);
  useCapabilityRun(request.requestId, start, onProgress);
}
