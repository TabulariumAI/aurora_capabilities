import { useMemo, type JSX } from "react";
import type { IndexSegmentValues } from "aurorra-index";
import { CapabilityLoading } from "../../../shared/component/CapabilityLoading";
import { MetadataResult } from "../../../shared/component/MetadataResult";
import type { ComputePanelProps } from "../../../shared/type/capability.types";
import { useCompute } from "../hook/useCompute";
import { useComputeStore } from "../store/computeStore";

function shortcuts(segments: IndexSegmentValues) {
  return new Map([
    [segments.CHAIN, "c"],
    [segments.HISTORY, "k"],
    [segments.FEEFACTOR, "g"],
    [segments.FEE, "b"],
    [segments.FUND, "u"],
    [segments.PAGE, "a"],
    [segments.SECRETS, "c"],
    [segments.TITLE, "t"],
    [segments.ENDORSEMENT, "e"],
    [segments.PARTY, "p"],
    [segments.REFERENCE, "r"],
    [segments.PROPERTY, "x"],
    [segments.LEGAL, "l"],
    [segments.MONETARY, "m"],
    [segments.ACKNOWLEDGMENT, "n"],
    [segments.VITAL, "w"],
    [segments.TRANSACTION, "s"],
  ]);
}

export function ComputePanel(props: ComputePanelProps): JSX.Element {
  useCompute(props);
  const store = useComputeStore();
  const shortcutMap = useMemo(() => shortcuts(props.segments), [props.segments]);
  if (store.status === "loading") {
    return <CapabilityLoading intervalMs={props.request.intervalMs} showText={false} />;
  }
  if (store.status !== "ready" || store.result == null) return <></>;
  return (
    <MetadataResult
      callbacks={props.callbacks}
      hiddenSegments={new Set([props.segments.CHAIN, props.segments.HISTORY])}
      metadata={store.result}
      openSegment={store.openSegment}
      segments={props.segments}
      session={props.request.session}
      setOpenSegment={useComputeStore.getState().setOpenSegment}
      shortcuts={shortcutMap}
      status={store.status}
    />
  );
}
