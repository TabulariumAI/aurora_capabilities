import { useCallback, useMemo } from "react";
import type { ProgressJob } from "aurora-core";
import type { ComputePanelProps } from "../../../shared/type/capability.types";
import { useCapabilityRun } from "../../../shared/hook/useCapabilityRun";
import { createComputeWorkerClient } from "../worker/computeWorkerClient";
import { runCompute } from "../worker/runCompute";

export function useCompute({ onComplete, onError, onProgress, onResource, request, segments, workerClient }: Pick<ComputePanelProps, "onComplete" | "onError" | "onResource" | "request" | "segments" | "workerClient"> & { onProgress(event: ProgressJob): void }) {
  const client = useMemo(() => workerClient ?? createComputeWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  const start = useCallback(() => runCompute({ onComplete, onError, request, workerClient: client, segments, onResource }), [client, onComplete, onError, request, segments, onResource]);
  useCapabilityRun(request.requestId, start, onProgress);
}
