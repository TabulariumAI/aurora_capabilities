import { createRoot } from "react-dom/client";
import { RecordPanel, RedactPanel, ManifestPanel } from "../src/public-api";

const requestBase = {
  authToken: "token",
  documentApiGatewayUrl: "https://example.test",
  intervalMs: 4000,
  requestId: "visual-request",
  session: "visual-session",
};

function App() {
  return (
    <main style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <RecordPanel
        request={{ ...requestBase, capability: "record", document: "visual.pdf" }}
        workerClient={{
          status: async () => ({ data: null, status: "completed" }),
          computeData: async () => ({ heading: { class: "deed", title: "Visual" } }),
          submit: async () => ({ data: null, status: "completed" }),
          data: async () => ({
            cover: "cover.pdf",
            document: "record.pdf",
            heading: { class: "deed", title: "Seeded Recording", number: "12345", date: "2026-07-26", total: 125 },
            queueId: "record-queue-1",
            status: "Completed",
          }),
        }}
        onComplete={() => undefined}
        onDownloadCover={async () => undefined}
        onDownloadDocument={async () => undefined}
        onError={() => undefined}
        onReadyChange={() => undefined}
      />
      <RedactPanel
        request={{ ...requestBase, capability: "redact", document: "visual.pdf", requestId: "visual-redact" }}
        workerClient={{
          status: async () => ({ data: null, status: "completed" }),
          submit: async () => ({ data: null, status: "completed" }),
          data: async () => ({ pdf: "redacted.pdf" }),
        }}
        onComplete={() => undefined}
        onDownloadPdf={async () => undefined}
        onError={() => undefined}
        onReadyChange={() => undefined}
      />
      <ManifestPanel
        request={{ ...requestBase, capability: "manifest", requestId: "visual-manifest" }}
        workerClient={{
          status: async () => ({ data: null, status: "completed" }),
          submit: async () => ({ data: null, status: "completed" }),
          data: async () => ({ pdf: "https://example.test/manifest.pdf" }),
        }}
        onComplete={() => undefined}
        onDownloadPdf={async () => undefined}
        onError={() => undefined}
        onReadyChange={() => undefined}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
