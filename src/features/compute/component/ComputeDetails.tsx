import { ConfButton, EmptyRow, MetadataRow, MetadataSegment, type MetadataFeeFactor, type MetadataFeeItem } from "aurora-core";
import type { JSX } from "react";
import { MetadataResult } from "../../../shared/component/MetadataResult";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import type {
  ComputePanelProps,
  ComputeResult,
  MetadataCapabilityCallbacks,
} from "../../../shared/type/capability.types";

type FiscalSegmentProps = {
  callbacks: MetadataCapabilityCallbacks;
  currency: boolean;
  empty: string;
  items: readonly (MetadataFeeFactor | MetadataFeeItem)[];
  onOpen(segment: string): void;
  openSegment: string | null;
  segment: string;
  session: string;
  shortcut: string | null;
  title: string;
};

const currency = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});
function formatCurrency(amount: string): string {
  return currency.format(Number(amount.replaceAll("$", "").replaceAll(",", "")));
}

function FiscalSegment({
  callbacks,
  currency,
  empty,
  items,
  onOpen,
  openSegment,
  segment,
  session,
  shortcut,
  title,
}: FiscalSegmentProps): JSX.Element {
  const visible = items.filter((item) => Number(item.amount) !== 0 || Boolean(item.explanation));

  return (
    <MetadataSegment
      count={visible.length}
      onOpenChange={(open) => {
        if (open) onOpen(segment);
      }}
      open={openSegment === segment}
      shortcutKey={shortcut}
      title={title}
    >
      {visible.length ? visible.map((item, index) => (
        <MetadataRow
          callbacks={callbacks}
          confirmed={false}
          details={"formula" in item ? [{ label: "Formula", value: item.formula }] : undefined}
          item={{
            ambiguous: "ambiguous" in item ? item.ambiguous : undefined,
            code: item.code,
            explanation: item.explanation,
            label: item.name,
            value: currency ? formatCurrency(item.amount) : item.amount,
          }}
          key={item.code ?? `${segment}-${index}`}
          selected={false}
          segment={segment}
          session={session}
        />
      )) : <EmptyRow message={empty} />}
    </MetadataSegment>
  );
}

export function ComputeDetails({
  callbacks,
  metadata,
  onEndorse,
  openSegment,
  segments,
  session,
  setOpenSegment,
  shortcuts,
}: Pick<ComputePanelProps, "callbacks" | "onEndorse" | "segments"> & {
  metadata: ComputeResult;
  openSegment: string | null;
  session: string;
  setOpenSegment(segment: string): void;
  shortcuts: ReadonlyMap<string, string>;
}): JSX.Element {
  const payload = metadata === "" ? {} : metadata;

  return (
    <MetadataResult
      callbacks={callbacks}
      hiddenSegments={new Set([
        segments.PAGE,
        segments.SECRETS,
        segments.TITLE,
        segments.ENDORSEMENT,
        segments.PARTY,
        segments.REFERENCE,
        segments.PROPERTY,
        segments.LEGAL,
        segments.MONETARY,
        segments.ACKNOWLEDGMENT,
        segments.TRANSACTION,
        segments.VITAL,
      ])}
      metadata={payload}
      openSegment={openSegment}
      segments={segments}
      session={session}
      setOpenSegment={setOpenSegment}
      shortcuts={shortcuts}
      status="ready"
    >
      <FiscalSegment callbacks={callbacks} currency={false} empty="No fee factors found." items={payload.fee_factors ?? []} onOpen={setOpenSegment} openSegment={openSegment} segment={segments.FEEFACTOR} session={session} shortcut={shortcuts.get(segments.FEEFACTOR) ?? null} title="Fee Factors" />
      <FiscalSegment callbacks={callbacks} currency empty="No fees found." items={payload.fees ?? []} onOpen={setOpenSegment} openSegment={openSegment} segment={segments.FEE} session={session} shortcut={shortcuts.get(segments.FEE) ?? null} title="Fees" />
      <FiscalSegment callbacks={callbacks} currency empty="No fund distributions found." items={payload.funds ?? []} onOpen={setOpenSegment} openSegment={openSegment} segment={segments.FUND} session={session} shortcut={shortcuts.get(segments.FUND) ?? null} title="Funds" />
      <div aria-label="Compute actions" role="group" style={capabilityStyles.computeActions}>
        <ConfButton label="Endorse" onConfirm={onEndorse} />
      </div>
    </MetadataResult>
  );
}
