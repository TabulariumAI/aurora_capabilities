import type { JSX } from "react";
import { DownloadButton } from "../../../shared/component/DownloadButton";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import type { RecordPanelProps } from "../../../shared/type/capability.types";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import { ProgressView } from "../../progressview/component/ProgressView";
import { useProgress } from "../../progressview/hook/useProgress";
import { useRecord } from "../hook/useRecord";
import { useRecordStore } from "../store/recordStore";

export function RecordPanel(props: RecordPanelProps): JSX.Element {
  const progress = useProgress(props.request.requestId);
  useRecord({ ...props, onProgress: progress.receive });
  const store = useRecordStore();
  const data = useCapabilityDataStore((state) => state.getData("record", props.request.session));
  const record = data && typeof data === "object" ? data as Record<string, unknown> : null;
  const document = typeof record?.pdf_record === "string" ? record.pdf_record : null;
  const cover = typeof record?.pdf_confirmation === "string" ? record.pdf_confirmation : null;

  return (
    <ProgressView
      completion={store.status === "ready" && (document || cover) ? (
        <section aria-label="Recording actions" style={capabilityStyles.recordWrap}>
          <div aria-label="Recording actions" role="group" style={capabilityStyles.recordActions}>
            {document ? <DownloadButton disabled={store.delivering !== null} label="Recorded Document" onError={(error) => {
              useRecordStore.getState().setDelivering(null);
              progress.receive({ error, jobId: `${props.request.requestId}-record-download`, message: "Recorded document download failed.", phase: "failed" });
            }} onStart={() => {
              useRecordStore.getState().setDelivering("document");
              progress.receive({ jobId: `${props.request.requestId}-record-download`, message: "Downloading recorded document", phase: "started" });
            }} onSuccess={() => {
              useRecordStore.getState().setDelivering(null);
              progress.receive({ jobId: `${props.request.requestId}-record-download`, message: "Recorded document downloaded", phase: "completed" });
            }} url={document} /> : null}
            {cover ? <DownloadButton disabled={store.delivering !== null} label="Cover Page (Receipt)" onError={(error) => {
              useRecordStore.getState().setDelivering(null);
              progress.receive({ error, jobId: `${props.request.requestId}-cover-download`, message: "Cover page (receipt) download failed.", phase: "failed" });
            }} onStart={() => {
              useRecordStore.getState().setDelivering("cover");
              progress.receive({ jobId: `${props.request.requestId}-cover-download`, message: "Downloading cover page (receipt)...", phase: "started" });
            }} onSuccess={() => {
              useRecordStore.getState().setDelivering(null);
              progress.receive({ jobId: `${props.request.requestId}-cover-download`, message: "Cover page (receipt) downloaded.", phase: "completed" });
            }} url={cover} /> : null}
          </div>
        </section>
      ) : undefined}
      completionJobId={`${props.request.requestId}-complete`}
      fillCompletion={false}
      intro="I’ll keep you updated as I prepare your document for recording."
      jobs={progress.jobs}
      process="RECORDING THE DOCUMENT"
    />
  );
}
