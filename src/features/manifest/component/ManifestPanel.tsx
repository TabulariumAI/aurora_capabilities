import { useId, type JSX } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { DownloadButton } from "../../../shared/component/DownloadButton";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import type { ManifestPanelProps } from "../../../shared/type/capability.types";
import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import { ConfButton, formStyles, ProgressView } from "aurora-core";
import { useProgress } from "../../progressview/hook/useProgress";
import { useManifest } from "../hook/useManifest";
import { useManifestStore } from "../store/manifestStore";

export function ManifestPanel(props: ManifestPanelProps): JSX.Element {
  const id = useId();
  const progress = useProgress(props.request.requestId);
  useManifest({ ...props, onProgress: progress.receive });
  const store = useManifestStore();
  const data = useCapabilityDataStore((state) => state.getData("manifest", props.request.session));
  const manifest = data && typeof data === "object" ? data as Record<string, unknown> : null;
  const pdf = typeof manifest?.pdf === "string" ? manifest.pdf : null;
  const confirmed = store.request?.requestId === props.request.requestId && Boolean(store.request.options);

  return (
    <section aria-label="Manifest generation" style={{ ...formStyles.root, flex: "1 1 auto", overflow: "hidden" }}>
      <div style={{ ...formStyles.fields, flex: "0 0 auto", padding: "0.75rem var(--panel-content-padding) 0" }}>
        <p style={{ margin: 0 }}>IQ score and indexes are always included.</p>
        <fieldset aria-label="Include in manifest" disabled={confirmed} style={{ ...formStyles.fields, border: 0 }}>
          {([
            ["include_pages", "Document images"],
            ["include_gates", "Compliance gates"],
            ["include_notes", "IQ notes"],
          ] as const).map(([option, label]) => (
            <label htmlFor={`${id}-${option}`} key={option} style={formStyles.checkboxRow}>
              <Checkbox.Root checked={store.options[option]} disabled={confirmed} id={`${id}-${option}`} onCheckedChange={checked => store.setOption(option, checked === true)} style={formStyles.checkbox(confirmed, store.options[option])}>
                <Checkbox.Indicator aria-hidden style={{ fontSize: "0.75rem", lineHeight: 1 }}>{"\u2713"}</Checkbox.Indicator>
              </Checkbox.Root>
              {label}
            </label>
          ))}
        </fieldset>
        <div style={{ ...formStyles.actions, paddingBottom: "0.75rem" }}>
          <ConfButton key={`${props.request.requestId}-${JSON.stringify(store.options)}`} disabled={confirmed} label="Generate" onConfirm={() => store.confirm(props.request.requestId)} style={formStyles.button} />
        </div>
      </div>
      {confirmed ? (
        <ProgressView autoScroll={true} highlightLast={true}
          completion={store.status === "ready" && pdf ? (
            <section aria-label="Manifest actions" style={capabilityStyles.readyPanel}>
              <div aria-label="Manifest actions" role="group" style={capabilityStyles.readyActions}>
                <DownloadButton
                  disabled={store.delivering}
                  label="Download manifest"
                  onError={(error) => {
                    useManifestStore.getState().setDelivering(false);
                    progress.receive({ error, jobId: `${props.request.requestId}-manifest-download`, message: "Manifest download failed.", phase: "failed" });
                  }}
                  onStart={() => {
                    useManifestStore.getState().setDelivering(true);
                    progress.receive({ jobId: `${props.request.requestId}-manifest-download`, message: "Downloading manifest...", phase: "started" });
                  }}
                  onSuccess={() => {
                    useManifestStore.getState().setDelivering(false);
                    progress.receive({ jobId: `${props.request.requestId}-manifest-download`, message: "Manifest downloaded.", phase: "completed" });
                  }}
                  url={pdf}
                />
              </div>
            </section>
          ) : undefined}
          completionJobId={`${props.request.requestId}-complete`}
          fillCompletion={false}
          intro="I’ll keep you updated as I generate the manifest."
          jobs={progress.jobs}
          process="GENERATING THE INDEX MANIFEST"
        />
      ) : null}
    </section>
  );
}
