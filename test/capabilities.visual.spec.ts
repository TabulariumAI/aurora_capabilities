import { expect, test } from "@playwright/test";

const ready = [
  { action: "Endorsed Document", capability: "record", message: "Recording complete.", process: "RECORDING THE DOCUMENT" },
  { action: "Download Redacted PDF", capability: "redact", message: "Redaction complete.", process: "REDACTING THE DOCUMENT" },
  { action: "Download manifest", capability: "manifest", message: "Manifest is ready to download.", process: "GENERATING THE INDEX MANIFEST" },
] as const;

for (const capability of ready) {
  test(`${capability.capability} keeps its result in the completed progress timeline`, async ({ page }, testInfo) => {
    await page.goto(`/?capability=${capability.capability}&state=ready`);
    const progress = page.getByTestId("progress-view");
    const rows = progress.getByRole("listitem");

    await expect(progress).toBeVisible();
    await expect(progress.getByTestId("progress-caption")).toHaveText(capability.process);
    await expect(progress.getByText(capability.message, { exact: true }).first()).toBeVisible();
    await expect(rows.last()).toHaveAttribute("data-phase", "completed");
    await expect(progress.getByRole("button", { name: /back to start/i })).toHaveCount(0);
    if (capability.action) await expect(rows.last().getByText(capability.action, { exact: true })).toBeVisible();
    await progress.screenshot({ path: testInfo.outputPath(`${capability.capability}-ready.png`) });
  });
}

test("manifest uses tinted progress circles and connectors", async ({ page }) => {
  await page.goto("/?capability=manifest&state=ready");
  const progress = page.getByTestId("progress-view");
  const rows = progress.getByRole("listitem");

  await expect(rows.first().getByLabel("Completed")).toHaveCSS("background-color", "rgb(236, 247, 241)");
  await expect(rows.first().getByLabel("Completed")).toHaveCSS("border-top-color", "rgb(30, 142, 94)");
  await expect(rows.first().getByLabel("Completed")).toHaveCSS("color", "rgb(30, 142, 94)");
  await expect(rows.first().locator(":scope > div")).toHaveCSS("background-color", "rgba(30, 142, 94, 0.05)");
  await expect(rows.last().getByLabel("Completed")).toHaveCSS("background-color", "rgb(240, 246, 250)");
  await expect(rows.last().getByLabel("Completed")).toHaveCSS("border-top-color", "rgb(27, 127, 166)");
  await expect(rows.last().getByLabel("Completed")).toHaveCSS("color", "rgb(27, 127, 166)");
  await expect(rows.last().locator(":scope > div")).toHaveCSS("background-color", "rgba(27, 127, 166, 0.05)");
  await expect(progress.getByTestId("progress-intro").locator(":scope > p")).toHaveCSS("background-color", "rgba(27, 127, 166, 0.05)");
  await expect(progress.getByTestId("progress-intro-connector")).toHaveCSS("border-left-color", "rgb(183, 200, 207)");
  await expect(progress.getByTestId("progress-connector").first()).toHaveCSS("border-left-color", "rgb(183, 200, 207)");
});

test("composition renders batch-link progress below the accordion", async ({ page }, testInfo) => {
  await page.goto("/?capability=composition&state=ready");
  const root = page.getByRole("region", { exact: true, name: "Composition" });

  const progress = root.getByTestId("progress-view");
  await expect(progress).toHaveCount(0);
  await expect(root).toHaveCSS("padding-top", "12px");
  const chain = root.getByRole("button", { name: "Chain" });
  const history = root.getByRole("button", { name: "History" });
  await expect(chain).toBeVisible();
  await expect(chain.locator("..").locator(":scope > span")).toHaveText("1");
  await expect(history).toBeVisible();
  await expect(history.locator("..").locator(":scope > span")).toHaveText("2");
  await expect(root.getByText("Grant Deed", { exact: true })).toBeVisible();
  await history.click();
  await expect(root.getByText("Alice", { exact: true }).first()).toBeVisible();
  await expect(root.getByRole("combobox", { name: "Batch name" })).toHaveValue("10 Main Street");
  const actions = root.getByRole("group", { name: "Composition actions" });
  await expect(actions.getByRole("button", { name: "Link to batch" })).toBeVisible();
  await expect.poll(async () => {
    const row = root.locator("article").last();
    const [rowBox, actionsBox] = await Promise.all([row.boundingBox(), actions.boundingBox()]);
    if (!rowBox || !actionsBox) throw new Error("Composition layout is incomplete.");
    return actionsBox.y - rowBox.y - rowBox.height;
  }).toBeGreaterThanOrEqual(12);
  const [actionsBox, fieldBox, linkBox] = await Promise.all([
    actions.boundingBox(),
    root.getByRole("combobox", { name: "Batch name" }).boundingBox(),
    actions.getByRole("button", { name: "Link to batch" }).boundingBox(),
  ]);
  if (!actionsBox || !fieldBox || !linkBox) throw new Error("Composition batch controls are incomplete.");
  expect(fieldBox.width).toBeLessThanOrEqual(512);
  expect(linkBox.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height);
  expect(Math.abs((linkBox.x + linkBox.width / 2) - (actionsBox.x + actionsBox.width / 2))).toBeLessThanOrEqual(1);
  await actions.getByRole("button", { name: "Link to batch" }).click();
  await expect(progress.getByTestId("progress-caption")).toHaveText("LINKING DOCUMENT TO BATCH");
  await expect(progress.getByText("Session linked to batch.", { exact: true })).toBeVisible();
  const [accordionBox, progressBox] = await Promise.all([
    root.getByRole("region", { name: "Composition accordion" }).boundingBox(),
    progress.boundingBox(),
  ]);
  if (!accordionBox || !progressBox) throw new Error("Composition progress layout is incomplete.");
  expect(progressBox.y).toBeGreaterThanOrEqual(accordionBox.y + accordionBox.height);
  const view = root.getByRole("button", { name: "View batch" });
  await expect(view).toBeVisible();
  const viewBox = await view.boundingBox();
  if (!viewBox) throw new Error("Composition linked-batch success action is incomplete.");
  const completedRow = progress.getByRole("listitem").last();
  await expect(completedRow).toContainText("Session linked to batch.");
  await expect(completedRow.getByRole("button", { name: "View batch" })).toBeVisible();
  await expect(actions).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Link to batch" })).toHaveCount(0);
  await expect(root.getByRole("combobox", { name: "Batch name" })).toHaveCount(0);
  await expect(root.getByText("Document linked to batch.", { exact: true })).toHaveCount(0);
  const completedRowBox = await completedRow.boundingBox();
  if (!completedRowBox) throw new Error("Composition completed progress row is incomplete.");
  expect(viewBox.y).toBeGreaterThanOrEqual(completedRowBox.y);
  expect(viewBox.y + viewBox.height).toBeLessThanOrEqual(completedRowBox.y + completedRowBox.height);
  await view.click();
  await root.screenshot({ path: testInfo.outputPath("composition-ready.png") });
});

test("compute formats fees and funds and confirms endorsement", async ({ page }, testInfo) => {
  await page.goto("/?capability=compute&state=ready");
  const root = page.locator("main");

  await expect(root.getByTestId("progress-view")).toHaveCount(0);
  await expect(root.locator("[data-metadata-context='true']")).toHaveCount(0);
  const feeFactors = root.getByRole("button", { name: "Fee Factors" });
  const fees = root.getByRole("button", { name: "Fees" });
  const funds = root.getByRole("button", { name: "Funds" });
  await expect(feeFactors).toBeVisible();
  await expect(feeFactors.locator("..").locator(":scope > span")).toHaveText("1");
  await expect(fees).toBeVisible();
  await expect(fees.locator("..").locator(":scope > span")).toHaveText("1");
  await expect(funds).toBeVisible();
  await expect(funds.locator("..").locator(":scope > span")).toHaveText("1");
  await expect(root.locator("article").filter({ hasText: "$125.00" })).toContainText("Recording fee");
  await funds.click();
  await expect(root.locator("article").filter({ hasText: "$75.00" })).toContainText("General fund");
  const actions = root.getByRole("group", { name: "Compute actions" });
  await expect(actions).toHaveCSS("margin-top", "12px");
  await root.getByRole("button", { name: "Endorse" }).click();
  await expect(root.getByRole("button", { name: "Confirm" })).toBeVisible();
  await root.getByRole("button", { name: "Confirm" }).click();
  await expect(root.getByRole("button", { name: "Endorse" })).toBeVisible();
  await root.screenshot({ path: testInfo.outputPath("compute-ready.png") });
});

test("manifest renders connected active progress", async ({ page }, testInfo) => {
  await page.goto("/?capability=manifest&state=pending");
  const progress = page.getByTestId("progress-view");

  await expect(progress.getByTestId("progress-caption")).toHaveText("GENERATING THE INDEX MANIFEST");
  await expect(progress.getByText("Checking manifest status...")).toBeVisible();
  await expect(progress.getByText("Generating document manifest...")).toBeVisible();
  await expect(progress.getByLabel("In progress")).toBeVisible();
  await expect(progress.getByText("Generating document manifest...").locator("..")).toHaveCSS("background-color", "rgba(27, 127, 166, 0.05)");
  await progress.screenshot({ path: testInfo.outputPath("manifest-progress.png") });
});

test("progress scrolls its newest row into view", async ({ page }) => {
  await page.goto("/?capability=progress&state=pending");
  const progress = page.getByTestId("progress-view");
  const rows = progress.getByRole("listitem");

  await expect(rows).toHaveCount(20);
  await expect.poll(async () => progress.evaluate((node) => node.scrollTop > 0)).toBe(true);
  const geometry = await progress.evaluate((root) => {
    const row = root.querySelector("li:last-child");
    if (!(row instanceof HTMLElement)) throw new Error("Latest progress row is missing.");
    const rootRect = root.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    return {
      bottom: rowRect.bottom - rootRect.top,
      height: root.clientHeight,
      top: rowRect.top - rootRect.top,
    };
  });
  expect(geometry).toMatchObject({ bottom: expect.any(Number), height: expect.any(Number), top: expect.any(Number) });
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
});

test("redaction connects the intro and every status through a data failure", async ({ page }, testInfo) => {
  await page.goto("/?capability=redact&state=data-failed");
  const progress = page.getByTestId("progress-view");
  const rows = progress.getByRole("listitem");

  await expect(progress.getByRole("alert")).toHaveText("Retrieve metadata failed.");
  await expect(rows).toHaveCount(3);
  await expect(rows.last()).toHaveAttribute("data-phase", "failed");
  await expect(progress.getByTestId("progress-intro-connector")).toBeVisible();
  await expect(progress.getByTestId("progress-connector")).toHaveCount(2);
  const geometry = await progress.locator("[data-testid='progress-intro-connector'], [data-testid='progress-connector'], li > span[aria-label]").evaluateAll((elements) => elements.map((element) => {
    const { bottom, top } = element.getBoundingClientRect();
    return { bottom, testId: element.getAttribute("data-testid"), top };
  }));
  const introConnector = geometry[0];
  const connectors = geometry.filter(({ testId }) => testId === "progress-connector");
  const icons = geometry.filter(({ testId }) => testId === null);
  expect(introConnector.bottom).toBeGreaterThanOrEqual(icons[0].top - 1);
  expect(introConnector.top).toBeLessThanOrEqual(icons[0].top);
  for (const [index, connector] of connectors.entries()) {
    expect(connector.top).toBeLessThanOrEqual(icons[index].bottom);
    expect(connector.bottom).toBeGreaterThanOrEqual(icons[index + 1].top - 1);
  }
  await expect(progress.getByRole("button")).toHaveCount(0);
  await progress.screenshot({ path: testInfo.outputPath("redact-data-failed.png") });
});
