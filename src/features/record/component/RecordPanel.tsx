import * as ScrollArea from "@radix-ui/react-scroll-area";
import { useEffect, type JSX } from "react";
import { DeliveryNotice } from "../../../shared/component/DeliveryNotice";
import { useLoadingMessages } from "../../../shared/hook/useLoadingMessages";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import type { RecordPanelProps } from "../../../shared/type/capability.types";
import { getRecordSummaryItems } from "../data/recordData";
import { useRecord } from "../hook/useRecord";
import { useRecordStore } from "../store/recordStore";

const loadingMessages = [
  "Retrieving Indexes...",
  "Analyzing Indexing...",
  "Generating Endorsement page...",
  "Annotating Pages...",
  "Annotating Pages...",
  "Retrieving Recording...",
  "Retrieving Recording...",
];

export function RecordPanel(props: RecordPanelProps): JSX.Element {
  useRecord(props);
  const store = useRecordStore();
  const loading = store.status === "idle" || store.status === "loading";
  const message = useLoadingMessages(loadingMessages, props.request.intervalMs, loading);

  useEffect(() => {
    props.onReadyChange(store.status !== "idle" && store.status !== "loading");
  }, [props.onReadyChange, store.status]);

  useEffect(() => {
    props.onLoaderChange?.(message ? [message] : null);
  }, [message, props.onLoaderChange]);

  if (store.status !== "ready" || !store.result) return <></>;
  const result = store.result;
  const items = getRecordSummaryItems(props.request.session, result, result.heading);
  const runDelivery = async (target: "document" | "cover") => {
    const isDocument = target === "document";
    useRecordStore.getState().setDelivery(target, isDocument ? "Downloading recorded document" : "Preparing cover page (receipt)...");
    try {
      await (isDocument ? props.onDownloadDocument(result.document) : props.onDownloadCover(result.cover));
      useRecordStore.getState().setDelivery(null, isDocument ? "Recorded document downloaded" : "Cover page (receipt) downloaded.");
    } catch {
      useRecordStore.getState().setDelivery(null, isDocument ? "Failed to download recorded document" : "Failed to download cover page (receipt).", "error");
    }
  };
  return (
    <div style={capabilityStyles.recordWrap}>
      <div style={capabilityStyles.recordTitle}>Recording Summary</div>
      <div style={capabilityStyles.recordContent}>
        <ScrollArea.Root style={{ width: "100%" }}>
          <ScrollArea.Viewport style={{ width: "100%" }}>
            <div className="rv-summary-grid" style={capabilityStyles.recordGrid}>
              {items.map(([label, value]) => (
                <div key={label} style={capabilityStyles.recordTile}>
                  <div style={capabilityStyles.recordLabel}>{label}</div>
                  <div style={capabilityStyles.recordValue}>{value === "" ? "-" : value}</div>
                </div>
              ))}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" />
        </ScrollArea.Root>
        <style>{"@media(max-width: 35rem){.rv-summary-grid{grid-template-columns:1fr!important}}"}</style>
        <div style={capabilityStyles.recordActions}>
          <a href="#!" style={capabilityStyles.linkAction(store.delivering === "document")} onClick={(event) => { event.preventDefault(); void runDelivery("document"); }}>Recorded Document</a>
          <span style={{ opacity: 0.55, userSelect: "none", margin: "0 0.25rem" }}>|</span>
          <a href="#!" style={capabilityStyles.linkAction(store.delivering === "cover")} onClick={(event) => { event.preventDefault(); void runDelivery("cover"); }}>Cover Page (Receipt)</a>
        </div>
        <DeliveryNotice kind={store.deliveryKind} message={store.deliveryNotice} />
      </div>
    </div>
  );
}
