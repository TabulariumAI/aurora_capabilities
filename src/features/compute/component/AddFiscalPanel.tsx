import * as Checkbox from "@radix-ui/react-checkbox";
import { ConfButton, formStyles } from "aurora-core";
import { useEffect, useId, useMemo, type FormEvent } from "react";
import type { AddFiscalPanelProps, FeeInput } from "../../../shared/type/capability.types";
import { workerError } from "../../../shared/worker/capabilityHttp";
import { createComputeWorkerClient } from "../worker/computeWorkerClient";
import { computeQueueStore } from "../store/computeQueueStore";
import { useFiscalStore } from "../store/fiscalStore";
import { computeStyles } from "../style/compute.styles";

export function AddFiscalPanel({ segment, request, workerClient, onQueued }: AddFiscalPanelProps) {
  const client = useMemo(() => workerClient ?? createComputeWorkerClient({ apiBaseUrl: request.documentApiGatewayUrl }), [request.documentApiGatewayUrl, workerClient]);
  const id = useId();
  const label = segment === "fees" ? "Fee" : "Fund";
  const { fields, dedicated, etag, error, pending, setField, setDedicated, load, setEtag, begin, fail } = useFiscalStore();
  const valid = fields.name.trim() && fields.value && (segment === "funds" || !dedicated || fields.fundName.trim());

  useEffect(() => {
    let active = true;
    load();
    void (async () => {
      try {
        const resource = computeQueueStore.getState().models[request.session] ?? await client.model(request.authToken, request.session);
        if (!active) return;
        await computeQueueStore.getState().setModel(request.session, resource);
        if (active) setEtag(resource.etag);
      } catch (error) { if (active) fail(workerError(error, "Load compute model failed.").error); }
    })();
    return () => { active = false; };
  }, [client, request.authToken, request.session, load, setEtag, fail]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!etag || !valid || !begin()) return;
    const item: FeeInput = { name: fields.name.trim(), value: Number(fields.value).toFixed(2) };
    if (segment === "fees" && dedicated) item.fund = { name: fields.fundName.trim() };
    try {
      await computeQueueStore.getState().enqueue(request.session, segment === "fees" ? { action: "add", fee: item } : { action: "add", fund: item });
      onQueued();
    } catch (error) {
      fail(workerError(error, `Queue ${label.toLowerCase()} failed.`).error);
    }
  }

  return <form aria-label={`Add ${label}`} onSubmit={submit} style={computeStyles.fiscalForm}>
    <fieldset disabled={pending} style={computeStyles.fiscalFields}>
      <div style={computeStyles.fiscalInputs}>
        <label style={formStyles.control}><span style={formStyles.label}>{label} Name</span><input autoFocus name={`${label.toLowerCase()}-name`} value={fields.name} onChange={event => setField("name", event.target.value)} required style={formStyles.input} /></label>
        <label style={formStyles.control}><span style={formStyles.label}>{label} Value</span><input name={`${label.toLowerCase()}-value`} value={fields.value} onChange={event => setField("value", event.target.value)} type="number" min="0" step="0.01" required style={formStyles.input} /></label>
      </div>
      {segment === "fees" ? <>
      <label htmlFor={id} style={formStyles.checkboxRow}>
        <Checkbox.Root id={id} checked={dedicated} disabled={pending} onCheckedChange={checked => setDedicated(checked === true)} style={formStyles.checkbox(pending, dedicated)}>
          <Checkbox.Indicator aria-hidden style={{ fontSize: "0.75rem", lineHeight: 1 }}>{"\u2713"}</Checkbox.Indicator>
        </Checkbox.Root>
        Fee has a dedicated fund
      </label>
      <fieldset disabled={!dedicated} style={{ ...computeStyles.fiscalFields, opacity: dedicated ? 1 : 0.5 }}>
        <label style={formStyles.control}><span style={formStyles.label}>Fund Name</span><input name="fund-name" value={fields.fundName} onChange={event => setField("fundName", event.target.value)} required={dedicated} style={formStyles.input} /></label>
      </fieldset>
      </> : null}
    </fieldset>
    {error ? <div role="alert">{error}</div> : null}
    <div style={formStyles.actions}>
      <ConfButton disabled={!etag || !valid || pending} label="Add" requireConfirmation={false} style={formStyles.button} type="submit" variant="primary" />
    </div>
  </form>;
}
