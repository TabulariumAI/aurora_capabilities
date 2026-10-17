import { useMemo, type JSX } from "react";
import { ProgressView } from "../../progressview/component/ProgressView";
import { useProgress } from "../../progressview/hook/useProgress";
import { CAPABILITY_SHORTCUTS, type ComputePanelProps } from "../../../shared/type/capability.types";
import { computeQueueStore } from "../store/computeQueueStore";
import { ComputeDetails } from "./ComputeDetails";
import { useCompute } from "../hook/useCompute";
import { useComputeStore } from "../store/computeStore";

export function ComputePanel(props: ComputePanelProps): JSX.Element {
  const progress = useProgress(props.request.requestId);
  useCompute({ ...props, onProgress: progress.receive });
  const store = useComputeStore();
  const result = computeQueueStore((state) => state.data[props.request.session]);
  const shortcutMap = useMemo(() => new Map(CAPABILITY_SHORTCUTS.map(({ key, segment }) => [props.segments[segment], key])), [props.segments]);

  if (store.status === "ready" && result != null) {
    return (
      <ComputeDetails
        session={props.request.session}
        data={result}
        onAddFee={props.onAddFee}
        onAddFund={props.onAddFund}
        onEndorse={props.onEndorse}
        openSegment={store.openSegment}
        segments={props.segments}
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
