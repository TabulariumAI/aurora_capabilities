import type { JSX } from "react";
import { DeliveryNotice } from "../../../shared/component/DeliveryNotice";
import { DownloadButton } from "../../../shared/component/DownloadButton";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import type { RedactPanelProps } from "../../../shared/type/capability.types";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import { ProgressView } from "../../progressview/component/ProgressView";
import { useProgress } from "../../progressview/hook/useProgress";
import { useRedact } from "../hook/useRedact";
import { useRedactStore } from "../store/redactStore";

export function RedactPanel(props: RedactPanelProps): JSX.Element {
  const progress = useProgress(props.request.requestId);
  useRedact({ ...props, onProgress: progress.receive });
  const store = useRedactStore();
  const data = useCapabilityDataStore((state) => state.getData("redact", props.request.session));
  const redact = data && typeof data === "object" ? data as Record<string, unknown> : null;
  const pdf = typeof redact?.pdf === "string" ? redact.pdf : null;

  return (
    <ProgressView
      completion={store.status === "ready" && pdf ? (
        <section aria-label="Redaction Ready" style={capabilityStyles.readyPanel}>
          <div aria-label="Redaction actions" role="group" style={capabilityStyles.readyActions}>
            <DownloadButton
              disabled={store.delivering}
              label="Download Redacted PDF"
              onError={(error) => {
                useRedactStore.getState().setDelivery(false, error, "error");
                progress.receive({ error, jobId: `${props.request.requestId}-redact-download`, message: "Redacted PDF download failed.", phase: "failed" });
              }}
              onStart={() => {
                useRedactStore.getState().setDelivery(true, "Preparing redacted PDF download...");
                progress.receive({ jobId: `${props.request.requestId}-redact-download`, message: "Preparing redacted PDF download...", phase: "started" });
              }}
              onSuccess={() => {
                useRedactStore.getState().setDelivery(false, "Redacted PDF downloaded.");
                progress.receive({ jobId: `${props.request.requestId}-redact-download`, message: "Redacted PDF downloaded.", phase: "completed" });
              }}
              url={pdf}
            />
          </div>
          <DeliveryNotice kind={store.deliveryKind} message={store.deliveryNotice} />
        </section>
      ) : undefined}
      completionJobId={`${props.request.requestId}-complete`}
      fillCompletion={false}
      intro="I’ll keep you updated as I redact confidential information."
      jobs={progress.jobs}
      process="REDACTING THE DOCUMENT"
    />
  );
}
