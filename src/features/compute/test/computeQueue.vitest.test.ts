import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { computeQueueStore } from "../store/computeQueueStore";
import * as storage from "../store/computeStorage";
import type { ComputeModel, ComputeModelClient, ComputeResult } from "../../../shared/type/capability.types";

const model: ComputeModel = { fee_factors: [], fees: [["Recording", "recording", "70.01"]], funds: [["County", "county", "55.0"], ["Rest", "rest", "total_amount"]] };
const base: ComputeResult = { fee_factors: [], fees: [{ code: "fee", name: "recording", amount: "70.01", formula: "70.01", explanation: "Recording" }], funds: [{ code: "county", name: "county", amount: "55.00", formula: "55.0", explanation: "County" }, { code: "rest", name: "rest", amount: "15.01", formula: "total_amount", explanation: "Rest" }] };
function runtime() {
  const client: ComputeModelClient = { model: vi.fn(async () => ({ model: structuredClone(model), etag: '"v1"' })), patch: vi.fn(async () => ({ model: { ...structuredClone(model), funds: [["Extra", "Extra", "2.50"] as [string, string, string], ...structuredClone(model.funds)] }, etag: '"v2"' })) };
  return { client, authToken: "private-token", onChange: vi.fn() };
}
async function load(config = runtime(), owner = "owner") {
  await computeQueueStore.getState().restore(owner, config);
  await computeQueueStore.getState().setModel("session", { model: structuredClone(model), etag: '"v1"' });
  await computeQueueStore.getState().setResult("session", structuredClone(base));
  return config;
}
beforeEach(() => { computeQueueStore.getState().reset(); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => vi.restoreAllMocks());

it("keeps additions in IndexedDB and recalculates funds without a network mutation", async () => {
  const config = await load();
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  expect(computeQueueStore.getState().data.session.funds?.map(item => item.amount)).toEqual(["2.50", "55.00", "12.51"]);
  expect(config.client.patch).not.toHaveBeenCalled();
  expect(config.client.model).not.toHaveBeenCalled();
  computeQueueStore.getState().reset();
  await computeQueueStore.getState().restore("owner", config);
  expect(computeQueueStore.getState().data.session.funds?.[0].name).toBe("Extra");
  expect(config.client.patch).not.toHaveBeenCalled();
});
it.each([false, true])("calculates added fees and optional dedicated funds locally: %s", async dedicated => {
  await load();
  await computeQueueStore.getState().enqueue("session", { action: "add", fee: { name: "Extra", value: "2.50", ...(dedicated ? { fund: { name: "Dedicated" } } : {}) } });
  const result = computeQueueStore.getState().data.session;
  expect(result.fees?.[0]).toMatchObject({ name: "Extra", amount: "2.50" });
  expect(result.funds?.map(item => item.amount)).toEqual(dedicated ? ["2.50", "55.00", "15.01"] : ["55.00", "17.51"]);
});
it("saves buffered mutations in one conditional request and accepts the returned version", async () => {
  const config = await load();
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  await computeQueueStore.getState().save("session");
  expect(config.client.patch).toHaveBeenCalledExactlyOnceWith("private-token", "session", '"v1"', [{ op: "add", path: "/funds/0", value: ["Extra", "Extra", "2.50"] }]);
  expect(computeQueueStore.getState().models.session.etag).toBe('"v2"');
  expect(computeQueueStore.getState().tasks).toEqual([]);
  computeQueueStore.getState().reset();
  await computeQueueStore.getState().restore("owner", config);
  expect(computeQueueStore.getState().models.session.etag).toBe('"v2"');
});
it("Cancel restores saved values without submitting", async () => {
  const config = await load();
  await computeQueueStore.getState().enqueue("session", { action: "remove", segment: "fees", item: base.fees![0] });
  expect(computeQueueStore.getState().data.session.fees).toEqual([]);
  await computeQueueStore.getState().discard("session");
  expect(computeQueueStore.getState().data.session).toEqual(base);
  expect(computeQueueStore.getState().tasks).toEqual([]);
  expect(config.client.patch).not.toHaveBeenCalled();
});
it("reorders funds locally and recalculates capped allocations, preserving fees", async () => {
  const config = await load();
  await computeQueueStore.getState().enqueue("session", { action: "move", segment: "funds", item: base.funds![1], target: base.funds![0] });
  expect(computeQueueStore.getState().data.session.funds?.map(item => [item.name, item.amount])).toEqual([["rest", "70.01"]]);
  expect(computeQueueStore.getState().data.session.fees?.[0].amount).toBe("70.01");
  expect(config.client.patch).not.toHaveBeenCalled();
});
it("retains failed Save changes for explicit retry or Cancel; stale ETags never retry automatically", async () => {
  const config = await load();
  vi.mocked(config.client.patch).mockRejectedValue({ status: 412, error: "Compute model changed." });
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  await computeQueueStore.getState().save("session");
  expect(computeQueueStore.getState().tasks[0]).toMatchObject({ status: "failed", error: "Compute model changed." });
  expect(config.client.patch).toHaveBeenCalledOnce();
  expect(computeQueueStore.getState().data.session.funds?.[0].name).toBe("Extra");
  await computeQueueStore.getState().discard("session");
  expect(computeQueueStore.getState().data.session).toEqual(base);
});
it("isolates owners without resuming drafts as server writes", async () => {
  const config = await load();
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  await computeQueueStore.getState().restore("other", config);
  expect(computeQueueStore.getState().tasks).toEqual([]);
  await computeQueueStore.getState().restore("owner", config);
  expect(computeQueueStore.getState().tasks).toHaveLength(1);
  expect(config.client.patch).not.toHaveBeenCalled();
});
it("rejects edits before loading the saved model and result", async () => {
  await expect(computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "1.00" } })).rejects.toThrow();
});

it("does not submit a reverted draft", async () => {
  const config = await load();
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  await computeQueueStore.getState().enqueue("session", { action: "remove", segment: "funds", item: computeQueueStore.getState().data.session.funds![0] });
  await computeQueueStore.getState().save("session");
  expect(config.client.patch).not.toHaveBeenCalled();
  expect(computeQueueStore.getState().tasks).toEqual([]);
});

it("blocks duplicate Save and edits while the submitted model is pending", async () => {
  const config = await load();
  let finish!: (value: { model: ComputeModel; etag: string }) => void;
  vi.mocked(config.client.patch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  const saving = computeQueueStore.getState().save("session");
  await vi.waitFor(() => expect(config.client.patch).toHaveBeenCalledOnce());
  await computeQueueStore.getState().save("session");
  await expect(computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Blocked", value: "1.00" } })).rejects.toThrow();
  finish({ model: structuredClone(model), etag: '"v2"' });
  await saving;
  expect(config.client.patch).toHaveBeenCalledOnce();
});

it("retains the saved result when IndexedDB rejects a draft write", async () => {
  const config = await load();
  const open = vi.spyOn(indexedDB, "open").mockImplementationOnce(() => { throw new Error("Storage unavailable"); });
  await expect(computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } })).rejects.toThrow("Storage unavailable");
  expect(computeQueueStore.getState().data.session).toEqual(base);
  expect(computeQueueStore.getState().tasks).toEqual([]);
  expect(config.client.patch).not.toHaveBeenCalled();
  open.mockRestore();
});

it("includes preceding local changes when Save overlaps an IndexedDB write", async () => {
  const config = await load();
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  const updated = { ...structuredClone(model), funds: [["Second", "Second", "1.00"] as [string, string, string], ["Extra", "Extra", "2.50"] as [string, string, string], ...structuredClone(model.funds)] };
  vi.mocked(config.client.patch).mockResolvedValue({ model: updated, etag: '"v2"' });
  const adding = computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Second", value: "1.00" } });
  const saving = computeQueueStore.getState().save("session");
  await Promise.all([adding, saving]);
  expect(config.client.patch).toHaveBeenCalledExactlyOnceWith("private-token", "session", '"v1"', [
    { op: "add", path: "/funds/0", value: ["Extra", "Extra", "2.50"] },
    { op: "add", path: "/funds/0", value: ["Second", "Second", "1.00"] },
  ]);
  expect(computeQueueStore.getState().tasks).toEqual([]);
  computeQueueStore.getState().reset();
  await computeQueueStore.getState().restore("owner", config);
  expect(computeQueueStore.getState().models.session.model).toEqual(updated);
  expect(computeQueueStore.getState().data.session.funds?.map(item => item.name)).toEqual(["Second", "Extra", "county", "rest"]);
});

it.each(["reset", "restore"] as const)("does not submit Save after %s changes the active owner during persistence", async action => {
  const config = await load();
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  const persist = storage.computeStorage;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const write = vi.spyOn(storage, "computeStorage").mockImplementationOnce(async (...args) => { await pending; return persist(...args); });
  const saving = computeQueueStore.getState().save("session");
  await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
  const changing = action === "reset" ? computeQueueStore.getState().reset() : computeQueueStore.getState().restore("other", runtime());
  release();
  await Promise.all([saving, changing]);
  expect(config.client.patch).not.toHaveBeenCalled();
  expect(config.onChange).not.toHaveBeenCalled();
  expect(computeQueueStore.getState().models).toEqual({});
});

it("serializes simultaneous Save requests and prevents later edits or Cancel", async () => {
  const config = await load();
  let finish!: (value: { model: ComputeModel; etag: string }) => void;
  vi.mocked(config.client.patch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  const saving = computeQueueStore.getState().save("session");
  const duplicate = computeQueueStore.getState().save("session");
  const editing = expect(computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Blocked", value: "1.00" } })).rejects.toThrow("Wait for Save to finish.");
  const canceling = computeQueueStore.getState().discard("session");
  await vi.waitFor(() => expect(config.client.patch).toHaveBeenCalledOnce());
  await Promise.all([duplicate, editing, canceling]);
  expect(computeQueueStore.getState().tasks).toHaveLength(1);
  expect(computeQueueStore.getState().tasks[0].status).toBe("processing");
  finish({ model: { ...structuredClone(model), funds: [["Extra", "Extra", "2.50"], ...structuredClone(model.funds)] }, etag: '"v2"' });
  await saving;
  expect(computeQueueStore.getState().tasks).toEqual([]);
});

it.each(["enqueue", "discard"] as const)("does not publish an old owner's %s persistence error after reset", async action => {
  await load();
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const write = vi.spyOn(storage, "computeStorage").mockImplementationOnce(async () => { await pending; throw new Error("Storage unavailable"); });
  const operation = action === "enqueue"
    ? expect(computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Second", value: "1.00" } })).rejects.toThrow("Storage unavailable")
    : computeQueueStore.getState().discard("session");
  await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
  computeQueueStore.getState().reset();
  release();
  await operation;
  expect(computeQueueStore.getState().error).toBeNull();
});

it("restores an unacknowledged Save for review without resubmitting or accepting a late response", async () => {
  const config = await load();
  let finish!: (value: { model: ComputeModel; etag: string }) => void;
  vi.mocked(config.client.patch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  const saving = computeQueueStore.getState().save("session");
  await vi.waitFor(() => expect(config.client.patch).toHaveBeenCalledOnce());
  computeQueueStore.getState().reset();
  const restored = runtime();
  await computeQueueStore.getState().restore("owner", restored);
  expect(computeQueueStore.getState().tasks[0]).toMatchObject({ status: "failed", error: expect.stringContaining("before Save was acknowledged") });
  expect(restored.client.patch).not.toHaveBeenCalled();
  expect(computeQueueStore.getState().data.session.funds?.[0].name).toBe("Extra");
  finish({ model: structuredClone(model), etag: '"v2"' });
  await saving;
  expect(computeQueueStore.getState().models.session.etag).toBe('"v1"');
  expect(computeQueueStore.getState().tasks[0].status).toBe("failed");
});

it("persists draft data without runtime credentials or clients", async () => {
  const config = await load();
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  const saved = await storage.computeStorage("owner");
  expect(saved?.tasks).toHaveLength(1);
  expect(JSON.stringify(saved)).not.toContain(config.authToken);
  expect(saved).not.toHaveProperty("client");
  expect(saved).not.toHaveProperty("authToken");
});

it("does not restore failed Save tasks into a signed-out session when persistence fails", async () => {
  const config = await load();
  await computeQueueStore.getState().enqueue("session", { action: "add", fund: { name: "Extra", value: "2.50" } });
  vi.mocked(config.client.patch).mockRejectedValue(new Error("Save failed"));
  const persist = storage.computeStorage;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const write = vi.spyOn(storage, "computeStorage")
    .mockImplementationOnce(persist)
    .mockImplementationOnce(async () => { await pending; throw new Error("Storage unavailable"); });
  const saving = computeQueueStore.getState().save("session");
  await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
  computeQueueStore.getState().reset();
  release();
  await saving;
  expect(computeQueueStore.getState().tasks).toEqual([]);
  expect(computeQueueStore.getState().error).toBeNull();
  expect(computeQueueStore.getState().models).toEqual({});
});
