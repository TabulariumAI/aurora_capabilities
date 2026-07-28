# Capabilities React Migration Plan

## Goal

Create `aurora_capabilities` as the pure React package for the existing
`compute`, `composition`, `record`, `redact`, and `manifest` capabilities.
Move each capability's active worker, polling, state, and rendered UI out of
`document_web/src/domains` without changing its service routes, request bodies,
polling limits, visible copy, workflow timing, or browser-delivery behavior.

The finished package must use React 19, Zustand 5, `aurorra-ui`,
`aurorra-index`, and Radix UI. It must expose typed React panels, typed Zustand
stores, and typed worker clients through `src/public-api.ts`. It must not import
or access `document_web`, its globals, its EventBus, its workflow, its storage,
or browser-delivery APIs.

## Hard Gates

- Implement this plan and
  `document_web/docs/task/capabilities-host-migration-plan.md` as one change
  set. Do not merge or ship either side independently.
- Do not add compatibility exports, aliases, defaults, fallback values,
  fallback routes, legacy adapters, TODOs, stubs, dead code, or future-facing
  extension points.
- Do not change endpoint paths, methods, bodies, response acceptance, polling
  order, polling limits, loading copy, ready copy, summary fields, workflow
  timing, or delivery ownership.
- Do not preserve a second imperative renderer or a second capability state
  owner in `document_web`.
- Do not add package access to `window`, `document`, `globalThis`,
  `localStorage`, host globals, `EventBus`, `EVENTS`, `ENV`, `API`,
  `WorkerHelper`, alerts, storage URLs, or download APIs.
- Stop before editing if any file, route, response shape, event owner, or
  current behavior described below differs from the implementation branch.
- Preserve unrelated user changes in every repository.

## Repository Boundaries

| Repository | Required responsibility |
| --- | --- |
| `aurora_capabilities` | Own all five React feature panels, feature hooks, Zustand state, HTTP workers, polling, package tests, and package visual fixtures. |
| `aurorra_index` | Expose the existing metadata panel as a host-independent renderer with explicit action, section, shortcut, and status inputs. |
| `document_web` | Create separate `src/features/compute`, `composition`, `record`, `redact`, and `manifest` React host features; supply runtime values and callbacks; retain workflow/event ownership; render package panels; perform alerts and browser delivery; persist record blob names; and delete the replaced legacy domains. |

## Package Baseline

Create the package by matching the current `aurora_refine` package layout and
tooling.

### Required root files

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `index.html`
- `scripts/check-boundary.cjs`
- `test/setup.ts`
- `test/capabilities.visual-entry.tsx`
- `test/capabilities.visual.spec.ts`

### Required package metadata

Set:

- package name: `aurora-capabilities`
- version: `0.0.0`
- `private: true`
- `type: "module"`
- `main`, `module`, and `types`: `./src/public-api.ts`
- the `"."` export's `types` and `import`: `./src/public-api.ts`

Use these scripts:

```json
{
  "typecheck": "tsc --noEmit",
  "build": "vite build",
  "lint:boundary": "node scripts/check-boundary.cjs",
  "test:vitest": "vitest run",
  "test:visual": "playwright test"
}
```

Use the versions currently declared by `aurora_refine`:

```json
{
  "dependencies": {
    "@radix-ui/react-scroll-area": "^1.2.10",
    "aurorra-index": "file:../aurorra_index",
    "aurorra-ui": "file:../aurorra_ui",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@playwright/test": "^1.56.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^25.9.1",
    "@types/react": "^19.2.16",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.2",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vitest": "^4.1.9"
  },
  "peerDependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

Configure Vite as an ES library with `src/public-api.ts` as its entry. Resolve
local aliases for `react`, `react-dom`, `aurorra-index`, and `aurorra-ui`,
dedupe React and ReactDOM, and preserve symlinks. Externalize:

- `react`
- `react-dom`
- `react-dom/client`
- `react-dom/server`
- `aurorra-index`
- `aurorra-ui`
- `@radix-ui/react-scroll-area`

Use the same aliases, dedupe list, and symlink behavior in Vitest. Run package
tests in `jsdom`; include `src/**/*.{test,spec}.{ts,tsx}` and
`test/**/*.vitest.{test,spec}.{ts,tsx}`; exclude visual specs.

Configure package Playwright at viewport `1440x900` and test only
`test/capabilities.visual.spec.ts`.

Copy `aurora_refine/scripts/check-boundary.cjs` and adapt only its dependency
list for this package. Keep its recursive source scan and all existing host,
legacy, global, EventBus, alert, environment, API, and worker-helper
prohibitions. Add `aurorra_index` as an allowed package dependency.

The public record/redact request contract has a property named `document`, so
replace the refine checker's raw `/\bdocument\b/` pattern with all of:

```js
/\bdocument\s*(?:\.|\[)/,
/=\s*document\b/,
/\(\s*document\s*[,)]/,
/\btypeof\s+document\b/,
```

This permits property declarations and `request.document` while rejecting DOM
global use. Do not weaken the `window` or `globalThis` checks.

## Public Contract

Define the following contract in
`src/shared/type/capability.types.ts` and export every public item from
`src/public-api.ts`.

```ts
import type {
  IndexMetadataCallbacks,
  IndexSegmentValues,
  MetadataPayload,
} from "aurorra-index";

export type CapabilityName =
  | "composition"
  | "compute"
  | "manifest"
  | "record"
  | "redact";

export type CapabilityOpenRequest = {
  capability: CapabilityName;
  requestId: string;
};

export type CapabilityStatus = "idle" | "loading" | "ready" | "error";

export type CapabilityError = {
  code?: string;
  details?: unknown;
  error: string;
  status?: number;
};

export type ComputeOperation = "submit" | "status" | "data";
export type CompositionOperation = "submit" | "status" | "data";
export type RecordOperation = "status" | "compute-data" | "submit" | "data";
export type RedactOperation = "status" | "submit" | "data";
export type ManifestOperation = "status" | "submit" | "data";

export type ComputeResult = MetadataPayload | "";
export type CompositionResult = MetadataPayload;

export type RecordHeading = {
  class: string;
  title: string;
  number?: string;
  date?: string;
  total?: number | null;
  [key: string]: unknown;
};

export type RecordResult = {
  heading: RecordHeading;
  document: unknown;
  cover: unknown;
  status?: string;
  queueId?: string;
  [key: string]: unknown;
};

export type RedactResult = {
  pdf: string;
  tiff?: string;
  [key: string]: unknown;
};

export type ManifestResult = {
  pdf: string;
  tif?: string;
  [key: string]: unknown;
};

export type CapabilityRequestBase = {
  authToken: string;
  documentApiGatewayUrl: string;
  intervalMs: number;
  requestId: string;
  session: string;
};

export type ComputeRequest = CapabilityRequestBase & {
  capability: "compute";
};

export type CompositionRequest = CapabilityRequestBase & {
  capability: "composition";
};

export type RecordRequest = CapabilityRequestBase & {
  capability: "record";
  document: string;
};

export type RedactRequest = CapabilityRequestBase & {
  capability: "redact";
  document: string;
};

export type ManifestRequest = CapabilityRequestBase & {
  capability: "manifest";
};

export type CapabilityRequest =
  | ComputeRequest
  | CompositionRequest
  | RecordRequest
  | RedactRequest
  | ManifestRequest;

export type CapabilityFailure<N extends CapabilityName, O extends string> = {
  capability: N;
  error: CapabilityError;
  operation: O;
  requestId: string;
  session: string;
};

export type ComputeFailure = CapabilityFailure<"compute", ComputeOperation>;
export type CompositionFailure =
  CapabilityFailure<"composition", CompositionOperation>;
export type RecordFailure = CapabilityFailure<"record", RecordOperation>;
export type RedactFailure = CapabilityFailure<"redact", RedactOperation>;
export type ManifestFailure = CapabilityFailure<"manifest", ManifestOperation>;

export type CapabilityComplete<
  N extends CapabilityName,
  R,
> = {
  capability: N;
  outcome: "completed";
  requestId: string;
  result: R;
  session: string;
};

export type CapabilityFailed<
  N extends CapabilityName,
  O extends string,
> = CapabilityFailure<N, O> & {
  outcome: "failed";
};

export type CapabilityTerminal =
  | CapabilityComplete<"compute", ComputeResult>
  | CapabilityComplete<"composition", CompositionResult>
  | CapabilityComplete<"record", RecordResult>
  | CapabilityComplete<"redact", RedactResult>
  | CapabilityComplete<"manifest", ManifestResult>
  | CapabilityFailed<"compute", ComputeOperation>
  | CapabilityFailed<"composition", CompositionOperation>
  | CapabilityFailed<"record", RecordOperation>
  | CapabilityFailed<"redact", RedactOperation>
  | CapabilityFailed<"manifest", ManifestOperation>;

export type MetadataCapabilityCallbacks = Pick<
  IndexMetadataCallbacks,
  "onAddressClick" | "onLegalView" | "onPageClick"
>;

export const CAPABILITY_SHORTCUTS = [
  { key: "c", segment: "CHAIN" },
  { key: "k", segment: "HISTORY" },
  { key: "g", segment: "FEEFACTOR" },
  { key: "b", segment: "FEE" },
  { key: "u", segment: "FUND" },
  { key: "a", segment: "PAGE" },
  { key: "c", segment: "SECRETS" },
  { key: "t", segment: "TITLE" },
  { key: "e", segment: "ENDORSEMENT" },
  { key: "p", segment: "PARTY" },
  { key: "r", segment: "REFERENCE" },
  { key: "x", segment: "PROPERTY" },
  { key: "l", segment: "LEGAL" },
  { key: "m", segment: "MONETARY" },
  { key: "n", segment: "ACKNOWLEDGMENT" },
  { key: "w", segment: "VITAL" },
  { key: "s", segment: "TRANSACTION" },
] as const satisfies ReadonlyArray<{
  key: string;
  segment: keyof IndexSegmentValues;
}>;

export type CapabilityPoll = {
  data: unknown;
  status: unknown;
};

export type ComputeWorkerClient = {
  submit(token: string, session: string): Promise<CapabilityPoll>;
  status(token: string, session: string): Promise<CapabilityPoll>;
  data(token: string, session: string): Promise<ComputeResult>;
};

export type CompositionWorkerClient = {
  submit(token: string, session: string): Promise<CapabilityPoll>;
  status(token: string, session: string): Promise<CapabilityPoll>;
  data(token: string, session: string): Promise<CompositionResult>;
};

export type RecordWorkerClient = {
  status(token: string, session: string): Promise<CapabilityPoll>;
  computeData(token: string, session: string): Promise<ComputeResult>;
  submit(
    token: string,
    session: string,
    metadata: MetadataPayload,
  ): Promise<CapabilityPoll>;
  data(token: string, session: string): Promise<RecordResult>;
};

export type RedactWorkerClient = {
  status(token: string, session: string): Promise<CapabilityPoll>;
  submit(token: string, session: string): Promise<CapabilityPoll>;
  data(token: string, session: string): Promise<RedactResult>;
};

export type ManifestWorkerClient = {
  status(token: string, session: string): Promise<CapabilityPoll>;
  submit(token: string, session: string): Promise<CapabilityPoll>;
  data(token: string, session: string): Promise<ManifestResult>;
};

export type ComputePanelProps = {
  callbacks: MetadataCapabilityCallbacks;
  onComplete: (
    terminal: CapabilityComplete<"compute", ComputeResult>,
  ) => void;
  onError: (failure: ComputeFailure) => void;
  request: ComputeRequest;
  segments: IndexSegmentValues;
  workerClient?: ComputeWorkerClient;
};

export type CompositionPanelProps = {
  callbacks: MetadataCapabilityCallbacks;
  onComplete: (
    terminal: CapabilityComplete<"composition", CompositionResult>,
  ) => void;
  onError: (failure: CompositionFailure) => void;
  request: CompositionRequest;
  segments: IndexSegmentValues;
  workerClient?: CompositionWorkerClient;
};

export type RecordPanelProps = {
  onComplete: (
    terminal: CapabilityComplete<"record", RecordResult>,
  ) => void;
  onDownloadCover: (blobName: unknown) => Promise<void>;
  onDownloadDocument: (blobName: unknown) => Promise<void>;
  onError: (failure: RecordFailure) => void;
  request: RecordRequest;
  workerClient?: RecordWorkerClient;
};

export type RedactPanelProps = {
  onComplete: (
    terminal: CapabilityComplete<"redact", RedactResult>,
  ) => void;
  onDownloadPdf: (blobName: string) => Promise<void>;
  onError: (failure: RedactFailure) => void;
  request: RedactRequest;
  workerClient?: RedactWorkerClient;
};

export type ManifestPanelProps = {
  onComplete: (
    terminal: CapabilityComplete<"manifest", ManifestResult>,
  ) => void;
  onDownloadPdf: (pdfUrl: string) => Promise<void>;
  onError: (failure: ManifestFailure) => void;
  request: ManifestRequest;
  workerClient?: ManifestWorkerClient;
};
```

The optional worker client props are the only dependency-injection seam and
exist for deterministic tests. Production callers omit them. Do not add public
props for EventBus, alerts, dialogs, storage configuration, browser download,
workflow state, or host globals.

Export:

- all five panels
- all five panel prop types
- `useComputeStore`, `useCompositionStore`, `useRecordStore`,
  `useRedactStore`, and `useManifestStore`; each is a bound Zustand store hook
  with `getState`
- all five worker client factories and worker types
- all shared request, result, error, failure, status, and terminal types
- `CAPABILITY_SHORTCUTS`

## Required Feature Tree

Create this structure. Use the listed files directly; do not add pass-through
components, pass-through hooks, barrel layers below each feature, or
single-use wrappers.

```text
src/
  public-api.ts
  shared/
    component/
      CapabilityLoading.tsx
      DeliveryNotice.tsx
      MetadataResult.tsx
    hook/
      useLoadingMessages.ts
    style/
      capabilityStyles.ts
    type/
      capability.types.ts
    worker/
      capabilityHttp.ts
  features/
    compute/
      component/ComputePanel.tsx
      hook/useCompute.ts
      store/computeStore.ts
      type/compute.types.ts
      worker/ComputeWorker.ts
      worker/computeWorkerClient.ts
      test/ComputePanel.vitest.test.tsx
      test/computeStore.vitest.test.ts
      test/computeWorker.vitest.test.ts
      test/useCompute.vitest.test.tsx
    composition/
      component/CompositionPanel.tsx
      hook/useComposition.ts
      store/compositionStore.ts
      type/composition.types.ts
      worker/CompositionWorker.ts
      worker/compositionWorkerClient.ts
      test/CompositionPanel.vitest.test.tsx
      test/compositionStore.vitest.test.ts
      test/compositionWorker.vitest.test.ts
      test/useComposition.vitest.test.tsx
    record/
      component/RecordPanel.tsx
      data/recordData.ts
      hook/useRecord.ts
      store/recordStore.ts
      type/record.types.ts
      worker/RecordWorker.ts
      worker/recordWorkerClient.ts
      test/RecordPanel.vitest.test.tsx
      test/recordData.vitest.test.ts
      test/recordStore.vitest.test.ts
      test/recordWorker.vitest.test.ts
      test/useRecord.vitest.test.tsx
    redact/
      component/RedactPanel.tsx
      hook/useRedact.ts
      store/redactStore.ts
      type/redact.types.ts
      worker/RedactWorker.ts
      worker/redactWorkerClient.ts
      test/RedactPanel.vitest.test.tsx
      test/redactStore.vitest.test.ts
      test/redactWorker.vitest.test.ts
      test/useRedact.vitest.test.tsx
    manifest/
      component/ManifestPanel.tsx
      hook/useManifest.ts
      store/manifestStore.ts
      type/manifest.types.ts
      worker/ManifestWorker.ts
      worker/manifestWorkerClient.ts
      test/ManifestPanel.vitest.test.tsx
      test/manifestStore.vitest.test.ts
      test/manifestWorker.vitest.test.ts
      test/useManifest.vitest.test.tsx
```

`CapabilityLoading` is shared by all five features. `MetadataResult` is shared
only by compute and composition. `DeliveryNotice` is shared only by record,
redact, and manifest. `useLoadingMessages` is shared only by the three dialog
features.

## Source-to-Destination Map

Use the current files only as behavior sources. Translate them into the package
files above; do not copy their globals, EventBus access, imperative DOM
creation, host storage access, alerts, or worker bootstrap.

| Current source | Package destination |
| --- | --- |
| `document_web/src/domains/compute/api/computeWorker.js` | `features/compute/worker/ComputeWorker.ts` and `computeWorkerClient.ts` |
| `document_web/src/domains/compute/svc/compute_service.js` | `features/compute/hook/useCompute.ts`, store, panel, and tests |
| `document_web/src/domains/title/api/compositionWorker.js` | `features/composition/worker/CompositionWorker.ts` and `compositionWorkerClient.ts` |
| `document_web/src/domains/composition/svc/composition_service.js` | `features/composition/hook/useComposition.ts`, store, panel, and tests |
| `document_web/src/domains/record/api/recordWorker.js` | `features/record/worker/RecordWorker.ts` and `recordWorkerClient.ts` |
| `document_web/src/domains/record/svc/record_service.js` | `features/record/hook/useRecord.ts`, store, and processing tests |
| active preparation and summary behavior in `document_web/src/domains/record/svc/record_service.js` and `data/recorddatahelper.js` | `features/record/data/recordData.ts` |
| `document_web/src/domains/record/shell/recorddialog.js` | `features/record/component/RecordPanel.tsx` and shared styles |
| `document_web/src/domains/redact/api/redactWorker.js` | `features/redact/worker/RedactWorker.ts` and `redactWorkerClient.ts` |
| `document_web/src/domains/redact/svc/redact_service.js` | `features/redact/hook/useRedact.ts`, store, and processing tests |
| `document_web/src/domains/redact/shell/redactdialog.js` | `features/redact/component/RedactPanel.tsx` and shared styles |
| `document_web/src/domains/manifest/api/manifestWorker.js` | `features/manifest/worker/ManifestWorker.ts` and `manifestWorkerClient.ts` |
| `document_web/src/domains/manifest/svc/manifest_service.js` | `features/manifest/hook/useManifest.ts`, store, and processing tests |
| `document_web/src/domains/manifest/shell/manifestdialog.js` | `features/manifest/component/ManifestPanel.tsx` and shared styles |
| typing behavior in `document_web/src/domains/shared/shell/base/messagebar.js` | `shared/hook/useLoadingMessages.ts` and `CapabilityLoading.tsx` |
| metadata section behavior in the compute/composition controllers and legacy metadata renderer | `shared/component/MetadataResult.tsx` using the exported `aurorra-index` `MetadataPanel` |

Translate the active inline visual values from the three legacy dialog files
and their loading stacks into `shared/style/capabilityStyles.ts` without
redesign. Preserve widths, gaps, font sizes, colors, borders, padding,
alignment, responsive `35rem` record breakpoint, notice states, and action
disabled appearance. The package visual snapshots must prove that
transcription before the legacy files are deleted.

Do not port `RecordDataHelper.resolveBlobTargets`; its aliases are not used by
the active controller delivery callbacks. Do not port
`RecordDataHelper.prepareForRecording`; the active service's private
preparation formula is the source.

## Zustand State Contract

Each store file exports one bound Zustand hook created with `create`, matching
`aurora_refine`: `useComputeStore`, `useCompositionStore`, `useRecordStore`,
`useRedactStore`, or `useManifestStore`. Callers use the hook for React
selection and `.getState()` for actions. Do not add a second store API export
or keep parallel panel-local copies of request, result, failure, status, open
segment, visibility, or delivery notice state.

Every store contains:

- `request`
- `result`
- `failure`
- `status`
- `runningRequestId`
- `claimRequest(requestId)`
- `setLoading(requestId)`
- `setResult(requestId, result)`
- `setFailure(requestId, failure)`
- `clearSession(session)`
- `reset()`

Compute and composition also contain:

- `openSegment`
- `open(request, segments)`
- `setOpenSegment(segment)`

Record, redact, and manifest also contain:

- `visible`
- `open(request)`
- `close()`
- `reopen()`
- delivery notice state for that feature

State rules:

1. `open` first compares request IDs. For the same request ID, dialog stores
   set only `visible: true` and metadata stores make no state change. For a new
   request ID, `open` sets the request, clears prior result/failure/notice,
   sets `status: "loading"`, clears `runningRequestId`, sets dialog
   `visible: true` where applicable, and sets the metadata feature's configured
   default open segment. `useComputeStore.open(request, segments)` uses
   `segments.FEE`; `useCompositionStore.open(request, segments)` uses
   `segments.CHAIN`. Dialog stores use `open(request)`.
2. `claimRequest(requestId)` returns false unless the ID matches the current
   request, status is `loading`, and no request ID is running. Otherwise it
   records the matching ID and returns true. Every feature hook must claim
   before starting its worker sequence.
3. `setLoading`, `setResult`, and `setFailure` mutate state only when
   `requestId === state.request?.requestId`. Results from a cleared or replaced
   request are ignored.
4. `setResult` sets `status: "ready"` and clears `runningRequestId`.
   `setFailure` sets `status: "error"` and clears `runningRequestId`.
5. Dialog `close()` changes only `visible`; it does not clear or cancel an
   in-flight request.
6. Dialog `reopen()` changes `visible` to true only when a request exists.
7. `clearSession(session)` resets only when the current request belongs to that
   session.
8. `reset()` returns the complete store to its initial state.
9. The package starts one hook run per request ID. Rerenders, close/reopen, and
   repeated `open` with the same request ID must not duplicate network calls or
   terminal callbacks.
10. Closing or unmounting a dialog body does not cancel the claimed async
    sequence. Its captured terminal callbacks continue, and a reopened body
    cannot claim the same running request.
11. On success, the hook calls `setResult(requestId, result)` before
    `onComplete(terminal)`. On failure, it calls
    `setFailure(requestId, failure)` before `onError(failure)`. Invoke one
    terminal callback exactly once even when the matching store request was
    cleared while the async sequence continued.

## HTTP Contract

Implement direct `fetch` in `capabilityHttp.ts`; do not import the host worker
helper.

Match `aurora_refine` and normalize only the configured API base URL with
`apiBaseUrl.replace(/\/+$/, "")` before appending the exact routes below. Do
not normalize session, token, document, route segments, response values, or
poll interval.

For every request:

- set `Content-Type: application/json`
- set `Authorization: Bearer ${authToken}`
- set `cache: "no-store"`
- set `body` only for non-GET requests with the explicit non-null body defined
  below
- accept all 2xx responses
- parse the response as JSON
- treat a 2xx object with `success: false` as a failure
- accept success envelopes when `success` is `true` or omitted
- accept `status` and `data` from the existing envelope without renaming
- for non-2xx responses, preserve `code`, `message` or `error`, `details`, and
  HTTP status
- map a 401 payload without `code` but with a message to the existing
  unauthorized error contract
- map any other malformed non-2xx payload to
  `invalid_error_payload`
- do not double-stringify request bodies

If a 2xx response cannot be parsed as JSON, return `server_error` with the
native parse error message, matching the current utility-worker catch path.

Data parsing must match the current worker helper:

- object data is returned unchanged
- `null` becomes `{}`
- string data is trimmed and JSON parsed
- other primitive data becomes `{}`

The only exception is compute data, including record's compute-data call:
preserve an exact empty string as `""` instead of parsing it.

Create one module Web Worker client factory per feature. Each factory takes
`{ apiBaseUrl: string }`. Match `aurora_refine`: each client command creates
one feature worker with
`new Worker(new URL("./FeatureWorker.ts", import.meta.url), { type: "module" })`,
posts one command, settles one response, and terminates that worker on message
or error. The factory exposes:

- compute: `submit`, `status`, `data`
- composition: `submit`, `status`, `data`
- record: `status`, `computeData`, `submit`, `data`
- redact: `status`, `submit`, `data`
- manifest: `status`, `submit`, `data`

Every client method takes the token and session explicitly. Record `submit`
also takes the prepared metadata. Do not store tokens or sessions in workers.

## Route and Polling Contract

### Compute

Routes:

- `POST /v1/compute/{session}/calculate`, no body
- `GET /v1/compute/{session}/status`
- `GET /v1/compute/{session}/data`

Sequence:

1. Submit.
2. Read status.
3. If status is not complete, submit a second time.
4. Perform at most 27 wait/status iterations, waiting `intervalMs` before each
   status read.
5. Fail after the twenty-seventh incomplete iteration.
6. Read data only after completed status.

This produces at most 28 status calls. Status matching is case-sensitive:
`"error"` fails and `"completed"` completes. Preserve compute data `""`.

### Composition

Routes:

- `POST /v1/composition/{session}/link`, no body
- `GET /v1/composition/{session}/status`
- `GET /v1/composition/{session}/data`

Sequence:

1. Submit.
2. Read status.
3. Perform at most 27 wait/status iterations, waiting `intervalMs` before each
   status read.
4. Fail after the twenty-seventh incomplete iteration.
5. Read and parse data only after completed status.

Status matching is case-sensitive: `"error"` fails and `"completed"`
completes. An empty composition data string is a parsing failure.

### Record

Routes:

- `GET /v1/record/{session}/status`
- `GET /v1/compute/{session}/data`
- `POST /v1/record/{session}/endorsement`
- `GET /v1/record/{session}/data`

Sequence:

1. Read record status.
2. If status is already completed, skip compute data and submit.
3. Otherwise read compute data and require `heading`.
4. Set `heading.number` to
   `Math.floor(10000 + Math.random() * 90000).toString()`.
5. Set `heading.date` to `new Date().toISOString().split("T")[0]`.
6. Submit exactly:

```json
{
  "data": "<prepared metadata object>",
  "choices": {
    "pdf_confirmation": true,
    "pdf_record": true,
    "tif_record": false
  }
}
```

7. Perform at most 21 wait/status iterations, incrementing the iteration before
   waiting and reading status.
8. Read record data only after completed status.

Validate a record result as an object containing:

- `heading` object
- truthy `heading.class`
- truthy `heading.title`
- own `document` key
- own `cover` key

Preserve additional fields and the exact `document` and `cover` values. Match
the current worker by not adding content/type validation for those two values.
Do not accept `record` as an alias for `document` and do not derive blob names
from other fields.

Record status matching is case-sensitive: `"error"` fails and `"completed"`
completes. Apply the same failure-status handling to the submit response before
polling.

### Redact

Routes:

- `GET /v1/redact/{session}/status`
- `POST /v1/redact/{session}/mask` with body `{ "data": null }`
- `GET /v1/redact/{session}/data`

Sequence:

1. Read status.
2. Submit only when status is incomplete.
3. Perform at most 21 wait/status iterations.
4. Read data only after completed status.

Normalize redact status to lowercase. Both `"error"` and `"failed"` fail;
`"completed"` completes. Require a non-empty `pdf` string. The `pdf` value is
a storage blob name, not a URL.

### Manifest

Routes:

- `GET /v1/manifest/{session}/status`
- `POST /v1/manifest/{session}/report` with body `{}`
- `GET /v1/manifest/{session}/data`

Sequence:

1. Read status.
2. Submit only when status is incomplete.
3. Perform at most 21 wait/status iterations.
4. Read data only after completed status.

Status matching is case-sensitive: `"error"` fails and `"completed"`
completes. Require a non-empty `pdf` string. The `pdf` value is a direct URL,
not a storage blob name.

### Capability-owned failure messages

Use these exact timeout codes and messages:

| Capability | Code | Message |
| --- | --- | --- |
| compute | `COMPUTE_TIMEOUT` | `Compute is taking longer than expected, please refresh or start over.` |
| composition | `COMPOSITION_TIMEOUT` | `Chaining is taking longer than expected, please refresh or start over.` |
| record | `RECORD_TIMEOUT` | `Document endorsment is taking longer than expected, please refresh or start over.` |
| redact | `REDACT_TIMEOUT_REFRESH` | `Document redaction is taking longer than expected, please refresh or start over.` |
| manifest | `REPORT_TIMEOUT` | `Report generation timed out.` |

Use these current validation failures:

- record metadata without a heading before submit:
  `INVALID_JSON_INPUT_HEAD` /
  `Invalid JSON input: missing heading`
- record data that is not an object:
  `validation_error` /
  `Validation failed: Record is not a valid object.`
- record data missing `heading`, `cover`, or `document`:
  `validation_error` /
  `Validation failed: Missing required key: ${key}`
- record data with invalid heading:
  `validation_error` /
  `Validation failed: Invalid or missing 'heading' section.`
- redact data without a non-empty PDF:
  `RETRIEVE_METADATA_FAILED` /
  `Retrieve metadata failed.`
- manifest data without a non-empty PDF:
  `Manifest PDF is not available.`

Preserve the current service-layer error mapping:

- compute submit, status, and data use the worker/HTTP error directly
- composition submit and data use the worker/HTTP error directly
- composition status with service status `error` uses
  `COMPOSITION_ERR` /
  `An error occurred during composition: ${response.data.data}`
- record status, compute-data, and submit use the worker/HTTP error directly
- record data maps any worker/client rejection to
  `RETRIVE_METADATA_FAILED` /
  `Retrive metadata failed.`
- redact resolves
  `normalized.display`, `error`, `details.message`, `message`, then the
  operation fallback in that order; the fallbacks are
  `Redaction status check failed.`, `Redaction submit failed.`, and
  `Redaction data retrieval failed.`
- manifest prefixes the resolved worker error with
  `Manifest submit failed: `, `Manifest checkStatus failed: `, or
  `Manifest fetchData failed: ` for its matching operation

For compute, redaction, record non-data, and manifest service-status failures,
use a string `data` error first, then the response message, then the listed
operation fallback. Preserve HTTP and malformed-payload fields from
`capabilityHttp.ts`.

## React UI Contract

Use `aurorra-ui` for existing application primitives and Radix ScrollArea for
the record summary. Keep all feature visuals package-owned. Do not create host
DOM from the package.

### Shared loading behavior

Use the existing `aurorra-ui` progress bar in continuous mode with
`durationMs={request.intervalMs}`, `running`, and `visible`.

- Compute and composition show progress only and set `showText={false}`.
- Record, redact, and manifest show progress plus typed rotating messages.
- The first message appears after 50 ms.
- Each message's typing duration is
  `450 + Math.min(900, message.length * 35)`.
- Advance through the list at `intervalMs`.
- When consecutive raw messages are equal, display the later message with
  `"Still "` prepended.
- Stop on the final message.
- Clear all timers when the request changes or the component unmounts.

### Compute metadata

Render the exported `aurorra-index` `MetadataPanel`.

- map result `""` to `{}`; otherwise use the returned metadata object
- pass `getPanelData(metadata)` as `panelData`
- pass `choices={null}`
- pass stable empty `confirmedCodes` and `removedCodes` sets
- pass `selectedIndex={null}`
- map capability status `idle/loading/ready/error` to metadata status
  `idle/loading/success/error`
- pass the feature store's `openSegment` and `setOpenSegment`
- default open segment: `FEE`
- hide `CHAIN` and `HISTORY`
- show all remaining base sections without choice filtering
- show empty sections
- disable confirm, drop, refine, and reprocess actions
- pass only page, address, and legal callbacks
- do not expose index or segment mutation actions
- show shortcut underlines using the exact map below
- do not bind global keyboard shortcuts
- treat compute result `""` as empty metadata

### Composition metadata

Render the exported `aurorra-index` `MetadataPanel`.

- pass the returned metadata and `getPanelData(metadata)`
- pass `choices={null}`
- pass stable empty `confirmedCodes` and `removedCodes` sets
- pass `selectedIndex={null}`
- map capability status `idle/loading/ready/error` to metadata status
  `idle/loading/success/error`
- pass the feature store's `openSegment` and `setOpenSegment`
- default open segment: `CHAIN`
- hide `FEEFACTOR`, `FEE`, and `FUND`
- show all remaining base sections without choice filtering
- show empty sections
- disable confirm, drop, refine, and reprocess actions
- pass only page, address, and legal callbacks
- do not expose index or segment mutation actions
- show shortcut underlines using the exact map below
- do not access browser globals or bind keyboard listeners; export the ordered
  shortcut constant for the parent host to bind while composition is active

Use this exact shortcut map:

```text
CHAIN=Alt+C
HISTORY=Alt+K
FEEFACTOR=Alt+G
FEE=Alt+B
FUND=Alt+U
PAGE=Alt+A
SECRETS=Alt+C
TITLE=Alt+T
ENDORSEMENT=Alt+E
PARTY=Alt+P
REFERENCE=Alt+R
PROPERTY=Alt+X
LEGAL=Alt+L
MONETARY=Alt+M
ACKNOWLEDGMENT=Alt+N
VITAL=Alt+W
TRANSACTION=Alt+S
```

Store the renderer shortcut map as segment value to lowercase key:

```ts
new Map([
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
])
```

The parent host keyboard handler must process the exported array in listed
order so duplicate `Alt+C` resolves to `SECRETS`. Package component tests cover
the underlines; parent host tests cover browser key events.

### Record

Loading messages, in order:

1. `Retriving Indexes...`
2. `Analyzing Indexing...`
3. `Generating Endorsment page..`
4. `Annotating Pages...`
5. `Annotating Pages...`
6. `Retrieving Recording...`
7. `Retrieving Recording...`

Ready state:

- heading: `Recording Summary`
- maximum content width: `56rem`
- two-column summary grid; one column at widths up to `35rem`
- wrap the summary in Radix ScrollArea
- show Class with its first character uppercased and preserve the remaining
  characters
- show Title
- show Instrument # from `heading.number`
- show Recorded on from `heading.date`
- show Reference from the request session
- show Total only when the property exists; render `-` for `null`, otherwise
  `$${value}`
- show Status only when truthy
- show Queue Id only when truthy
- render an em dash for an empty displayed value
- actions: `Recorded Document`, separator `|`, `Cover Page (Receipt)`
- disable only the action currently delivering

Delivery notices:

- document start: `Downloading recorded document…`
- document success: `Recorded document downloaded.`
- document failure: `Failed to download recorded document.`
- cover start: `Preparing cover page (receipt)…`
- cover success: `Cover page (receipt) downloaded.`
- cover failure: `Failed to download cover page (receipt).`

The package calls the supplied callback with `result.document` or
`result.cover`. It does not construct storage paths.

Delivery start/success/failure changes only the delivery notice and clicked
action state. A delivery rejection does not call capability `onError`, does
not emit another processing terminal, and leaves capability status `ready`.

### Redact

Loading messages, in order:

1. `Retriving Confidential Information...`
2. `Analyzing Confidential Information...`
3. `Redacting Pages...`
4. `Redacting Pages...`
5. `Redacting Pages...`
6. `Retrieving Redacted Document...`
7. `Retrieving Redacted Document...`

Ready state:

- heading: `Redaction Ready`
- action: `Download Redacted PDF`
- start notice: `Preparing redacted PDF download...`
- success notice: `Redacted PDF downloaded.`
- failure notice: the exact error message thrown by the supplied delivery
  callback

The package calls the supplied callback with `result.pdf`. It does not treat
the blob name as a URL.

Delivery rejection changes only the notice and leaves processing status and
terminal state unchanged.

### Manifest

Loading messages, in order:

1. `Retriving Indexes...`
2. `Analyzing Indexing...`
3. `Generating IQ page..`
4. `Generating Index Pages...`
5. `Generating Index Pages...`
6. `Retrieving Manifest...`
7. `Retrieving Manifest...`

Ready state:

- heading: `Manifest Ready`
- action: `Download Manifest PDF`
- start notice: `Preparing manifest PDF download...`
- success notice: `Manifest PDF downloaded.`
- failure notice: the exact error message thrown by the supplied delivery
  callback

The package calls the supplied callback with the direct `result.pdf` URL.

Delivery rejection changes only the notice and leaves processing status and
terminal state unchanged.

## `aurorra_index` Prerequisite

Complete this prerequisite before implementing package metadata panels.

Modify:

- `aurorra_index/src/features/metdata/type/metadata.types.ts`
- `aurorra_index/src/features/metdata/component/MetadataPanel.tsx`
- `aurorra_index/src/features/metdata/component/MetadataRows.tsx`
- `aurorra_index/src/features/metdata/component/MetadataSegment.tsx`
- `aurorra_index/src/features/indexing/component/IndexContainer.tsx`
- `aurorra_index/src/public-api.ts`
- `aurorra_index/src/features/metdata/test/metadata-visual.vitest.test.tsx`
- `aurorra_index/src/features/metdata/test/MetadataPanel.addressmap.vitest.test.tsx`
- `aurorra_index/src/features/metdata/test/MetadataPanel.legalmap.vitest.test.tsx`
- `aurorra_index/src/features/indexing/test/IndexContainer.vitest.test.tsx`

Add:

- `aurorra_index/src/features/metdata/test/MetadataPanel.capability.vitest.test.tsx`

Export `MetadataPanel` and `MetadataPanelProps` from `src/public-api.ts`.

Change `MetadataPanelProps` as follows:

- remove `store`
- add required `status: MetadataStatus`
- make `onConfirm`, `onDrop`, and `onReprocess` optional
- add required:

```ts
actions: {
  confirm: boolean;
  drop: boolean;
  refine: boolean;
  reprocess: boolean;
};
sections: {
  filterByChoices: boolean;
  hiddenSegments: ReadonlySet<string>;
  showEmpty: boolean;
};
shortcuts: ReadonlyMap<string, string> | null;
```

Render an action only when its flag is true and its handler exists. Keep page,
address, legal, and copy behavior callback-driven. Capability panels pass no
`onEditPage`.

Make `MetadataRows` confirm/drop handlers optional. `MetadataPanel` passes a
handler only when the matching action flag is true. It renders the section
reprocess link only when `actions.reprocess` is true and `onReprocess` exists,
and renders `Refine or Chat` only when `actions.refine` is true and
`callbacks.onEditPage` exists.

Section behavior:

- `filterByChoices: true` preserves current choice-level filtering and current
  conditional fiscal/chain visibility.
- `filterByChoices: false` renders every base section without choice checks.
- `hiddenSegments` gates every section.
- `showEmpty: true` renders empty fiscal and chain sections with their current
  exact messages:
  - Fee Factors: `No fee factors found.`
  - Fees: `No fees found.`
  - Funds: `No fund distributions found.`
  - Chain: `No data found.`
  - History: `No history found.`

Treat a zero-length filtered fiscal array, zero-length chain array, missing
history, and zero-key history object as empty. With `showEmpty: false`, keep the
current behavior and omit those empty sections.

Add `shortcutKey` to `MetadataSegment`; underline the first case-insensitive
matching title character and leave the title unchanged when no character
matches.

Remove `imageViewerStoreApi.setRequest` from `openMetadataImage` in
`MetadataRows.tsx`; the direct renderer must invoke only `onPageClick`. In
`IndexContainer`, wrap its existing `onPageClick` callback and perform the
current image-viewer store request before invoking the original callback. This
keeps the existing index feature behavior while making `MetadataPanel`
host-independent.

`IndexContainer` must pass:

```ts
actions={{
  confirm: true,
  drop: true,
  refine: true,
  reprocess: true,
}}
sections={{
  filterByChoices: true,
  hiddenSegments: new Set(),
  showEmpty: false,
}}
shortcuts={null}
status={metadata.store.status}
```

Tests must prove:

- the existing index renderer still exposes and executes all current actions
- choice filtering and current empty-section behavior are unchanged in
  `IndexContainer`
- direct `MetadataPanel` page clicks do not mutate the image-viewer store
- `IndexContainer` page clicks still set the same image-viewer request and then
  invoke the host callback
- capability action flags hide all mutation links
- hidden segments, unfiltered sections, empty sections, status, and shortcut
  underlines follow the new explicit props
- existing address-map, legal-map, and metadata visual tests still pass

## Parent `document_web` Integration

The package implementation is incomplete until the parent host plan is
implemented.

The parent must:

- install `aurora-capabilities` from `file:../aurora_capabilities`
- alias the package source in Vite and Vitest and exclude it from Vite
  dependency optimization
- create five separate host features at `src/features/compute`,
  `src/features/composition`, `src/features/record`, `src/features/redact`, and
  `src/features/manifest`, following the current `document`, `intake`, `iq`,
  `audit`, and `refine` feature convention
- add `ComputeHost` and `CompositionHost` to the main metadata placement
- add `RecordHost`, `RedactHost`, and `ManifestHost` to the application dialog
  placement
- keep package panels, hooks, Zustand stores, workers, polling, and visual
  rendering in `aurora_capabilities`; host feature components only adapt
  application state, actions, callbacks, shell placement, alerts, and delivery
- do not create an aggregate `src/features/capabilities` host feature
- keep `showCompute` and `showComposition` under the workflow orchestrator
- bridge only `startRecord`, `startRedact`, and `downloadManifest` from
  EventBus to the feature-specific typed document actions
- pass session, document, token, API URL, polling interval, metadata callbacks,
  and delivery callbacks
- preserve compute/composition workflow completion timing
- persist truthy `record.document` and `record.cover` values in the current
  document store
- own alerts, dialog shell, storage delivery, and direct URL delivery
- delete the replaced five legacy domains and their dead bootstrap, worker,
  renderer, test, and static-entry references

Use
`document_web/docs/task/capabilities-host-migration-plan.md` as the complete
host file list and execution contract.

## Package Tests

### Worker tests

For every worker, test exact method, route, body, bearer header,
`Content-Type`, `cache: "no-store"`, success-without-`success`, explicit
`success: false`, malformed error payload, 401 mapping, parsed string data, and
object data.

Add feature sequence tests for:

- immediate completion
- processing then completion
- exact wait/status iteration limit
- timeout operation
- service error operation
- data validation failure operation
- no data read before completion
- no duplicate run for the same request ID

Add explicit tests for:

- compute's second submit after its first incomplete status
- compute's 28-status maximum
- compute's accepted empty-string result
- composition empty-string parse failure
- record completed-before-submit path
- record compute-data preparation, exact random number formula, UTC date, exact
  choices body, and 21-iteration limit
- record `document` and `cover` validation with no aliases
- redact lowercase status and both failure statuses
- redact blob-name result
- manifest case-sensitive status and direct-URL result

### Store and hook tests

For each feature, test:

- initial state
- open
- loading
- ready
- error
- matching-session clear
- different-session clear
- reset
- stale request ID rejection
- completion callback exactly once
- failure callback exactly once
- timer cleanup after unmount while a claimed async sequence remains single and
  still settles

For each dialog store, also test:

- close retains request and in-flight state
- reopen restores visibility
- same request reopen performs no duplicate worker call
- delivery notice and clicked-action state

### Component tests

Test every visible string and action described in this plan.

Compute and composition tests must cover:

- progress without text
- default segment
- visible and hidden sections
- empty sections
- no mutation actions
- page, address, and legal callbacks
- shortcut underlines
- absence of package browser-global keyboard access

Record, redact, and manifest tests must cover:

- ordered typed messages and duplicate `Still ` text
- exact ready heading and actions
- record summary labels, value formatting, optional fields, responsive column
  rule, and Radix ScrollArea
- one-action-at-a-time disabled state
- delivery start, success, and failure notices
- close/reopen while processing without cancellation or duplicate work

### Package visual test

Render deterministic states at `1440x900`:

- `compute-loading.png`
- `compute-ready.png`
- `composition-loading.png`
- `composition-ready.png`
- `record-loading.png`
- `record-ready.png`
- `record-document-notice.png`
- `record-cover-notice.png`
- `redact-loading.png`
- `redact-ready.png`
- `redact-delivery-notice.png`
- `manifest-loading.png`
- `manifest-ready.png`
- `manifest-delivery-notice.png`

Use fixed requests, metadata, record results, and worker doubles. Disable
animation only in the visual fixture. Snapshot every listed state.

## Implementation Order

1. Complete and validate the `aurorra_index` prerequisite.
2. Create package root configuration and boundary checker.
3. Implement shared types and HTTP handling.
4. Implement compute worker, store, hook, panel, and tests.
5. Implement composition worker, store, hook, panel, shortcuts, and tests.
6. Implement record data preparation, worker, store, hook, panel, and tests.
7. Implement redact worker, store, hook, panel, and tests.
8. Implement manifest worker, store, hook, panel, and tests.
9. Export the complete public API.
10. Add package visual fixtures and snapshots.
11. Implement the complete parent host plan.
12. Delete legacy code only after package and host tests pass.
13. Run all validation and browser gates.

## Validation

Run in `aurorra_index`:

```powershell
npm run typecheck
npm run lint:boundary
npm run test:vitest
npm run test:visual
npm run build
```

Run in `aurora_capabilities`:

```powershell
npm install
npm run typecheck
npm run lint:boundary
npm run test:vitest
npm run test:visual
npm run build
```

Run the full `document_web` validation listed in the parent plan.

Run boundary searches:

```powershell
rg -n "document_web|domains/|domains\\|\\b(EventBus|EVENTS|WorkerHelper|window|globalThis|localStorage|ENV)\\b|\\bdocument\\.(body|createElement|getElementById|querySelector|addEventListener|removeEventListener)|API\\." aurora_capabilities/src
rg -n "TODO|FIXME|stub|placeholder|compat|legacy|fallback" aurora_capabilities/src aurora_capabilities/test
$requiredFeatures = @("compute", "composition", "record", "redact", "manifest") | ForEach-Object { "aurora_capabilities/src/features/$_" }
$missingFeatures = $requiredFeatures | Where-Object { -not (Test-Path $_) }
if ($missingFeatures) { throw "Capability package features are missing: $($missingFeatures -join ', ')" }
```

The first search must return no matches. The second must return no introduced
unfinished, compatibility, legacy, or fallback implementation. The path gate
must prove all five package feature directories exist.

Inspect the integrated feature in the exact live in-app browser session at
`1440x900`. Verify compute and composition metadata layout, record/redact/
manifest loading and ready states, spacing, alignment, visibility, close,
shortcut, download, repeated-trigger, and in-flight reopen interactions.
Controlled Playwright results do not satisfy this live-session gate.

## Completion Report

Report exactly:

- files changed
- checks run
- functional test result
- blockers, if any

Do not report completion while any package, prerequisite, host, functional,
visual, live-browser, cleanup, or boundary gate is unverified.
