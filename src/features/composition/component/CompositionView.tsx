import { EmptyRow, MetadataRow, MetadataSegment, type MetadataDetail } from "aurora-core";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useEffect, useState, type JSX } from "react";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import { workerError } from "../../../shared/worker/capabilityHttp";
import { ProgressView } from "../../progressview/component/ProgressView";
import type { ProgressJob } from "../../progressview/type/progress.types";
import {
  COMPOSITION_SEGMENTS,
  type CompositionPanelProps,
  type CompositionBatch,
  type CompositionResult,
  type CompositionWorkerClient,
} from "../../../shared/type/capability.types";

export function CompositionView({
  callbacks,
  metadata,
  onError,
  onLinkBatch,
  onViewBatch,
  openSegment,
  requestId,
  session,
  setOpenSegment,
  shortcuts,
  token,
  workerClient,
}: Pick<CompositionPanelProps, "callbacks" | "onError" | "onLinkBatch" | "onViewBatch"> & {
  metadata: CompositionResult;
  openSegment: string | null;
  requestId: string;
  session: string;
  setOpenSegment(segment: string): void;
  shortcuts: ReadonlyMap<string, string>;
  token: string;
  workerClient: CompositionWorkerClient;
}): JSX.Element {
  const [saving, setSaving] = useState(false);
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [linkedBatch, setLinkedBatch] = useState<CompositionBatch | null>(null);
  const [linkJob, setLinkJob] = useState<ProgressJob | null>(null);
  const batchJobId = `${requestId}-batch-link`;
  const chain = metadata.chain ?? [];
  const history = metadata.history;
  const historyRows: Array<{
    details: MetadataDetail[];
    explanation?: string;
    key: string;
    label: string;
    value?: string;
  }> = [
    ...(history?.conveyance ?? []).map((item, index) => ({
      details: [
        { label: "Date", value: item.date },
        { label: "Grantors", value: item.grantors },
        { label: "Title Company", value: item.title_company },
        { label: "Amount", value: item.amount },
      ],
      explanation: item.explanation,
      key: `conveyance-${index}`,
      label: "Conveyance",
      value: item.grantees,
    })),
    ...(history?.mortgage ?? []).map((item, index) => ({
      details: [
        { label: "Date", value: item.date },
        { label: "Lender", value: item.lender },
        { label: "Amount", value: item.amount },
        { label: "Status", value: item.status },
      ],
      explanation: item.explanation,
      key: `mortgage-${index}`,
      label: "Mortgage",
      value: item.borrowers,
    })),
    ...(history?.encumbrance ?? []).map((item, index) => ({
      details: [
        { label: "Date", value: item.date },
        { label: "Type", value: item.enc_type },
        { label: "Amount", value: item.amount },
        { label: "Status", value: item.status },
      ],
      explanation: item.explanation,
      key: `encumbrance-${index}`,
      label: "Encumbrance",
      value: item.parties,
    })),
  ];

  useEffect(() => {
    let canceled = false;
    void workerClient.options(token, session).then((names) => {
      if (canceled) return;
      setBatchNames(names);
    }).catch((error) => {
      if (canceled) return;
      onError({
        capability: "composition",
        error: workerError(error, "Composition request failed."),
        operation: "options",
        requestId,
        session,
      });
    });
    return () => {
      canceled = true;
    };
  }, [onError, requestId, session, token, workerClient]);

  const linkBatch = async () => {
    setLinkedBatch(null);
    setSaving(true);
    setLinkJob(null);
    try {
      const batch = await onLinkBatch("user", batchNames);
      if (batch) {
        setLinkedBatch(batch);
        setLinkJob({ jobId: batchJobId, message: "Session linked to batch.", phase: "completed" });
      }
    } catch (error) {
      setLinkJob({
        error: workerError(error, "Batch link failed.").error,
        jobId: batchJobId,
        message: "Batch link failed.",
        phase: "failed",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tooltip.Provider delayDuration={250}>
      <section aria-label="Composition" style={capabilityStyles.composition}>
        <div aria-label="Composition accordion" data-panel-scroll="true" role="region" style={capabilityStyles.compositionAccordion}>
        <MetadataSegment
          count={chain.length}
          onOpenChange={(open) => {
            if (open) setOpenSegment(COMPOSITION_SEGMENTS.CHAIN);
          }}
          open={openSegment === COMPOSITION_SEGMENTS.CHAIN}
          shortcutKey={shortcuts.get(COMPOSITION_SEGMENTS.CHAIN) ?? null}
          title="Chain"
        >
          {chain.length ? chain.map((item, index) => (
            <MetadataRow
              callbacks={callbacks}
              confirmed={false}
              details={[
                { label: "Date", value: item.date },
                { label: "Role", value: item.role },
                { label: "Required", value: item.required },
                { label: "Address", value: item.address },
                { label: "Parcel", value: item.number },
                { label: "Plats Ref", value: item.platsref },
                { label: "Docs Ref", value: item.docsref },
                { label: "Lot/Blocks", value: item.lotblocks },
                { label: "Metes/Bounds", value: item.metesbounds },
                { label: "PLSS", value: item.plss },
                { label: "Session", value: item.session },
                { label: "Status", value: item.status },
                ...(item.identifiers ?? []).map((identifier) => ({ label: identifier.key, value: identifier.value })),
              ]}
              item={{
                code: item.code,
                explanation: item.explanation,
                label: item.class,
                page: item.page,
                source: item.source,
                value: item.title,
              }}
              key={item.code ?? `chain-${index}`}
              selected={false}
              segment={COMPOSITION_SEGMENTS.CHAIN}
              session={session}
            />
          )) : <EmptyRow message="No data found." />}
        </MetadataSegment>
        <MetadataSegment
          count={historyRows.length}
          onOpenChange={(open) => {
            if (open) setOpenSegment(COMPOSITION_SEGMENTS.HISTORY);
          }}
          open={openSegment === COMPOSITION_SEGMENTS.HISTORY}
          shortcutKey={shortcuts.get(COMPOSITION_SEGMENTS.HISTORY) ?? null}
          title="History"
        >
          {historyRows.length ? historyRows.map((item) => (
            <MetadataRow
              callbacks={callbacks}
              confirmed={false}
              details={item.details}
              item={{ explanation: item.explanation, label: item.label, value: item.value }}
              key={item.key}
              selected={false}
              segment={COMPOSITION_SEGMENTS.HISTORY}
              session={session}
            />
          )) : <EmptyRow message="No history found." />}
        </MetadataSegment>
        </div>
        {linkJob ? (
          <ProgressView
            completion={linkedBatch ? (
              <button onClick={() => onViewBatch(linkedBatch)} style={capabilityStyles.primaryButton} type="button">View batch</button>
            ) : undefined}
            completionJobId={batchJobId}
            fillCompletion={false}
            intro="I’ll keep you updated while I link the session to a batch."
            jobs={[linkJob]}
            process="LINKING DOCUMENT TO BATCH"
          />
        ) : null}
        {linkedBatch ? null : (
          <div aria-label="Composition actions" role="group" style={capabilityStyles.batchActions}>
            <button
              disabled={saving}
              onClick={() => void linkBatch()}
              style={{
                ...capabilityStyles.primaryButton,
                ...(saving ? capabilityStyles.disabled : {}),
              }}
              type="button"
            >
              Link to batch
            </button>
          </div>
        )}
      </section>
    </Tooltip.Provider>
  );
}
