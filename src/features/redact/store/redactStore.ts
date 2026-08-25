import { create } from "zustand";
import type { CapabilityStatus, RedactFailure, RedactRequest } from "../../../shared/type/capability.types";

type RedactStoreState = {
  deliveryKind: "info" | "error";
  deliveryNotice: string | null;
  delivering: boolean;
  failure: RedactFailure | null;
  request: RedactRequest | null;
  runningRequestId: string | null;
  status: CapabilityStatus;
  visible: boolean;
  clearSession(session: string): void;
  close(): void;
  open(request: RedactRequest): void;
  reopen(): void;
  reset(): void;
  setDelivery(delivering: boolean, message: string | null, kind?: "info" | "error"): void;
  setError(failure: RedactFailure): void;
  setReady(requestId: string): void;
  setRunning(requestId: string): boolean;
};

export const useRedactStore = create<RedactStoreState>()((set, get) => ({
  deliveryKind: "info",
  deliveryNotice: null,
  delivering: false,
  failure: null,
  request: null,
  runningRequestId: null,
  status: "idle",
  visible: false,
  clearSession(session) {
    set((state) => state.request?.session === session ? { deliveryNotice: null, delivering: false, failure: null, request: null, runningRequestId: null, status: "idle", visible: false } : state);
  },
  close() {
    set({ visible: false });
  },
  open(request) {
    set((state) => state.request?.requestId === request.requestId ? { visible: true } : { deliveryNotice: null, delivering: false, failure: null, request, status: "loading", visible: true });
  },
  reopen() {
    set({ visible: true });
  },
  reset() {
    set({ deliveryNotice: null, delivering: false, failure: null, request: null, runningRequestId: null, status: "idle", visible: false });
  },
  setDelivery(delivering, deliveryNotice, deliveryKind = "info") {
    set({ delivering, deliveryNotice, deliveryKind });
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
