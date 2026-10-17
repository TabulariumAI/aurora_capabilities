import { useMemo } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

type FiscalFields = { name: string; value: string; fundName: string };
type FiscalState = {
  fields: FiscalFields;
  dedicated: boolean;
  etag: string | null;
  error: string | null;
  pending: boolean;
  setField(field: keyof FiscalFields, value: string): void;
  setDedicated(dedicated: boolean): void;
  load(): void;
  setEtag(etag: string): void;
  begin(): boolean;
  fail(error: string): void;
};

export function useFiscalStore() {
  const store = useMemo(() => createStore<FiscalState>()((set, get) => ({
    fields: { name: "", value: "", fundName: "" },
    dedicated: false,
    etag: null,
    error: null,
    pending: false,
    setField(field, value) { set(state => ({ fields: { ...state.fields, [field]: value } })); },
    setDedicated(dedicated) {
      set(state => ({ dedicated, ...(dedicated ? { fields: { ...state.fields, fundName: `${state.fields.name.trim()} Fund` } } : {}) }));
    },
    load() { set({ etag: null, error: null }); },
    setEtag(etag) { set({ etag }); },
    begin() {
      if (get().pending) return false;
      set({ pending: true, error: null });
      return true;
    },
    fail(error) { set({ error, pending: false }); },
  })), []);
  return useStore(store);
}

type DetailState = { open: boolean; setOpen(open: boolean): void };
export function useDetailStore() {
  const store = useMemo(() => createStore<DetailState>()((set) => ({
    open: false,
    setOpen(open) { set({ open }); },
  })), []);
  return useStore(store);
}
