import { create } from "zustand";
import type { CapabilityStatus, ManifestFailure, ManifestRequest } from "../../../shared/type/capability.types";

type ManifestStoreState = {
  delivering: boolean;
  failure: ManifestFailure | null;
  request: ManifestRequest | null;
  runningRequestId: string | null;
  status: CapabilityStatus;
  visible: boolean;
  clearSession(session: string): void;
  close(): void;
  open(request: ManifestRequest): void;
  reopen(): void;
  reset(): void;
  setDelivering(delivering: boolean): void;
  setError(failure: ManifestFailure): void;
  setReady(requestId: string): void;
  setRunning(requestId: string): boolean;
};

export const useManifestStore = create<ManifestStoreState>()((set, get) => ({
  delivering: false,
  failure: null,
  request: null,
  runningRequestId: null,
  status: "idle",
  visible: false,
  clearSession(session) {
    set((state) => state.request?.session === session ? { delivering: false, failure: null, request: null, runningRequestId: null, status: "idle", visible: false } : state);
  },
  close() {
    set({ visible: false });
  },
  open(request) {
    set((state) => state.request?.requestId === request.requestId ? { visible: true } : { delivering: false, failure: null, request, status: "loading", visible: true });
  },
  reopen() {
    set({ visible: true });
  },
  reset() {
    set({ delivering: false, failure: null, request: null, runningRequestId: null, status: "idle", visible: false });
  },
  setDelivering(delivering) {
    set({ delivering });
  },
  setError(failure) {
    if (get().request?.requestId !== failure.requestId) return;
    set({ failure, runningRequestId: null, status: "error", visible: true });
  },
  setReady(requestId) {
    if (get().request?.requestId !== requestId) return;
    set({ failure: null, runningRequestId: null, status: "ready", visible: true });
  },
  setRunning(requestId) {
    if (get().runningRequestId === requestId) return false;
    set({ runningRequestId: requestId, status: "loading" });
    return true;
  },
}));
