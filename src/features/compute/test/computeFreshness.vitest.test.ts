import { afterEach, expect, it } from "vitest";
import { computeNeedsRefresh, updateComputeMetadata, useComputeStore } from "../store/computeStore";

const request = { authToken: "t", capability: "compute" as const, document: "d", documentApiGatewayUrl: "u", intervalMs: 0, refresh: false, requestId: "r", session: "s" };
afterEach(() => useComputeStore.getState().reset());

it("keeps unknown freshness separate from stale results and recovers on refresh", () => {
  const store = useComputeStore.getState();
  store.open(request, "fee");
  updateComputeMetadata({ session: "s", etag: "one" });
  store.setReady("r", undefined);
  expect(useComputeStore.getState().status).toBe("ready");
  expect(useComputeStore.getState().metadataEtag).toBeUndefined();
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(false);
  store.open({ ...request, refresh: true, requestId: "refresh" }, "fee");
  store.setReady("r", "one");
  expect(useComputeStore.getState().metadataEtag).toBeUndefined();
  store.setReady("refresh", "one");
  expect(useComputeStore.getState().metadataEtag).toBe("one");
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(false);
  updateComputeMetadata({ session: "s", etag: "two" });
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(true);
  store.clearSession("s");
  expect(useComputeStore.getState().metadataEtag).toBeNull();
});

it("compares the displayed result with client metadata and keeps stale state until successful refresh", () => {
  const store = useComputeStore.getState();
  store.open(request, "fee");
  updateComputeMetadata({ session: "s", etag: "one" });
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(false);
  store.setReady("r", "one");
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(false);
  updateComputeMetadata({ session: "other", etag: "other" });
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(false);
  updateComputeMetadata({ session: "s", etag: "two" });
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(true);
  store.open({ ...request, refresh: true, requestId: "refresh" }, "fee");
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(true);
  store.setError({ capability: "compute", error: { error: "failed" }, operation: "data", requestId: "refresh", session: "s" });
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(true);
  store.setReady("r", "two");
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(true);
  store.setReady("refresh", "two");
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(false);
  store.open({ ...request, session: "other", requestId: "new" }, "fee");
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(false);
});

it.each(["", "old"])("marks missing or mismatched source metadata: %s", source => {
  useComputeStore.getState().open(request, "fee");
  updateComputeMetadata({ session: "s", etag: "one" });
  useComputeStore.getState().setReady("r", source);
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(true);
  useComputeStore.getState().clearSession("s");
  expect(computeNeedsRefresh(useComputeStore.getState())).toBe(false);
});
