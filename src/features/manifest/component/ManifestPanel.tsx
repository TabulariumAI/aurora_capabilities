import type { JSX } from "react";
import { CapabilityLoading } from "../../../shared/component/CapabilityLoading";
import { DeliveryNotice } from "../../../shared/component/DeliveryNotice";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import type { ManifestPanelProps } from "../../../shared/type/capability.types";
import { useManifest } from "../hook/useManifest";
import { useManifestStore } from "../store/manifestStore";

const loadingMessages = [
  "Retriving Indexes...",
  "Analyzing Indexing...",
  "Generating IQ page..",
  "Generating Index Pages...",
  "Generating Index Pages...",
  "Retrieving Manifest...",
  "Retrieving Manifest...",
];

export function ManifestPanel(props: ManifestPanelProps): JSX.Element {
  useManifest(props);
  const store = useManifestStore();
  if (store.status === "loading") {
    return <CapabilityLoading intervalMs={props.request.intervalMs} messages={loadingMessages} showText />;
  }
  if (store.status !== "ready" || !store.result) return <></>;
  const runDelivery = async () => {
    useManifestStore.getState().setDelivery(true, "Preparing manifest PDF download...");
    try {
      await props.onDownloadPdf(store.result?.pdf ?? "");
      useManifestStore.getState().setDelivery(false, "Manifest PDF downloaded.");
    } catch (error) {
      useManifestStore.getState().setDelivery(false, error instanceof Error ? error.message : String(error), "error");
    }
  };
  return (
    <div style={capabilityStyles.dialogBody}>
      <div style={capabilityStyles.readyTitle}>Manifest Ready</div>
      <button disabled={store.delivering} style={{ ...capabilityStyles.primaryButton, opacity: store.delivering ? 0.6 : 1 }} type="button" onClick={() => void runDelivery()}>Download Manifest PDF</button>
      <DeliveryNotice kind={store.deliveryKind} message={store.deliveryNotice} />
    </div>
  );
}
