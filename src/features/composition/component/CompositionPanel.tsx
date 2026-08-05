import { useEffect, useMemo, type JSX } from "react";
import { MetadataResult } from "../../../shared/component/MetadataResult";
import { CAPABILITY_SHORTCUTS, type CompositionPanelProps } from "../../../shared/type/capability.types";
import { useComposition } from "../hook/useComposition";
import { useCompositionStore } from "../store/compositionStore";

export function CompositionPanel(props: CompositionPanelProps): JSX.Element {
  useComposition(props);
  const store = useCompositionStore();
  const shortcutMap = useMemo(() => new Map(CAPABILITY_SHORTCUTS.map(({ key, segment }) => [props.segments[segment], key])), [props.segments]);

  useEffect(() => {
    props.onReadyChange(store.status !== "idle" && store.status !== "loading");
  }, [props.onReadyChange, store.status]);

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
