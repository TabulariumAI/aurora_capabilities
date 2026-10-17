import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { computeQueueStore } from "../src/features/compute/store/computeQueueStore";
beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); computeQueueStore.getState().reset(); });

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

HTMLElement.prototype.scrollIntoView = () => undefined;
