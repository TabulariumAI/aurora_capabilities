import { create } from "zustand";
import type { CapabilityName } from "../type/capability.types";

type CapabilityDataEntry = {
  session: string;
  value: unknown;
};

type CapabilityDataState = {
  data: Partial<Record<CapabilityName, CapabilityDataEntry>>;
  clearSession(session: string): void;
  getData(capability: CapabilityName, session: string): unknown | null;
  reset(): void;
  setData(capability: CapabilityName, session: string, value: unknown): void;
};

export const useCapabilityDataStore = create<CapabilityDataState>()((set, get) => ({
  data: {},
  clearSession(session) {
    set((state) => {
      const data = { ...state.data };
      for (const capability of Object.keys(data) as CapabilityName[]) {
        if (data[capability]?.session === session) delete data[capability];
      }
      return { data };
    });
  },
  getData(capability, session) {
    const data = get().data[capability];
    return data?.session === session ? data.value : null;
  },
  reset() {
    set({ data: {} });
  },
  setData(capability, session, value) {
    set((state) => ({ data: { ...state.data, [capability]: { session, value } } }));
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
