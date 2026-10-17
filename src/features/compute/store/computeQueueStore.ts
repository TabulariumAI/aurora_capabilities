import { create } from "zustand";
import type { MetadataFeeItem, QueueStatus } from "aurora-core";
import type { ComputeModel, ComputeModelClient, ComputeResource, ComputePatch, ComputeResult, FeeInput, FundInput } from "../../../shared/type/capability.types";
import { workerError } from "../../../shared/worker/capabilityHttp";
import { calculateFees } from "../worker/calculation";
import { computeStorage } from "./computeStorage";

export type ComputeChange = { action: "add"; fee: FeeInput } | { action: "add"; fund: FundInput }
  | { action: "remove"; segment: "fees" | "funds"; item: MetadataFeeItem }
  | { action: "move"; segment: "funds"; item: MetadataFeeItem; target: MetadataFeeItem };
export type ComputeTask = { id: string; session: string; change: ComputeChange; status: "queued" | "processing" | "failed"; error: string | null; patch: ComputePatch };
export type ComputeTransition = Pick<ComputeTask, "id" | "session" | "change" | "error"> & { status: ComputeTask["status"] | "completed" };
export type ComputeRuntime = { authToken: string; client: ComputeModelClient; onChange(event: ComputeTransition): void };
export type ComputeQueue = { tasks: ComputeTask[]; bases: Record<string, ComputeResult>; models: Record<string, ComputeResource>; queues: QueueStatus[] };
type ComputeQueueState = ComputeQueue & {
  data: Record<string, ComputeResult>;
  error: string | null;
  restore(owner: string, runtime: ComputeRuntime): Promise<void>;
  setModel(session: string, resource: ComputeResource): Promise<void>;
  setResult(session: string, result: ComputeResult): Promise<void>;
  enqueue(session: string, change: ComputeChange): Promise<void>;
  save(session: string): Promise<void>;
  discard(session: string): Promise<void>;
  reset(): void;
};

function applyChange(source: ComputeModel, change: ComputeChange): { model: ComputeModel; patch: ComputePatch } {
  const model = structuredClone(source);
  const patch: ComputePatch = [];
  if (change.action === "add") {
    const items = "fund" in change ? [{ segment: "funds" as const, ...change.fund }]
      : [{ segment: "fees" as const, ...change.fee }, ...(change.fee.fund ? [{ segment: "funds" as const, name: change.fee.fund.name, value: change.fee.value }] : [])];
    for (const { segment, name, value } of items) {
      const tuple: [string, string, string] = [name, name, value];
      model[segment].unshift(tuple);
      patch.push({ op: "add", path: `/${segment}/0`, value: tuple });
    }
  } else {
    const { segment, item } = change;
    const positions = (change.action === "move" ? [item, change.target] : [item]).map(selected => model[segment].findIndex(tuple =>
      tuple[1] === selected.name && tuple[2] === selected.formula && (selected.explanation === undefined || tuple[0] === selected.explanation)));
    if (positions.some(position => position < 0)) throw new Error("The selected item is no longer in the compute model.");
    patch.push(...positions.map(position => ({ op: "test" as const, path: `/${segment}/${position}`, value: model[segment][position] })));
    if (change.action === "move") {
      model.funds.splice(positions[1], 0, ...model.funds.splice(positions[0], 1));
      patch.push({ op: "move", from: `/funds/${positions[0]}`, path: `/funds/${positions[1]}` });
    } else {
      model[segment].splice(positions[0], 1);
      patch.push({ op: "remove", path: `/${segment}/${positions[0]}` });
    }
  }
  return { model, patch };
}

function projectModel(model: ComputeModel, tasks: readonly ComputeTask[]): ComputeModel {
  return tasks.reduce((value, task) => applyChange(value, task.change).model, model);
}

function projectData(queue: ComputeQueue, previous: Record<string, ComputeResult>): Record<string, ComputeResult> {
  return Object.fromEntries(Object.entries(queue.bases).map(([session, base]) => {
    const tasks = queue.tasks.filter(task => task.session === session);
    if (!tasks.length) return [session, base];
    const model = queue.models[session].model;
    const derived = new Set(["total_amount", ...model.fees.map(item => item[1]), ...model.funds.map(item => item[1])]);
    return [session, calculateFees(projectModel(model, tasks), (base.fee_factors ?? []).filter(factor => !derived.has(factor.name)), previous[session])];
  }));
}

export const computeQueueStore = create<ComputeQueueState>()((set, get) => {
  let owner: string | null = null;
  let runtime: ComputeRuntime | null = null;
  let generation = 0;
  let writes = Promise.resolve();
  function commit(update: (state: ComputeQueueState) => ComputeQueue | undefined, events: ComputeTask[] = [], status?: ComputeTransition["status"]): Promise<void> {
    const started = generation, scope = owner;
    const operation = writes.then(async () => {
      if (started !== generation) return;
      const next = update(get());
      if (next === undefined) return;
      const data = projectData(next, get().data);
      next.queues = next.queues.map(queue => ({ ...queue, refreshNeeded: false,
        pending: next.tasks.filter(task => task.session === queue.session && task.status !== "failed").length,
        failed: next.tasks.filter(task => task.session === queue.session && task.status === "failed").length,
      }));
      if (scope !== null) await computeStorage(scope, next);
      if (started !== generation) return;
      set({ ...next, data, error: null });
      for (const task of events) runtime!.onChange({ ...task, status: status ?? task.status });
    });
    writes = operation.catch(() => undefined);
    return operation;
  }
  return {
    tasks: [], bases: {}, models: {}, queues: [], data: {}, error: null,
    async restore(scope, nextRuntime) {
      const started = ++generation;
      owner = null;
      runtime = null;
      set({ tasks: [], bases: {}, models: {}, queues: [], data: {}, error: null });
      await writes;
      const saved = await computeStorage(scope);
      if (started !== generation) return;
      owner = scope;
      runtime = nextRuntime;
      const restored: ComputeQueue = saved ?? { tasks: [], bases: {}, models: {}, queues: [] };
      restored.tasks = restored.tasks.map(task => task.status === "processing" ? { ...task, status: "failed", error: "The page closed before Save was acknowledged. Review the model before retrying." } : task);
      set({ ...restored, data: projectData(restored, restored.bases), error: null });
    },
    async setModel(session, resource) {
      if (get().models[session] === resource) return;
      await commit(state => ({ tasks: state.tasks, bases: state.bases, models: state.tasks.some(task => task.session === session) ? state.models : { ...state.models, [session]: structuredClone(resource) }, queues: state.queues }));
    },
    async setResult(session, result) {
      await commit(state => ({ tasks: state.tasks, bases: { ...state.bases, [session]: structuredClone(result) }, models: state.models, queues: state.queues }));
    },
    async enqueue(session, change) {
      const started = generation;
      try { await commit(state => {
        if (!runtime || !state.models[session] || !state.bases[session]) throw new Error("Load Compute before changing fees or funds.");
        const pending = state.tasks.filter(task => task.session === session);
        if (pending.some(task => task.status === "processing")) throw new Error("Wait for Save to finish.");
        const saved = state.models[session];
        const { model, patch } = applyChange(projectModel(saved.model, pending), change);
        const task: ComputeTask = { id: crypto.randomUUID(), session, change: structuredClone(change), status: "queued", error: null, patch };
        const reverted = JSON.stringify(model) === JSON.stringify(saved.model);
        return { models: state.models, bases: state.bases,
          tasks: reverted ? state.tasks.filter(item => item.session !== session) : [...state.tasks, task],
          queues: state.queues.some(queue => queue.session === session) ? state.queues : [...state.queues, { id: "compute", session, batch: null, pending: 0, failed: 0, completed: 0 }],
        };
      }); } catch (error) {
        if (started === generation) set({ error: workerError(error, "Store compute changes failed.").error });
        throw error;
      }
    },
    async save(session) {
      const started = generation, config = runtime!;
      const tasks: ComputeTask[] = [];
      try {
        await commit(state => {
          const pending = state.tasks.filter(task => task.session === session);
          if (!pending.length || pending.some(task => task.status === "processing")) return;
          tasks.push(...pending);
          return { tasks: state.tasks.map(task => task.session === session ? { ...task, status: "processing", error: null } : task), models: state.models, bases: state.bases, queues: state.queues };
        }, tasks, "processing");
        if (started !== generation || !tasks.length) return;
        const saved = await config.client.patch(config.authToken, session, get().models[session].etag, tasks.flatMap(task => task.patch));
        if (started !== generation) return;
        await commit(state => ({ models: { ...state.models, [session]: saved }, bases: { ...state.bases, [session]: state.data[session] }, tasks: state.tasks.filter(task => task.session !== session), queues: state.queues.map(queue => queue.session === session ? { ...queue, completed: queue.completed + tasks.length } : queue) }), tasks, "completed");
      } catch (error) {
        if (started !== generation) return;
        const message = workerError(error, "Save compute changes failed.").error;
        const failed = get().tasks.map(task => task.session === session ? { ...task, status: "failed" as const, error: message } : task);
        try { await commit(state => ({ tasks: failed, models: state.models, bases: state.bases, queues: state.queues }), failed.filter(task => task.session === session), "failed"); }
        catch { if (started === generation) set({ tasks: failed, error: message }); }
      }
    },
    async discard(session) {
      const started = generation;
      try { await commit(state => {
        if (state.tasks.some(task => task.session === session && task.status === "processing")) return;
        return { tasks: state.tasks.filter(task => task.session !== session), models: state.models, bases: state.bases, queues: state.queues };
      }); }
      catch (error) { if (started === generation) set({ error: workerError(error, "Discard compute changes failed.").error }); }
    },
    reset() {
      generation++;
      owner = null;
      runtime = null;
      set({ tasks: [], bases: {}, models: {}, queues: [], data: {}, error: null });
    },
  };
});
