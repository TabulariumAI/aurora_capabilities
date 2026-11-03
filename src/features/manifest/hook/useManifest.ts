import { useCallback, useMemo } from "react";
import type { ProgressJob } from "aurora-core";
import type { ManifestPanelProps } from "../../../shared/type/capability.types";
import { useCapabilityRun } from "../../../shared/hook/useCapabilityRun";
import { createManifestWorkerClient } from "../worker/manifestWorkerClient";
import { runManifest } from "../worker/runManifest";

export function useManifest({ onComplete, onError, onProgress, request, workerClient }: Pick<ManifestPanelProps, "onComplete" | "onError" | "request" | "workerClient"> & { onProgress(event: ProgressJob): void }) {
  const client = useMemo(() => workerClient ?? createManifestWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  const start = useCallback(() => runManifest({ onComplete, onError, request, workerClient: client }), [client, onComplete, onError, request]);
  useCapabilityRun(request.requestId, start, onProgress);
}
