import { createRoot } from "react-dom/client";
import type { CSSProperties } from "react";
import { CompositionPanel, ComputePanel, ManifestPanel, RecordPanel, RedactPanel } from "../src/public-api";
import { ProgressView } from "../src/features/progressview/component/ProgressView";

const params = new URLSearchParams(window.location.search);
const capability = params.get("capability");
const state = params.get("state");
if (capability !== "compute" && capability !== "composition" && capability !== "record" && capability !== "redact" && capability !== "manifest" && capability !== "progress") {
  throw new Error("A valid capability is required.");
}
if (state !== "ready" && state !== "pending" && state !== "failed" && state !== "data-failed") {
  throw new Error("A valid capability state is required.");
}
const requestBase = {
  document: "visual.pdf",
  authToken: "token",
  documentApiGatewayUrl: "https://example.test",
  intervalMs: 4000,
  requestId: `visual-${capability}-${state}`,
  session: "visual-session",
};
const segments = {
  ACKNOWLEDGMENT: "acknowledgment",
  COURT: "court",
  ENDORSEMENT: "endorsement",
  FEE: "fee",
  FEEFACTOR: "factor",
  FUND: "fund",
  LEGAL: "legal",
  MONETARY: "monetary",
  PAGE: "page",
  PARTY: "party",
  PROPERTY: "property",
  REFERENCE: "reference",
  SECRETS: "secrets",
  TITLE: "title",
  TRANSACTION: "transaction",
  VITAL: "vital",
};
let checks = 0;

async function status() {
  checks += 1;
  if (state === "failed") return { data: "No secrets found to redact", status: "error" as const };
  if (state === "data-failed" && checks === 1) return { data: null, status: "processing" as const };
  if (state === "pending") return { data: null, status: "processing" as const };
  if (capability === "manifest" && checks === 1) return { data: null, status: "processing" as const };
  return { data: null, status: "completed" as const };
}

function App() {
  if (capability === "progress") {
    return (
      <ProgressView
        fillCompletion={false}
        intro="I’ll keep you updated as I generate the manifest."
        jobs={Array.from({ length: 20 }, (_, index) => ({
          jobId: `progress-${index}`,
          message: `Progress ${index + 1}`,
          phase: index === 19 ? "started" as const : "completed" as const,
        }))}
        process="GENERATING THE INDEX MANIFEST"
      />
    );
  }
  if (capability === "compute") {
    return <ComputePanel callbacks={{}} request={{ ...requestBase, capability }} segments={segments} workerClient={{ status, submit: async () => ({ data: null, status: "completed" }), data: async () => ({ fee_factors: [{ amount: "4", name: "Page count" }], fees: [{ amount: "125", formula: "base + pages", name: "Recording fee" }], funds: [{ amount: "75", formula: "flat", name: "General fund" }], heading: { class: "deed", title: "Visual" } }) }} onComplete={() => undefined} onEndorse={() => undefined} onError={() => undefined} />;
  }
  if (capability === "composition") {
    return <CompositionPanel canLink callbacks={{}} request={{ ...requestBase, capability }} workerClient={{ status, submit: async () => ({ data: null, status: "completed" }), data: async () => ({ chain: [{ class: "deed", required: "YES", role: "vesting", title: "Grant Deed" }], history: { conveyance: [{ date: "2025-01-02", grantees: "Alice", grantors: "Bob" }], encumbrance: [], mortgage: [{ borrowers: "Alice", lender: "Citywide Bank" }] } }), options: async () => ["10 Main Street", "APN-123"] }} onComplete={() => undefined} onError={() => undefined} onLinkBatch={async (group, names) => ({ group, batch: { code: "batch-1", id: "batch-1", name: names[0] } })} onViewBatch={() => undefined} />;
  }
  if (capability === "record") {
    return <RecordPanel request={{ ...requestBase, capability, document: "visual.pdf" }} workerClient={{ status, computeData: async () => ({ heading: { class: "deed", title: "Visual" } }), submit: async () => ({ data: null, status: "completed" }), data: async () => ({ pdf_confirmation: "https://storage.test/subscription/visual-session/confirmation.pdf?sig=token", pdf_record: "https://storage.test/subscription/visual-session/record.pdf?sig=token", tiff_record: "https://storage.test/subscription/visual-session/record.tiff?sig=token" }) }} onComplete={() => undefined} onError={() => undefined} />;
  }
  if (capability === "redact") {
    return <RedactPanel request={{ ...requestBase, capability, document: "visual.pdf", intervalMs: 0 }} workerClient={{ status, submit: async () => ({ data: null, status: "completed" }), data: async () => {
      if (state === "data-failed") throw { code: "RETRIEVE_METADATA_FAILED", error: "Retrieve metadata failed." };
      return { pdf: "https://storage.test/subscription/visual-session/redacted.pdf?sig=token" };
    } }} onComplete={() => undefined} onError={() => undefined} />;
  }
  return <ManifestPanel request={{ ...requestBase, capability: "manifest" }} workerClient={{ status, submit: async () => ({ data: null, status: "processing" }), data: async () => ({ pdf: "https://storage.test/subscription/visual-session/manifest.pdf?sig=token" }) }} onComplete={() => undefined} onError={() => undefined} />;
}

createRoot(document.getElementById("root")!).render(
  <main style={{ "--panel-content-padding": "1rem", display: "flex", height: "100vh" } as CSSProperties}>
    <App />
  </main>,
);
