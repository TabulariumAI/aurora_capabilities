import { ConfButton, SuccessIcon, formatLabel, isAmbiguous, type MetadataFeeFactor, type MetadataFeeItem } from "aurora-core";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState, type JSX } from "react";
import { ComputeIcon } from "./ComputeIcon";
import { computeCss, computeStyles } from "../style/compute.styles";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import type {
  ComputePanelProps,
  ComputeResult,
} from "../../../shared/type/capability.types";

type FiscalSegmentProps = {
  currency: boolean;
  empty: string;
  items: readonly (MetadataFeeFactor | MetadataFeeItem)[];
  onOpen(segment: string): void;
  openSegment: string | null;
  segment: string;
  shortcut: string | null;
  title: string;
};

const currency = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});
function parseAmount(amount: string): number {
  return Number(amount.replaceAll("$", "").replaceAll(",", ""));
}
function formatCurrency(amount: string): string {
  return currency.format(parseAmount(amount));
}
function totalCents(items: readonly MetadataFeeItem[]): number {
  return items.reduce((total, item) => total + Math.round(parseAmount(item.amount) * 100), 0);
}

function FiscalRow({ item, currency }: { item: MetadataFeeFactor | MetadataFeeItem; currency: boolean }): JSX.Element {
  const [open, setOpen] = useState(false);
  const value = currency ? formatCurrency(item.amount) : item.amount;
  const label = formatLabel(item.name);
  const ambiguous = "ambiguous" in item && isAmbiguous(item.ambiguous);
  return (
    <Collapsible.Root asChild open={open} onOpenChange={setOpen}>
      <article className="compute-row" data-compute-code={item.code} data-status={ambiguous ? "warning" : "success"} style={computeStyles.row}>
        <span aria-label={ambiguous ? "Ambiguous" : "OK"} role="img" style={computeStyles.status}>
          {ambiguous ? <svg aria-hidden="true" fill="#f59e0b" height="12" viewBox="0 0 24 24" width="12"><circle cx="12" cy="12" r="12" /></svg> : <SuccessIcon />}
        </span>
        <span style={computeStyles.label}>{label}</span>
        <span className="compute-value" style={computeStyles.value}>{value}</span>
        <div aria-label={`${label} actions`} className="compute-row-actions" role="group" style={{ ...computeStyles.rowActions, ...(!currency ? computeStyles.factorActions : {}) }}>
          <ConfButton aria-label={`Copy value ${value}`} className="compute-icon" flat onConfirm={() => navigator.clipboard.writeText(value)} requireConfirmation={false} size="icon" style={{ ...computeStyles.iconAction, gridColumn: "1" }} title={`Copy value ${value}`}>
            <ComputeIcon name="copy" />
          </ConfButton>
          {"formula" in item ? (["Delete", "Edit"] as const).map(action => (
            <ConfButton aria-label={`${action} ${label}`} className="compute-icon" flat key={action} onConfirm={() => alert(`${action} ${label}: ${value}`)} size="icon" style={{ ...computeStyles.iconAction, gridColumn: action === "Delete" ? "2" : "3" }} title={`${action} ${label}`}>
              <ComputeIcon name={action === "Delete" ? "remove" : "edit"} />
            </ConfButton>
          )) : null}
          {"formula" in item || item.explanation ? <Collapsible.Trigger asChild>
            <ConfButton aria-label={`${open ? "Collapse" : "Expand"} details`} className="compute-icon" flat size="icon" style={{ ...computeStyles.iconAction, gridColumn: currency ? "4" : "2" }} title={`${open ? "Collapse" : "Expand"} details`}>
              <ComputeIcon name={open ? "collapse" : "expand"} />
            </ConfButton>
          </Collapsible.Trigger> : null}
        </div>
        {"formula" in item || item.explanation ? <Collapsible.Content style={computeStyles.detail}>
          {"formula" in item ? <div><strong style={computeStyles.detailLabel}>Formula:</strong> {item.formula}</div> : null}
          {item.explanation ? <div><strong style={computeStyles.detailLabel}>Explanation:</strong> {item.explanation}</div> : null}
        </Collapsible.Content> : null}
      </article>
    </Collapsible.Root>
  );
}

function FiscalSegment({
  currency,
  empty,
  items,
  onOpen,
  openSegment,
  segment,
  shortcut,
  title,
}: FiscalSegmentProps): JSX.Element {
  const visible = items.filter((item) => Number(item.amount) !== 0 || Boolean(item.explanation));
  const shortcutIndex = shortcut ? title.toLowerCase().indexOf(shortcut.toLowerCase()) : -1;

  return (
    <Collapsible.Root style={computeStyles.section}
      onOpenChange={(open) => {
        if (open) onOpen(segment);
      }}
      open={openSegment === segment}
    >
      <div style={computeStyles.header}>
        <Collapsible.Trigger asChild>
          <button style={computeStyles.trigger} type="button">
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" style={{ ...computeStyles.chevron, transform: openSegment === segment ? "rotate(90deg)" : "none" }}><path d="m9 6 6 6-6 6" /></svg>
            <span>{shortcutIndex >= 0 ? <>{title.slice(0, shortcutIndex)}<u>{title.slice(shortcutIndex, shortcutIndex + 1)}</u>{title.slice(shortcutIndex + 1)}</> : title}</span>
          </button>
        </Collapsible.Trigger>
        {currency ? <div aria-label={`${title} actions`} role="group" style={computeStyles.headerActions}>
          {(["Reprocess", "Clear", "Add"] as const).map(action => (
            <ConfButton aria-label={`${action} ${title}`} className="compute-icon" flat key={action} onConfirm={() => alert(`${action} ${title}`)} size="icon" style={computeStyles.iconAction} title={`${action} ${title}`}>
              <ComputeIcon name={action === "Reprocess" ? "reprocess" : action === "Clear" ? "clear" : "add"} />
            </ConfButton>
          ))}
        </div> : null}
        <span style={computeStyles.count}>{visible.length}</span>
      </div>
      <Collapsible.Content>
        <div style={computeStyles.items}>
          {visible.length ? visible.map((item, index) => <FiscalRow currency={currency} item={item} key={`${segment}-${index}`} />) : <div style={computeStyles.empty}>{empty}</div>}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function ComputeDetails({
  data,
  onEndorse,
  openSegment,
  segments,
  setOpenSegment,
  shortcuts,
}: Pick<ComputePanelProps, "onEndorse" | "segments"> & {
  data: ComputeResult;
  openSegment: string | null;
  setOpenSegment(segment: string): void;
  shortcuts: ReadonlyMap<string, string>;
}): JSX.Element {
  const fees = data.fees ?? [];
  const funds = data.funds ?? [];
  const feeTotal = totalCents(fees);
  const fundTotal = totalCents(funds);
  return (
    <section aria-label="Compute" style={computeStyles.root}>
      <style>{computeCss}</style>
      <div aria-label="Compute accordion" data-panel-scroll="true" role="region" style={computeStyles.accordion}>
        <FiscalSegment currency={false} empty="No fee factors found." items={data.fee_factors ?? []} onOpen={setOpenSegment} openSegment={openSegment} segment={segments.FEEFACTOR} shortcut={shortcuts.get(segments.FEEFACTOR) ?? null} title="Factors" />
        <FiscalSegment currency empty="No fees found." items={fees} onOpen={setOpenSegment} openSegment={openSegment} segment={segments.FEE} shortcut={shortcuts.get(segments.FEE) ?? null} title="Fees" />
        <FiscalSegment currency empty="No fund distributions found." items={funds} onOpen={setOpenSegment} openSegment={openSegment} segment={segments.FUND} shortcut={shortcuts.get(segments.FUND) ?? null} title="Funds" />
        <div aria-label="Compute total" role="group" style={{ ...computeStyles.row, ...computeStyles.total }}>
          <span style={{ ...computeStyles.label, gridColumn: "1 / 3" }}>Total</span>
          <span style={{ ...computeStyles.value, gridColumn: "3" }}>{currency.format(feeTotal / 100)}</span>
        </div>
        {feeTotal !== fundTotal ? <div role="alert" style={{ ...capabilityStyles.notice("error"), alignSelf: "center" }}>
          Fees ({currency.format(feeTotal / 100)}) and Funds ({currency.format(fundTotal / 100)}) do not match.
        </div> : null}
        <div aria-label="Compute actions" role="group" style={capabilityStyles.computeActions}>
          <ConfButton label="Endorse" onConfirm={onEndorse} />
        </div>
      </div>
    </section>
  );
}
