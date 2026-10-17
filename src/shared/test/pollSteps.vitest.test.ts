import { afterEach, expect, it, vi } from "vitest";
import { pollSteps } from "../worker/capabilityHttp";

afterEach(() => { vi.useRealTimers(); });

it("keeps the polling deadline when status requests take time", async () => {
  vi.useFakeTimers();
  const started = Date.now();
  const checks: number[] = [];
  const progress: number[] = [];
  const polling = (async () => {
    for await (const step of pollSteps(6000, 2)) {
      checks.push(Date.now() - started);
      progress.push(step);
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  })();
  await vi.advanceTimersByTimeAsync(30000);
  await polling;
  expect(checks).toEqual([6000, 15000]);
  expect(progress).toEqual([0, 1]);
});

it("finishes a zero-interval poll within the existing check limit", async () => {
  vi.useFakeTimers();
  const polling = pollSteps(0, 2);
  const results: IteratorResult<number, void>[] = [];
  for (let check = 0; check <= 30; check++) {
    const next = polling.next();
    await vi.advanceTimersByTimeAsync(1);
    results.push(await next);
  }
  expect(results.at(-1)?.done).toBe(true);
  await polling.return();
});

it("clamps a long interval to the deadline and completes the last progress step", async () => {
  vi.useFakeTimers();
  const polling = pollSteps(20000, 2);
  const first = polling.next();
  await vi.advanceTimersByTimeAsync(14999);
  const completed = vi.fn();
  void first.then(completed);
  await vi.advanceTimersByTimeAsync(0);
  expect(completed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(await first).toEqual({ done: false, value: 1 });
  expect(await polling.next()).toEqual({ done: true, value: undefined });
});
