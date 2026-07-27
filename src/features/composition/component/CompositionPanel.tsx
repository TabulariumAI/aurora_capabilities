import { useMemo, type JSX } from "react";
import type { IndexSegmentValues } from "aurorra-index";
import { CapabilityLoading } from "../../../shared/component/CapabilityLoading";
import { MetadataResult } from "../../../shared/component/MetadataResult";
import type { CompositionPanelProps } from "../../../shared/type/capability.types";
import { useComposition } from "../hook/useComposition";
import { useCompositionStore } from "../store/compositionStore";

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

export function CompositionPanel(props: CompositionPanelProps): JSX.Element {
  useComposition(props);
  const store = useCompositionStore();
  const shortcutMap = useMemo(() => shortcuts(props.segments), [props.segments]);
  if (store.status === "loading") {
    return <CapabilityLoading intervalMs={props.request.intervalMs} showText={false} />;
  }
  if (store.status !== "ready" || store.result == null) return <></>;
  return (
    <MetadataResult
      callbacks={props.callbacks}
      hiddenSegments={new Set([props.segments.FEEFACTOR, props.segments.FEE, props.segments.FUND])}
      metadata={store.result}
      openSegment={store.openSegment}
      segments={props.segments}
      session={props.request.session}
      setOpenSegment={useCompositionStore.getState().setOpenSegment}
      shortcuts={shortcutMap}
      status={store.status}
    />
  );
}
