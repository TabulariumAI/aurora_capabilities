import { useCapabilityDataStore } from "../../../shared/worker/capabilityData";
import { create } from "zustand";
import type { CapabilityStatus, ManifestFailure, ManifestOptions, ManifestRequest } from "../../../shared/type/capability.types";

const DEFAULT_OPTIONS: ManifestOptions = { include_pages: false, include_gates: false, include_notes: false };

type ManifestStoreState = {
  delivering: boolean;
  failure: ManifestFailure | null;
  options: ManifestOptions;
  request: ManifestRequest | null;
  runningRequestId: string | null;
  status: CapabilityStatus;
  visible: boolean;
  clearSession(session: string): void;
  close(): void;
  confirm(requestId: string): void;
  open(request: ManifestRequest): void;
  reopen(): void;
  reset(): void;
  setDelivering(delivering: boolean): void;
  setError(failure: ManifestFailure): void;
  setOption(option: keyof ManifestOptions, value: boolean): void;
  setReady(requestId: string): void;
  setRunning(requestId: string): boolean;
};

export const useManifestStore = create<ManifestStoreState>()((set, get) => ({
  delivering: false,
  failure: null,
  options: DEFAULT_OPTIONS,
  request: null,
  runningRequestId: null,
  status: "idle",
  visible: false,
  clearSession(session) {
    set((state) => state.request?.session === session ? { delivering: false, failure: null, options: DEFAULT_OPTIONS, request: null, runningRequestId: null, status: "idle", visible: false } : state);
  },
  close() {
    set({ visible: false });
  },
  confirm(requestId) {
    const { request, options } = get();
    if (request?.requestId !== requestId || request.options) return;
    set({ request: { ...request, options: { ...options } }, status: "loading" });
  },
  open(request) {
    set((state) => state.request?.requestId === request.requestId ? { visible: true } : { delivering: false, failure: null, options: request.options ?? DEFAULT_OPTIONS, request, status: request.options ? "loading" : "idle", visible: true });
  },
  reopen() {
    set({ visible: true });
  },
  reset() {
    useCapabilityDataStore.getState().clearRuns("manifest");
    set({ delivering: false, failure: null, options: DEFAULT_OPTIONS, request: null, runningRequestId: null, status: "idle", visible: false });
  },
  setDelivering(delivering) {
    set({ delivering });
  },
  setError(failure) {
    if (get().request?.requestId !== failure.requestId) return;
    set({ failure, runningRequestId: null, status: "error" });
  },
  setOption(option, value) {
    if (get().request?.options) return;
    set(state => ({ options: { ...state.options, [option]: value } }));
  },
  setReady(requestId) {
    if (get().request?.requestId !== requestId) return;
    set({ failure: null, runningRequestId: null, status: "ready" });
  },
  setRunning(requestId) {
    if (get().runningRequestId === requestId) return false;
    set({ runningRequestId: requestId, status: "loading" });
    return true;
  },
}));
