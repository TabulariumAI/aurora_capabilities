import type { MetadataSegments, ResourceRequest } from "aurora-core";
import type { CapabilityRequest, CapabilityTerminal, ComputeFailure, CompositionFailure, RecordFailure, RedactFailure, ManifestFailure } from "../type/capability.types";
import { runCompute } from "../../features/compute/worker/runCompute";
import { runComposition } from "../../features/composition/worker/runComposition";
import { runRecord } from "../../features/record/worker/runRecord";
import { runRedact } from "../../features/redact/worker/runRedact";
import { runManifest } from "../../features/manifest/worker/runManifest";

export type CapabilityStart = {
  request: CapabilityRequest;
  segments: MetadataSegments;
  onResource(request: ResourceRequest): void;
  onTerminal(terminal: CapabilityTerminal): void;
};

export function startCapability({ request, segments, onResource, onTerminal }: CapabilityStart): void {
  const callbacks = {
    onComplete: onTerminal,
    onError(failure: ComputeFailure | CompositionFailure | RecordFailure | RedactFailure | ManifestFailure) {
      onTerminal({ ...failure, outcome: "failed" });
    },
  };
  switch (request.capability) {
    case "compute": runCompute({ ...callbacks, request, segments, onResource }); break;
    case "composition": runComposition({ ...callbacks, request }); break;
    case "record": runRecord({ ...callbacks, request }); break;
    case "redact": runRedact({ ...callbacks, request }); break;
    case "manifest": runManifest({ ...callbacks, request }); break;
  }
}
