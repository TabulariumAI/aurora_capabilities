import type { JSX } from "react";
import { CapabilityLoading } from "../../../shared/component/CapabilityLoading";
import { DeliveryNotice } from "../../../shared/component/DeliveryNotice";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import type { RedactPanelProps } from "../../../shared/type/capability.types";
import { useRedact } from "../hook/useRedact";
import { useRedactStore } from "../store/redactStore";

const loadingMessages = [
  "Retriving Confidential Information...",
  "Analyzing Confidential Information...",
  "Redacting Pages...",
  "Redacting Pages...",
  "Redacting Pages...",
  "Retrieving Redacted Document...",
  "Retrieving Redacted Document...",
];

export function RedactPanel(props: RedactPanelProps): JSX.Element {
  useRedact(props);
  const store = useRedactStore();
  if (store.status === "loading") {
    return <CapabilityLoading intervalMs={props.request.intervalMs} messages={loadingMessages} showText />;
  }
  if (store.status !== "ready" || !store.result) return <></>;
  const runDelivery = async () => {
    useRedactStore.getState().setDelivery(true, "Preparing redacted PDF download...");
    try {
      await props.onDownloadPdf(store.result?.pdf ?? "");
      useRedactStore.getState().setDelivery(false, "Redacted PDF downloaded.");
    } catch (error) {
      useRedactStore.getState().setDelivery(false, error instanceof Error ? error.message : String(error), "error");
    }
  };
  return (
    <div style={capabilityStyles.dialogBody}>
      <div style={capabilityStyles.readyTitle}>Redaction Ready</div>
      <button disabled={store.delivering} style={{ ...capabilityStyles.primaryButton, opacity: store.delivering ? 0.6 : 1 }} type="button" onClick={() => void runDelivery()}>Download Redacted PDF</button>
      <DeliveryNotice kind={store.deliveryKind} message={store.deliveryNotice} />
    </div>
  );
}
