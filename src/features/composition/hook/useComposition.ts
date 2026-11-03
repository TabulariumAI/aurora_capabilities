import { useCallback, useMemo } from "react";
import type { ProgressJob } from "aurora-core";
import type { CompositionPanelProps } from "../../../shared/type/capability.types";
import { useCapabilityRun } from "../../../shared/hook/useCapabilityRun";
import { createCompositionWorkerClient } from "../worker/compositionWorkerClient";
import { runComposition } from "../worker/runComposition";

export function useComposition({ onComplete, onError, onProgress, request, workerClient }: Pick<CompositionPanelProps, "onComplete" | "onError" | "request" | "workerClient"> & { onProgress(event: ProgressJob): void }) {
  const client = useMemo(() => workerClient ?? createCompositionWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  const start = useCallback(() => runComposition({ onComplete, onError, request, workerClient: client }), [client, onComplete, onError, request]);
  useCapabilityRun(request.requestId, start, onProgress);
  return client;
}
