import { create } from "zustand";
import type { CapabilityStatus, RecordFailure, RecordRequest, RecordResult } from "../../../shared/type/capability.types";

type DeliveryTarget = "cover" | "document" | null;

type RecordStoreState = {
  deliveryKind: "info" | "error";
  deliveryNotice: string | null;
  delivering: DeliveryTarget;
  failure: RecordFailure | null;
  request: RecordRequest | null;
  result: RecordResult | null;
  runningRequestId: string | null;
  status: CapabilityStatus;
  visible: boolean;
  clearSession(session: string): void;
  close(): void;
  open(request: RecordRequest): void;
  reopen(): void;
  reset(): void;
  setDelivery(target: DeliveryTarget, message: string | null, kind?: "info" | "error"): void;
  setError(failure: RecordFailure): void;
  setReady(requestId: string, result: RecordResult): void;
  setRunning(requestId: string): boolean;
};

export const useRecordStore = create<RecordStoreState>()((set, get) => ({
  deliveryKind: "info",
  deliveryNotice: null,
  delivering: null,
  failure: null,
  request: null,
  result: null,
  runningRequestId: null,
  status: "idle",
  visible: false,
  clearSession(session) {
    set((state) => state.request?.session === session ? { deliveryNotice: null, delivering: null, failure: null, request: null, result: null, runningRequestId: null, status: "idle", visible: false } : state);
  },
  close() {
    set({ visible: false });
  },
  open(request) {
    set((state) => state.request?.requestId === request.requestId ? { visible: true } : { deliveryNotice: null, delivering: null, failure: null, request, result: null, status: "loading", visible: true });
  },
  reopen() {
    set({ visible: true });
  },
  reset() {
    set({ deliveryNotice: null, delivering: null, failure: null, request: null, result: null, runningRequestId: null, status: "idle", visible: false });
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
