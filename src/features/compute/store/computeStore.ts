import { create } from "zustand";
import type { CapabilityStatus, ComputeFailure, ComputeRequest, ComputeResult } from "../../../shared/type/capability.types";

type ComputeStoreState = {
  failure: ComputeFailure | null;
  openSegment: string | null;
  request: ComputeRequest | null;
  result: ComputeResult | null;
  runningRequestId: string | null;
  status: CapabilityStatus;
  clearSession(session: string): void;
  open(request: ComputeRequest, defaultSegment: string): void;
  reset(): void;
  setError(failure: ComputeFailure): void;
  setOpenSegment(segment: string): void;
  setReady(requestId: string, result: ComputeResult): void;
  setRunning(requestId: string): boolean;
};

export const useComputeStore = create<ComputeStoreState>()((set, get) => ({
  failure: null,
  openSegment: null,
  request: null,
  result: null,
  runningRequestId: null,
  status: "idle",
  clearSession(session) {
    set((state) => state.request?.session === session ? { failure: null, request: null, result: null, runningRequestId: null, status: "idle" } : state);
  },
  open(request, defaultSegment) {
    set((state) => state.request?.requestId === request.requestId ? state : { failure: null, openSegment: defaultSegment, request, result: null, status: "loading" });
  },
  reset() {
    set({ failure: null, openSegment: null, request: null, result: null, runningRequestId: null, status: "idle" });
  },
  setError(failure) {
    if (get().request?.requestId !== failure.requestId) return;
    set({ failure, status: "error" });
  },
  setOpenSegment(segment) {
    set({ openSegment: segment });
  },
  setReady(requestId, result) {
    if (get().request?.requestId !== requestId) return;
    set({ failure: null, result, runningRequestId: null, status: "ready" });
  },
  setRunning(requestId) {
    if (get().runningRequestId === requestId) return false;
    set({ runningRequestId: requestId, status: "loading" });
    return true;
  },
}));
