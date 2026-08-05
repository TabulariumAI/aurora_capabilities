import { useEffect, useMemo, type JSX } from "react";
import { MetadataResult } from "../../../shared/component/MetadataResult";
import { CAPABILITY_SHORTCUTS, type ComputePanelProps } from "../../../shared/type/capability.types";
import { useCompute } from "../hook/useCompute";
import { useComputeStore } from "../store/computeStore";

export function ComputePanel(props: ComputePanelProps): JSX.Element {
  useCompute(props);
  const store = useComputeStore();
  const shortcutMap = useMemo(() => new Map(CAPABILITY_SHORTCUTS.map(({ key, segment }) => [props.segments[segment], key])), [props.segments]);

  useEffect(() => {
    props.onReadyChange(store.status !== "idle" && store.status !== "loading");
  }, [props.onReadyChange, store.status]);

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
