import { create } from "zustand";
import type { CapabilityStatus, CompositionFailure, CompositionRequest, CompositionResult } from "../../../shared/type/capability.types";

type CompositionStoreState = {
  failure: CompositionFailure | null;
  openSegment: string | null;
  request: CompositionRequest | null;
  result: CompositionResult | null;
  runningRequestId: string | null;
  status: CapabilityStatus;
  clearSession(session: string): void;
  open(request: CompositionRequest, defaultSegment: string): void;
  reset(): void;
  setError(failure: CompositionFailure): void;
  setOpenSegment(segment: string): void;
  setReady(requestId: string, result: CompositionResult): void;
  setRunning(requestId: string): boolean;
};

export const useCompositionStore = create<CompositionStoreState>()((set, get) => ({
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
