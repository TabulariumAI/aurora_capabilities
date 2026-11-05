import { afterEach, expect, expectTypeOf, it } from "vitest";
import { TitleReportPanel, useTitleReportStore, type TitleReportRequest, type WorkerConfig } from "../src/public-api";
import { TitleReportPanel as Panel } from "../src/features/titlereport/component/TitleReportPanel";
import { useTitleReportStore as store } from "../src/features/titlereport/store/titleReportStore";
import type { WorkerConfig as Config } from "../src/shared/type/capability.types";

afterEach(() => useTitleReportStore.getState().reset());

it("exposes the title panel and a single store through the package entry point", () => {
  expect(TitleReportPanel).toBe(Panel);
  expect(useTitleReportStore).toBe(store);
  const request: TitleReportRequest = { 
    apiGatewayUrl: "https://gateway.example.test", authToken: "test-token", intervalMs: 500,
    batch: "Batch", batchCode: "batch", batchId: "batch", batchGroup: "user", sessions: ["first", "second"],
  };
  useTitleReportStore.getState().open(request);
  expect(store.getState().request).toBe(request);
  expectTypeOf<WorkerConfig>().toEqualTypeOf<Config>();
});
