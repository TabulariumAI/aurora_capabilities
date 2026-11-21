import { useCallback, useMemo } from "react";
import type { ProgressJob } from "aurora-core";
import type { ManifestPanelProps } from "../../../shared/type/capability.types";
import { useCapabilityRun } from "../../../shared/hook/useCapabilityRun";
import { createManifestWorkerClient } from "../worker/manifestWorkerClient";
import { runManifest } from "../worker/runManifest";
import { useManifestStore } from "../store/manifestStore";

export function useManifest({ onComplete, onError, onProgress, request, workerClient }: Pick<ManifestPanelProps, "onComplete" | "onError" | "request" | "workerClient"> & { onProgress(event: ProgressJob): void }) {
  const client = useMemo(() => workerClient ?? createManifestWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  const options = useManifestStore(state => state.request?.requestId === request.requestId ? state.request.options : request.options);
  const start = useCallback(() => runManifest({ onComplete, onError, request: { ...request, options }, workerClient: client }), [client, onComplete, onError, request, options]);
  useCapabilityRun(request.requestId, start, onProgress);
}
