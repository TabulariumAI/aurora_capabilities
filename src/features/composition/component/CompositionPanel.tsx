import { useMemo, type JSX } from "react";
import { ProgressView } from "../../progressview/component/ProgressView";
import { useProgress } from "../../progressview/hook/useProgress";
import { COMPOSITION_SHORTCUTS, type CompositionPanelProps, type CompositionResult } from "../../../shared/type/capability.types";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import { CompositionView } from "./CompositionView";
import { useComposition } from "../hook/useComposition";
import { useCompositionStore } from "../store/compositionStore";

export function CompositionPanel(props: CompositionPanelProps): JSX.Element {
  const progress = useProgress(props.request.requestId);
  const workerClient = useComposition({ ...props, onProgress: progress.receive });
  const store = useCompositionStore();
  const result = useCapabilityDataStore((state) => state.getData("composition", props.request.session)) as CompositionResult | null;
  const shortcutMap = useMemo(() => new Map(COMPOSITION_SHORTCUTS.map(({ key, segment }) => [segment, key])), []);

  if (store.status === "ready" && result != null) {
    return (
      <CompositionView
        canLink={props.canLink}
        callbacks={props.callbacks}
        metadata={result}
        onError={props.onError}
        onLinkBatch={props.onLinkBatch}
        onViewBatch={props.onViewBatch}
        openSegment={store.openSegment}
        requestId={props.request.requestId}
        session={props.request.session}
        setOpenSegment={useCompositionStore.getState().setOpenSegment}
        shortcuts={shortcutMap}
        token={props.request.authToken}
        workerClient={workerClient}
      />
    );
  }

  return (
    <ProgressView
      fillCompletion={false}
      intro="I’ll keep you updated while I compose the document and prepare its metadata."
      jobs={progress.jobs}
      process="COMPOSING DOCUMENT METADATA"
    />
  );
}
