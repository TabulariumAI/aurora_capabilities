# Contributing

## Requirements

- Node.js 22
- npm
- A sibling `aurora_core` checkout

## Local checks

```sh
npm install
npm run test:vitest
npm run typecheck
npm run lint:boundary
npm run build
npm run test:visual
```

## Guidelines

- Preserve host ownership of authentication, API gateway configuration, document/batch/session context, and framing.
- Keep compute, composition, record, redact, manifest, and title-report behavior in their existing feature areas.
- Keep title-report session linking, generation, state, and report presentation in the title-report feature; use the shared progress hook and polling implementation.
- Add or update tests for behavior changes.
- Do not commit generated build output, coverage, test results, package tarballs, credentials, live storage URLs, or customer documents.
