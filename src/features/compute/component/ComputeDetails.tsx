import { formStyles, useDragOrder, OrderButtons, type OrderButtonsProps, ConfButton, iconButtonStyle, SuccessIcon, formatLabel, isAmbiguous, type MetadataFeeFactor, type MetadataFeeItem } from "aurora-core";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useId, type HTMLAttributes, type ReactNode, type JSX } from "react";
import { computeQueueStore, type ComputeTask } from "../store/computeQueueStore";
import { useDetailStore } from "../store/fiscalStore";
import { ComputeIcon } from "./ComputeIcon";
import { computeCss, computeStyles } from "../style/compute.styles";
import { capabilityStyles } from "../../../shared/style/capabilityStyles";
import type {
  ComputePanelProps,
  ComputeResult,
} from "../../../shared/type/capability.types";

type FiscalSegmentProps = {
  currency: boolean;
  session: string;
  collection: "fees" | "funds" | null;
  empty: string;
  items: readonly (MetadataFeeFactor | MetadataFeeItem)[];
  onAddFee(anchor: HTMLElement): void;
  onAddFund(anchor: HTMLElement): void;
  onOpen(segment: string): void;
  openSegment: string | null;
  segment: string;
  shortcut: string | null;
  title: string;
};

const currencyFormat = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});
function parseAmount(amount: string): number {
  return Number(amount.replaceAll("$", "").replaceAll(",", ""));
}
function totalCents(items: readonly MetadataFeeItem[]): number {
  return items.reduce((total, item) => total + Math.round(parseAmount(item.amount) * 100), 0);
}

function FiscalRow({ item, currency, session, collection, task, pending, order, drag }: { item: MetadataFeeFactor | MetadataFeeItem; currency: boolean; session: string; collection: "fees" | "funds" | null; task?: ComputeTask; pending: boolean; order?: Omit<OrderButtonsProps, "label">; drag?: { handle: ReactNode; props: HTMLAttributes<HTMLElement> } }): JSX.Element {
  const { open, setOpen } = useDetailStore();
  const added = computeQueueStore(state => state.tasks.some(task => task.session === session && task.change.action === "add" && (collection === "fees" ? "fee" in task.change && task.change.fee.name === item.name : "fund" in task.change ? task.change.fund.name === item.name : task.change.fee.fund?.name === item.name)));
  const value = currency ? currencyFormat.format(parseAmount(item.amount)) : item.amount;
  const label = formatLabel(item.name);
  const ambiguous = "ambiguous" in item && isAmbiguous(item.ambiguous);
  const status = task?.status === "failed" ? "Save failed" : task?.status === "processing" ? "Saving" : ambiguous ? "Ambiguous" : "No ambiguity reported";
  return (
    <Collapsible.Root asChild open={open} onOpenChange={setOpen}>
      <article {...drag?.props} className="compute-row" data-compute-code={item.code} data-status={task?.status === "failed" ? "failed" : task?.status === "processing" ? "pending" : ambiguous ? "warning" : "success"} style={{ ...computeStyles.row, ...drag?.props.style, ...(task?.status === "failed" ? computeStyles.failedRow : {}) }}>
        <span aria-label={status} title={status} role="img" style={computeStyles.status}>
          {task?.status === "failed" || task?.status === "processing" || ambiguous ? <svg aria-hidden="true" fill={task?.status === "failed" ? "#dc2626" : "#f59e0b"} height="12" viewBox="0 0 24 24" width="12"><circle cx="12" cy="12" r="12" /></svg> : <SuccessIcon />}
        </span>
        <span style={{ ...computeStyles.label, ...(drag ? computeStyles.dragLabel : {}) }}>{drag?.handle}<span>{label}{added ? <small style={computeStyles.added}>Added</small> : null}</span></span>
        <span className="compute-value" style={computeStyles.value}>{value}</span>
        <div aria-label={`${label} actions`} className="compute-row-actions" role="group" style={{ ...computeStyles.rowActions, ...(currency ? computeStyles.currencyActions : computeStyles.factorActions) }}>
          <ConfButton aria-label={`Copy value ${value}`} className="compute-icon" flat onConfirm={() => navigator.clipboard.writeText(value)} requireConfirmation={false} size="icon" style={{ ...computeStyles.iconAction, ...computeStyles.secondaryAction, gridColumn: "1" }} title={`Copy value ${value}`}>
            <ComputeIcon name="copy" />
          </ConfButton>
          {collection && "formula" in item ? <ConfButton aria-label={`Delete ${label}`} className="compute-icon" flat disabled={pending} onConfirm={() => { void computeQueueStore.getState().enqueue(session, { action: "remove", segment: collection!, item }).catch(() => undefined); }} size="icon" style={{ ...computeStyles.iconAction, ...computeStyles.deleteAction, gridColumn: "2" }} title={`Delete ${label}`}>
            <ComputeIcon name="remove" />
          </ConfButton> : null}
          {"formula" in item || item.explanation ? <Collapsible.Trigger asChild>
            <ConfButton aria-label={`${open ? "Collapse" : "Expand"} details`} className="compute-icon" flat size="icon" style={{ ...computeStyles.iconAction, gridColumn: currency ? "3" : "2" }} title={`${open ? "Collapse" : "Expand"} details`}>
              <ComputeIcon name={open ? "collapse" : "expand"} />
            </ConfButton>
          </Collapsible.Trigger> : null}
          {order ? <div className="compute-order-actions" style={computeStyles.orderActions}><OrderButtons label={label} {...order} /></div> : null}
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
  session,
  collection,
  empty,
  items,
  onAddFee,
  onAddFund,
  onOpen,
  openSegment,
  segment,
  shortcut,
  title,
}: FiscalSegmentProps): JSX.Element {
  const tasks = computeQueueStore(state => state.tasks);
  const pending = tasks.some(task => task.session === session && task.status === "processing");
  const visible = items.filter((item) => Number(item.amount) !== 0 || Boolean(item.explanation));
  const rows = visible.map(item => ({ item, task: [...tasks].reverse().find(task => task.session === session && task.change.action !== "add" && task.change.segment === collection && task.change.item.name === item.name && task.change.item.formula === ("formula" in item ? item.formula : undefined)) }));
  const move = (from: number, to: number) => { void computeQueueStore.getState().enqueue(session, { action: "move", segment: "funds", item: rows[from].item as MetadataFeeItem, target: rows[to].item as MetadataFeeItem }).catch(() => undefined); };
  const drag = useDragOrder({ keys: rows.map(({ item }) => `${item.code}-${item.name}`), disabled: () => collection !== "funds" || pending, onMove: move });
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
        {currency ? <div aria-label={`${title} subtotal`} role="group" style={computeStyles.subtotal}>{currencyFormat.format(totalCents(items as readonly MetadataFeeItem[]) / 100)}</div> : null}
        {currency ? <div aria-label={`${title} actions`} role="group" style={computeStyles.headerActions}>
          <button disabled={pending} aria-label={`Add ${title}`} className="compute-icon" onClick={event => (collection === "fees" ? onAddFee : onAddFund)(event.currentTarget)} style={{ ...iconButtonStyle, ...computeStyles.iconAction }} title={collection === "fees" ? "Add Fee" : "Add Fund"} type="button"><ComputeIcon name="add" /></button>
        </div> : null}
        <span style={computeStyles.count}>{visible.length}</span>
      </div>
      <Collapsible.Content>
        <div style={computeStyles.items}>
          {rows.length ? rows.map(({ item, task }, index) => <FiscalRow pending={pending} collection={collection} session={session} task={task} currency={currency} item={item} key={`${segment}-${item.code}-${item.name}`} drag={collection === "funds" ? { handle: drag.handle(index, formatLabel(item.name)), props: drag.rowProps(index) } : undefined} order={collection === "funds" ? {
            first: index === 0,
            last: index === rows.length - 1,
            disabled: pending,
            onMove: direction => move(index, index + direction),
          } : undefined} />) : <div style={computeStyles.empty}>{empty}</div>}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function ComputeDetails({
  data,
  session,
  onAddFee,
  onAddFund,
  onEndorse,
  openSegment,
  segments,
  setOpenSegment,
  shortcuts,
}: Pick<ComputePanelProps, "onAddFee" | "onAddFund" | "onEndorse" | "segments"> & {
  data: ComputeResult;
  session: string;
  openSegment: string | null;
  setOpenSegment(segment: string): void;
  shortcuts: ReadonlyMap<string, string>;
}): JSX.Element {
  const saveStatusId = useId();
  const dirty = computeQueueStore(state => state.tasks.some(task => task.session === session));
  const pending = computeQueueStore(state => state.tasks.some(task => task.session === session && task.status === "processing"));
  const error = computeQueueStore(state => state.error ?? state.tasks.find(task => task.session === session && task.error)?.error);
  const fees = data.fees ?? [];
  const funds = data.funds ?? [];
  const feeTotal = totalCents(fees);
  const fundTotal = totalCents(funds);
  const balanced = feeTotal === fundTotal;
  return (
    <section aria-label="Compute" style={computeStyles.root}>
      <style>{computeCss}</style>
      <div aria-label="Compute accordion" data-panel-scroll="true" role="region" style={computeStyles.accordion}>
        <FiscalSegment session={session} collection={null} onAddFee={onAddFee} onAddFund={onAddFund} currency={false} empty="No fee factors found." items={data.fee_factors ?? []} onOpen={setOpenSegment} openSegment={openSegment} segment={segments.FEEFACTOR} shortcut={shortcuts.get(segments.FEEFACTOR) ?? null} title="Factors" />
        <FiscalSegment session={session} collection="fees" onAddFee={onAddFee} onAddFund={onAddFund} currency empty="No fees found." items={fees} onOpen={setOpenSegment} openSegment={openSegment} segment={segments.FEE} shortcut={shortcuts.get(segments.FEE) ?? null} title="Fees" />
        <FiscalSegment session={session} collection="funds" onAddFee={onAddFee} onAddFund={onAddFund} currency empty="No fund distributions found." items={funds} onOpen={setOpenSegment} openSegment={openSegment} segment={segments.FUND} shortcut={shortcuts.get(segments.FUND) ?? null} title="Funds" />
        <div aria-label="Row status legend" role="note" style={computeStyles.legend}>
          <span><span aria-hidden="true" style={{ color: "#15803d" }}>●</span> No ambiguity reported</span>
          <span><span aria-hidden="true" style={{ color: "#b45309" }}>●</span> Ambiguous / saving</span>
          <span><span aria-hidden="true" style={{ color: "#B42318" }}>●</span> Save failed</span>
        </div>
        <div aria-label="Compute total" role="group" style={{ ...computeStyles.row, ...computeStyles.total }}>
          <span style={{ ...computeStyles.label, ...computeStyles.totalText, gridColumn: "1 / 3" }}>Total fees</span>
          <span style={{ ...computeStyles.value, ...computeStyles.totalText, gridColumn: "3" }}>{currencyFormat.format(feeTotal / 100)}</span>
        </div>
        {!balanced ? <div role="alert" style={{ ...capabilityStyles.notice("error"), alignSelf: "center" }}>
          Fees ({currencyFormat.format(feeTotal / 100)}) and Funds ({currencyFormat.format(fundTotal / 100)}) do not match.
        </div> : null}
        {error ? <div aria-label="Save failed" role="alert" style={capabilityStyles.notice("error")}>{error}</div> : null}
        <p aria-label="Save status" role="status" style={computeStyles.saveStatus}>
          <span id={saveStatusId}>{pending ? "Saving changes…" : dirty ? "Unsaved changes. Save changes before endorsing." : !balanced ? "Fees and Funds must match before endorsing." : "Ready to endorse."}</span>
        </p>
        <div aria-label="Compute actions" role="group" style={{ ...capabilityStyles.computeActions, gap: formStyles.actions.gap, flexWrap: formStyles.actions.flexWrap }}>
          {dirty ? <>
            <ConfButton disabled={pending} label="Save" requireConfirmation={false} onConfirm={() => computeQueueStore.getState().save(session)} />
            <ConfButton disabled={pending} label="Discard changes" requireConfirmation={false} variant="secondary" onConfirm={() => computeQueueStore.getState().discard(session)} />
          </> : <ConfButton aria-describedby={saveStatusId} disabled={!balanced} label="Endorse" onConfirm={onEndorse} />}
        </div>
      </div>
    </section>
  );
}
