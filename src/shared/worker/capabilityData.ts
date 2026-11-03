import { create } from "zustand";
import type { ProgressJob } from "aurora-core";
import type { CapabilityName, CapabilityRequest } from "../type/capability.types";

export type CapabilityRun = {
  capability: CapabilityName;
  session: string;
  token: symbol;
  outcome: "running" | "completed" | "failed";
  events: readonly ProgressJob[];
};
type CapabilityDataState = {
  runs: ReadonlyMap<string, CapabilityRun>;
  beginRun(request: CapabilityRequest): symbol | null;
  clearRuns(capability: CapabilityName): void;
  progressRun(requestId: string, token: symbol, event: ProgressJob): void;
  finishRun(requestId: string, token: symbol, outcome: "completed" | "failed"): void;
  data: Map<string, Partial<Record<Exclude<CapabilityName, "compute">, unknown>>>;
  clearSession(session: string): void;
  getData(capability: Exclude<CapabilityName, "compute">, session: string): unknown | null;
  reset(): void;
  setData(capability: Exclude<CapabilityName, "compute">, session: string, value: unknown): void;
};

export const useCapabilityDataStore = create<CapabilityDataState>()((set, get) => ({
  data: new Map(),
  runs: new Map(),
  beginRun(request) {
    if (get().runs.has(request.requestId)) return null;
    const token = Symbol(request.requestId);
    set(state => ({ runs: new Map(state.runs).set(request.requestId, {
      capability: request.capability, session: request.session, token, outcome: "running", events: [],
    }) }));
    return token;
  },
  clearRuns(capability) {
    set(state => ({ runs: new Map([...state.runs].filter(([, run]) => run.capability !== capability)) }));
  },
  progressRun(requestId, token, event) {
    const run = get().runs.get(requestId);
    if (run?.token !== token) return;
    set(state => ({ runs: new Map(state.runs).set(requestId, { ...run, events: [...run.events, event] }) }));
  },
  finishRun(requestId, token, outcome) {
    const run = get().runs.get(requestId);
    if (run?.token !== token) return;
    set(state => ({ runs: new Map(state.runs).set(requestId, { ...run, outcome }) }));
  },
  clearSession(session) {
    set((state) => {
      const data = new Map(state.data);
      data.delete(session);
      return { data, runs: new Map([...state.runs].filter(([, run]) => run.session !== session || run.outcome === "running")) };
    });
  },
  getData(capability, session) {
    return get().data.get(session)?.[capability] ?? null;
  },
  reset() {
    set({ data: new Map(), runs: new Map() });
  },
  setData(capability, session, value) {
    set((state) => ({
      data: new Map(state.data).set(session, {
        ...state.data.get(session),
        [capability]: value,
      }),
    }));
  },
}));

export async function downloadBlob(url: string): Promise<{ blob: Blob; name: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch the file. Status: ${response.status} ${response.statusText}`);
  }
  const name = new URL(url).pathname.split("/").filter(Boolean).at(-1);
  if (!name) throw new Error("Download URL has no file name.");
  return { blob: await response.blob(), name };
}
