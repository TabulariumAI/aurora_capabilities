import { create } from "zustand";
import type { CapabilityStatus, ComputeFailure, ComputeRequest } from "../../../shared/type/capability.types";

type ComputeStoreState = {
  failure: ComputeFailure | null;
  openSegment: string | null;
  request: ComputeRequest | null;
  runningRequestId: string | null;
  status: CapabilityStatus;
  visible: boolean;
  clearSession(session: string): void;
  close(): void;
  open(request: ComputeRequest, defaultSegment: string): void;
  reopen(): void;
  reset(): void;
  setError(failure: ComputeFailure): void;
  setOpenSegment(segment: string): void;
  setReady(requestId: string): void;
  setRunning(requestId: string): boolean;
};

export const useComputeStore = create<ComputeStoreState>()((set, get) => ({
  failure: null,
  openSegment: null,
  request: null,
  runningRequestId: null,
  status: "idle",
  visible: false,
  clearSession(session) {
    set((state) => state.request?.session === session ? { failure: null, request: null, runningRequestId: null, status: "idle", visible: false } : state);
  },
  close() {
    set({ visible: false });
  },
  open(request, defaultSegment) {
    set((state) => state.request?.requestId === request.requestId ? { visible: true } : { failure: null, openSegment: defaultSegment, request, status: "loading", visible: true });
  },
  reopen() {
    set({ visible: true });
  },
  reset() {
    set({ failure: null, openSegment: null, request: null, runningRequestId: null, status: "idle", visible: false });
  },
  setError(failure) {
    if (get().request?.requestId !== failure.requestId) return;
    set({ failure, runningRequestId: null, status: "error", visible: true });
  },
  setOpenSegment(segment) {
    set({ openSegment: segment });
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
