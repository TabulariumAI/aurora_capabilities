import { create } from "zustand";
import type { CapabilityStatus, ManifestFailure, ManifestRequest, ManifestResult } from "../../../shared/type/capability.types";

type ManifestStoreState = {
  deliveryKind: "info" | "error";
  deliveryNotice: string | null;
  delivering: boolean;
  failure: ManifestFailure | null;
  request: ManifestRequest | null;
  result: ManifestResult | null;
  runningRequestId: string | null;
  status: CapabilityStatus;
  visible: boolean;
  clearSession(session: string): void;
  close(): void;
  open(request: ManifestRequest): void;
  reopen(): void;
  reset(): void;
  setDelivery(delivering: boolean, message: string | null, kind?: "info" | "error"): void;
  setError(failure: ManifestFailure): void;
  setReady(requestId: string, result: ManifestResult): void;
  setRunning(requestId: string): boolean;
};

export const useManifestStore = create<ManifestStoreState>()((set, get) => ({
  deliveryKind: "info",
  deliveryNotice: null,
  delivering: false,
  failure: null,
  request: null,
  result: null,
  runningRequestId: null,
  status: "idle",
  visible: false,
  clearSession(session) {
    set((state) => state.request?.session === session ? { deliveryNotice: null, delivering: false, failure: null, request: null, result: null, runningRequestId: null, status: "idle", visible: false } : state);
  },
  close() {
    set({ visible: false });
  },
  open(request) {
    set((state) => state.request?.requestId === request.requestId ? { visible: true } : { deliveryNotice: null, delivering: false, failure: null, request, result: null, status: "loading", visible: true });
  },
  reopen() {
    set({ visible: true });
  },
  reset() {
    set({ deliveryNotice: null, delivering: false, failure: null, request: null, result: null, runningRequestId: null, status: "idle", visible: false });
  },
  setDelivery(delivering, deliveryNotice, deliveryKind = "info") {
    set({ delivering, deliveryNotice, deliveryKind });
  },
  setError(failure) {
    if (get().request?.requestId !== failure.requestId) return;
    set({ failure, runningRequestId: null, status: "error", visible: false });
  },
  setReady(requestId, result) {
    if (get().request?.requestId !== requestId) return;
    set({ failure: null, result, runningRequestId: null, status: "ready", visible: true });
  },
  setRunning(requestId) {
    if (get().runningRequestId === requestId) return false;
    set({ runningRequestId: requestId, status: "loading" });
    return true;
  },
}));
