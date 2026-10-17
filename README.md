# Aurora Capabilities

Aurora Capabilities provides React components for document computation, composition, recording, redaction, and manifest workflows in the Tabularium AI platform.

It is a host-integrated package. The host provides authentication, API gateway configuration, document/session context, and presentation framing. Aurora service implementations, credentials, customer documents, and live storage URLs are not included.

## Features

- Compute document capability results
- Compute owns Factors, Fees, and Funds. Fee/fund actions follow Copy, Delete, Expand. Expand shows the formula and explanation; confirmed Delete queues a model change.
- Compute displays Total below Funds regardless of the expanded section. It sums fee amounts and shows an error below Total when the separately calculated fund total differs.
- Compose document outputs
- Record and download confirmation, PDF, and TIFF outputs
- Redact document outputs
- Generate and download manifests

## Requirements

- Node.js 22
- npm
- A sibling `aurora_core` checkout, which provides the local `aurora-core` dependency used during development

## Install

```sh
npm install
```

## Use

The package exports `ComputePanel`, `CompositionPanel`, `RecordPanel`, `RedactPanel`, and `ManifestPanel`, together with their hooks, stores, worker clients, and types.

```tsx
import { ComputePanel, RedactPanel } from "aurora-capabilities";
```

See the exported prop types in [`src/public-api.ts`](src/public-api.ts). The host must supply valid credentials and compatible gateway endpoints.

The polling budget is 7.5 seconds per progress step, independently of the polling interval. The host polls every 500 ms. Manifest, recording, and redaction retain their 157.5-second waiting budgets; computation and composition retain 202.5 seconds.

Compute's `onAddFee(anchor)` callback opens the host callout containing `AddFiscalPanel` with `segment="fees"`. The panel loads the model ETag and queues the literal Fee Value, then calls `onQueued` after IndexedDB storage to close. Checking the dedicated-fund checkbox copies Fee Name with ` Fund` appended into the editable Fund Name. The dedicated fund always uses Fee Value. Add requires Fee Name and Fee Value, plus Fund Name when the checkbox is checked. The shared aurora-core form styles and centered Add control match Add index.

`onAddFund(anchor)` opens the same shared form with `segment="funds"`: required Fund Name and Fund Value, a centered Add action, and host-owned Close. It inserts the fund first without creating a fee. Both variants share loading, validation, queue acceptance, and aurora-core form controls. Scoped Zustand stores own the form and row disclosure state. Model loads ignore responses from a superseded request; queue acceptance locks the form synchronously and updates its disabled controls.

Fund rows use aurora-core drag handles and Move up/Move down controls. Additions, deletions, and fund reordering update the local model and immediately recalculate fees and allocations using TypeScript evaluation of the existing arithmetic, comparison, and Rhai `if/else` formulas. Monetary rounding, fee dependencies, and remaining fund limits match the Rust calculation flow.

`computeQueueStore` persists saved models, results, and unsaved changes in owner-scoped IndexedDB. The host awaits restoration before opening a restored workspace. Save sends all buffered operations in one conditional JSON Patch through `user_svc`; `document_svc` writes the next `compute/out/model#vN.json`. Cancel restores the saved state without a mutation. Both controls remain visible and disabled when unchanged or saving. Failed saves retain the local draft. Tokens and clients remain runtime-only, and restoration never submits changes automatically. Endorse is disabled while a draft remains unsaved.

The host retains ownership of Compute Hub events. First-time endorsement shows server computation followed by endorsement in the existing ProgressView. A completed or running endorsement is reused without starting another one. Computation-result ETag verification is absent; model saves retain `ETag`/`If-Match` conflict protection.

## Development

```sh
npm install
npm run test:vitest
npm run typecheck
npm run lint:boundary
npm run build
npm run test:visual
```

`npm run test:visual` requires the configured Playwright browsers.

## Public Repository Notes

Do not commit credentials, authorization headers, SAS tokens, generated build output, test results, coverage, local environment files, live storage URLs, or customer documents. Test fixtures must use non-routable URLs.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
