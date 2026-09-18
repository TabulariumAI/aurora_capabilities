import { getPanelData, MetadataPanel, type MetadataSegments, type MetadataPayload } from "aurora-core";
import type { JSX, ReactNode } from "react";
import type { CapabilityStatus, MetadataCapabilityCallbacks } from "../type/capability.types";
import { capabilityStyles } from "../style/capabilityStyles";

const emptySet = new Set<string>();

const statusMap = {
  idle: "idle",
  loading: "loading",
  ready: "success",
  error: "error",
} as const;

export function MetadataResult({
  callbacks,
  children,
  hiddenSegments,
  metadata,
  openSegment,
  segments,
  session,
  setOpenSegment,
  shortcuts,
  status,
}: {
  callbacks: MetadataCapabilityCallbacks;
  children: ReactNode;
  hiddenSegments: ReadonlySet<string>;
  metadata: MetadataPayload | "";
  openSegment: string | null;
  segments: MetadataSegments;
  session: string;
  setOpenSegment(segment: string): void;
  shortcuts: ReadonlyMap<string, string>;
  status: CapabilityStatus;
}): JSX.Element {
  const payload = metadata === "" ? {} : metadata;
  return (
    <div style={capabilityStyles.metadataShell}>
      <MetadataPanel
        actions={{
          confirm: false,
          drop: false,
          reprocess: false,
        }}
        callbacks={callbacks}
        choices={null}
        confirmedCodes={emptySet}
        metadata={payload}
        openSegment={openSegment}
        panelData={getPanelData(payload)}
        removedCodes={emptySet}
        sections={{
          filterByChoices: false,
          hiddenSegments,
          showEmpty: true,
        }}
        selectedIndex={null}
        showContext={false}
        segments={segments}
        session={session}
        setSectionOpen={(segment, open) => {
          if (open) setOpenSegment(segment);
        }}
        shortcuts={shortcuts}
        status={statusMap[status]}
      >
        {children}
      </MetadataPanel>
    </div>
  );
}
