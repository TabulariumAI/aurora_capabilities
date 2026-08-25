import type { JSX } from "react";
import { DownloadButton } from "../../../shared/component/DownloadButton";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import type { ManifestPanelProps } from "../../../shared/type/capability.types";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import { ProgressView } from "../../progressview/component/ProgressView";
import { useProgress } from "../../progressview/hook/useProgress";
import { useManifest } from "../hook/useManifest";
import { useManifestStore } from "../store/manifestStore";

export function ManifestPanel(props: ManifestPanelProps): JSX.Element {
  const progress = useProgress(props.request.requestId);
  useManifest({ ...props, onProgress: progress.receive });
  const store = useManifestStore();
  const data = useCapabilityDataStore((state) => state.getData("manifest", props.request.session));
  const manifest = data && typeof data === "object" ? data as Record<string, unknown> : null;
  const pdf = typeof manifest?.pdf === "string" ? manifest.pdf : null;

  return (
    <ProgressView
      completion={store.status === "ready" && pdf ? (
        <section aria-label="Manifest actions" style={capabilityStyles.readyPanel}>
          <div aria-label="Manifest actions" role="group" style={capabilityStyles.readyActions}>
            <DownloadButton
              disabled={store.delivering}
              label="Download manifest"
              onError={(error) => {
                useManifestStore.getState().setDelivering(false);
                progress.receive({ error, jobId: `${props.request.requestId}-manifest-download`, message: "Manifest download failed.", phase: "failed" });
              }}
              onStart={() => {
                useManifestStore.getState().setDelivering(true);
                progress.receive({ jobId: `${props.request.requestId}-manifest-download`, message: "Downloading manifest...", phase: "started" });
              }}
              onSuccess={() => {
                useManifestStore.getState().setDelivering(false);
                progress.receive({ jobId: `${props.request.requestId}-manifest-download`, message: "Manifest downloaded.", phase: "completed" });
              }}
              url={pdf}
            />
          </div>
        </section>
      ) : undefined}
      completionJobId={`${props.request.requestId}-complete`}
      fillCompletion={false}
      intro="I’ll keep you updated as I generate the manifest."
      jobs={progress.jobs}
      process="GENERATING THE INDEX MANIFEST"
    />
  );
}
