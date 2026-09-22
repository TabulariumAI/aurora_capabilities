import type { MetadataCallbacks, MetadataSegments, MetadataPayload } from "aurora-core";

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
export type CompositionOperation = "submit" | "status" | "data" | "options";
export type RecordOperation = "status" | "compute-data" | "submit" | "data";
export type RedactOperation = "status" | "submit" | "data";
export type ManifestOperation = "status" | "submit" | "data";

export type ComputeResult = MetadataPayload | "";
export type CompositionResult = Pick<MetadataPayload, "chain" | "history">;
export type CompositionBatch =
  | { group: "user"; batch: { code: string; id: string; name: string } }
  | { group: "sub"; batch: { name: string } };

export const COMPOSITION_SEGMENTS = {
  CHAIN: "chain",
  HISTORY: "history",
} as const;

export type CapabilityData = Record<string, unknown>;

export type RecordResult = CapabilityData;
export type RedactResult = CapabilityData;
export type ManifestResult = CapabilityData;

export type CapabilityRequestBase = {
  document: string;
  authToken: string;
  documentApiGatewayUrl: string;
  intervalMs: number;
  requestId: string;
  session: string;
};

export type ComputeRequest = CapabilityRequestBase & { capability: "compute" };
export type CompositionRequest = CapabilityRequestBase & { capability: "composition" };
export type RecordRequest = CapabilityRequestBase & {
  capability: "record";
};
export type RedactRequest = CapabilityRequestBase & {
  capability: "redact";
};
export type ManifestRequest = CapabilityRequestBase & { capability: "manifest" };

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
export type CompositionFailure = CapabilityFailure<"composition", CompositionOperation>;
export type RecordFailure = CapabilityFailure<"record", RecordOperation>;
export type RedactFailure = CapabilityFailure<"redact", RedactOperation>;
export type ManifestFailure = CapabilityFailure<"manifest", ManifestOperation>;

export type CapabilityComplete<N extends CapabilityName, R> = {
  capability: N;
  outcome: "completed";
  requestId: string;
  result: R;
  session: string;
};

export type CapabilityFailed<N extends CapabilityName, O extends string> =
  CapabilityFailure<N, O> & {
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
  MetadataCallbacks,
  "onAddressClick" | "onLegalView" | "onPageClick"
>;

export const COMPOSITION_SHORTCUTS = [
  { key: "c", segment: COMPOSITION_SEGMENTS.CHAIN },
  { key: "k", segment: COMPOSITION_SEGMENTS.HISTORY },
] as const;

export const CAPABILITY_SHORTCUTS = [
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
  segment: keyof MetadataSegments;
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
  options(token: string, session: string): Promise<string[]>;
};

export type RecordWorkerClient = {
  status(token: string, session: string): Promise<CapabilityPoll>;
  computeData(token: string, session: string): Promise<ComputeResult>;
  submit(token: string, session: string, metadata: MetadataPayload): Promise<CapabilityPoll>;
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
  onComplete: (terminal: CapabilityComplete<"compute", ComputeResult>) => void;
  onEndorse: () => void;
  onError: (failure: ComputeFailure) => void;
  request: ComputeRequest;
  segments: MetadataSegments;
  workerClient?: ComputeWorkerClient;
};

export type CompositionPanelProps = {
  canLink: boolean;
  callbacks: MetadataCapabilityCallbacks;
  onComplete: (terminal: CapabilityComplete<"composition", CompositionResult>) => void;
  onError: (failure: CompositionFailure) => void;
  onLinkBatch: (group: "user", names: readonly string[]) => Promise<CompositionBatch | null>;
  onViewBatch: (batch: CompositionBatch) => void;
  request: CompositionRequest;
  workerClient?: CompositionWorkerClient;
};

export type RecordPanelProps = {
  onComplete: (terminal: CapabilityComplete<"record", RecordResult>) => void;
  onError: (failure: RecordFailure) => void;
  request: RecordRequest;
  workerClient?: RecordWorkerClient;
};

export type RedactPanelProps = {
  onComplete: (terminal: CapabilityComplete<"redact", RedactResult>) => void;
  onError: (failure: RedactFailure) => void;
  request: RedactRequest;
  workerClient?: RedactWorkerClient;
};

export type ManifestPanelProps = {
  onComplete: (terminal: CapabilityComplete<"manifest", ManifestResult>) => void;
  onError: (failure: ManifestFailure) => void;
  request: ManifestRequest;
  workerClient?: ManifestWorkerClient;
};

export type WorkerConfig = {
  apiBaseUrl: string;
};
