import { create } from "zustand";
import type { MetadataUpdate } from "aurora-core";
import type { CapabilityStatus, ComputeFailure, ComputeRequest } from "../../../shared/type/capability.types";

type ComputeStoreState = {
  metadataGeneration: number;
  metadataEtag: string | null;
  clientEtag: string | null;
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
  setReady(requestId: string, metadataEtag: string): void;
  setRunning(requestId: string): boolean;
};

const initialMetadata = { metadataEtag: null, clientEtag: null, metadataGeneration: 0 };

export const useComputeStore = create<ComputeStoreState>()((set, get) => ({
  ...initialMetadata,
  failure: null,
  openSegment: null,
  request: null,
  runningRequestId: null,
  status: "idle",
  visible: false,
  clearSession(session) {
    set((state) => state.request?.session === session ? { failure: null, request: null, runningRequestId: null, status: "idle", visible: false, ...initialMetadata } : state);
  },
  close() {
    set({ visible: false });
  },
  open(request, defaultSegment) {
    set((state) => state.request?.requestId === request.requestId ? { visible: true } : { failure: null, openSegment: defaultSegment, request, status: "loading", visible: true,
      ...(state.request?.session !== request.session ? initialMetadata : {}) });
  },
  reopen() {
    set({ visible: true });
  },
  reset() {
    set({ failure: null, openSegment: null, request: null, runningRequestId: null, status: "idle", visible: false, ...initialMetadata });
  },
  setError(failure) {
    if (get().request?.requestId !== failure.requestId) return;
    set({ failure, runningRequestId: null, status: "error", visible: true });
  },
  setOpenSegment(segment) {
    set({ openSegment: segment });
  },
  setReady(requestId, metadataEtag) {
    if (get().request?.requestId !== requestId) return;
    set({ failure: null, runningRequestId: null, status: "ready", visible: true, metadataEtag });
  },
  setRunning(requestId) {
    if (get().runningRequestId === requestId) return false;
    set({ runningRequestId: requestId, status: "loading" });
    return true;
  },
}));

export function updateComputeMetadata({ session, etag }: MetadataUpdate): void {
  if (useComputeStore.getState().request?.session === session) {
    useComputeStore.setState(state => ({ clientEtag: etag ?? null, metadataGeneration: state.metadataGeneration + 1 }));
  }
}

export function computeNeedsRefresh(state: ComputeStoreState): boolean {
  return state.metadataEtag !== null && state.metadataEtag !== state.clientEtag;
}
