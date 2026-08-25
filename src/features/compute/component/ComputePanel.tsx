import { useMemo, type JSX } from "react";
import { ProgressView } from "../../progressview/component/ProgressView";
import { useProgress } from "../../progressview/hook/useProgress";
import { CAPABILITY_SHORTCUTS, type ComputePanelProps, type ComputeResult } from "../../../shared/type/capability.types";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import { ComputeDetails } from "./ComputeDetails";
import { useCompute } from "../hook/useCompute";
import { useComputeStore } from "../store/computeStore";

export function ComputePanel(props: ComputePanelProps): JSX.Element {
  const progress = useProgress(props.request.requestId);
  useCompute({ ...props, onProgress: progress.receive });
  const store = useComputeStore();
  const result = useCapabilityDataStore((state) => state.getData("compute", props.request.session)) as ComputeResult | null;
  const shortcutMap = useMemo(() => new Map(CAPABILITY_SHORTCUTS.map(({ key, segment }) => [props.segments[segment], key])), [props.segments]);

  if (store.status === "ready" && result != null) {
    return (
      <ComputeDetails
        callbacks={props.callbacks}
        metadata={result}
        onEndorse={props.onEndorse}
        openSegment={store.openSegment}
        segments={props.segments}
        session={props.request.session}
        setOpenSegment={useComputeStore.getState().setOpenSegment}
        shortcuts={shortcutMap}
      />
    );
  }

  return (
    <ProgressView
      fillCompletion={false}
      intro="I’ll keep you updated as I calculate document fees."
      jobs={progress.jobs}
      process="CALCULATING FEES AND FUNDS"
    />
  );
}
