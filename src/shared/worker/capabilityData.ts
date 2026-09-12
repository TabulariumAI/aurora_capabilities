import { create } from "zustand";
import type { CapabilityName } from "../type/capability.types";

type CapabilityDataState = {
  data: Map<string, Partial<Record<CapabilityName, unknown>>>;
  clearSession(session: string): void;
  getData(capability: CapabilityName, session: string): unknown | null;
  reset(): void;
  setData(capability: CapabilityName, session: string, value: unknown): void;
};

export const useCapabilityDataStore = create<CapabilityDataState>()((set, get) => ({
  data: new Map(),
  clearSession(session) {
    set((state) => {
      const data = new Map(state.data);
      data.delete(session);
      return { data };
    });
  },
  getData(capability, session) {
    return get().data.get(session)?.[capability] ?? null;
  },
  reset() {
    set({ data: new Map() });
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
