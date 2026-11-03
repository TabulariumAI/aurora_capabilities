import { useCallback, useMemo } from "react";
import type { ProgressJob } from "aurora-core";
import type { RedactPanelProps } from "../../../shared/type/capability.types";
import { useCapabilityRun } from "../../../shared/hook/useCapabilityRun";
import { createRedactWorkerClient } from "../worker/redactWorkerClient";
import { runRedact } from "../worker/runRedact";

export function useRedact({ onComplete, onError, onProgress, request, workerClient }: Pick<RedactPanelProps, "onComplete" | "onError" | "request" | "workerClient"> & { onProgress(event: ProgressJob): void }) {
  const client = useMemo(() => workerClient ?? createRedactWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  const start = useCallback(() => runRedact({ onComplete, onError, request, workerClient: client }), [client, onComplete, onError, request]);
  useCapabilityRun(request.requestId, start, onProgress);
}
