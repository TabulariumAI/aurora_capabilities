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
  await expect(root.getByRole("combobox", { name: "Batch name" })).toHaveCount(0);
  const actions = root.getByRole("group", { name: "Composition actions" });
  await expect(actions.getByRole("button", { name: "Link to batch" })).toBeVisible();
  await expect.poll(async () => {
    const row = root.locator("article").last();
    const [rowBox, actionsBox] = await Promise.all([row.boundingBox(), actions.boundingBox()]);
    if (!rowBox || !actionsBox) throw new Error("Composition layout is incomplete.");
    return actionsBox.y - rowBox.y - rowBox.height;
  }).toBeGreaterThanOrEqual(12);
  const [actionsBox, linkBox] = await Promise.all([
    actions.boundingBox(),
    actions.getByRole("button", { name: "Link to batch" }).boundingBox(),
  ]);
  if (!actionsBox || !linkBox) throw new Error("Composition batch controls are incomplete.");
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
  await expect(root.getByRole("status", { name: "Save status" })).toHaveText("Ready to endorse.");
  await expect(root.getByRole("group", { name: "Funds subtotal" })).toHaveText("$75.00");
  await expect(root.getByRole("note", { name: "Row status legend" })).toContainText("No ambiguity reported");
  await expect(root.locator("[data-metadata-context='true']")).toHaveCount(0);
  const feeFactors = root.getByRole("button", { name: "Factors" });
  const fees = root.getByRole("button", { name: "Fees", exact: true });
  const funds = root.getByRole("button", { name: "Funds", exact: true });
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

for (const width of [390, 840]) {
  test(`compute controls fit and confirm without changing data at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?capability=compute&state=ready");
    const root = page.getByRole("region", { name: "Compute", exact: true });
    const total = root.getByRole("group", { name: "Compute total" });
    await expect(total).toContainText("$125.00");
    await expect(root.getByRole("alert")).toHaveText("Fees ($125.00) and Funds ($75.00) do not match.");
    const alerts: string[] = [];
    page.on("dialog", async dialog => {
      alerts.push(dialog.message());
      await dialog.accept();
    });
    for (const [section, name, amount, formula] of [
      ["Fees", "Recording fee", "$125.00", "base + pages"],
      ["Funds", "General fund", "$75.00", "flat"],
    ]) {
      await root.getByRole("button", { name: section, exact: true }).click();
      await expect(total).toBeVisible();
      await expect(root.getByRole("button", { name: new RegExp(`Reprocess ${section}|Clear ${section}|Edit `) })).toHaveCount(0);
      const row = root.locator("article").filter({ hasText: name });
      await expect(row.getByText(amount, { exact: true })).toHaveCSS("text-align", "right");
      for (const action of ["Delete"]) {
        const button = row.getByRole("button", { name: `${action} ${name}`, exact: true });
        const count = alerts.length;
        await button.focus();
        await page.keyboard.press("Enter");
        expect(alerts).toHaveLength(count);
        await expect(row.getByRole("button", { name: "Confirm", exact: true })).toHaveAttribute("data-armed", "true");
        await expect(button).toHaveAttribute("data-armed", "false", { timeout: 6_000 });
        expect(alerts).toHaveLength(count);
      }
      const count = alerts.length;
      await expect(row.getByRole("button", { name: `Formula ${name}`, exact: true })).toHaveCount(0);
      await expect(row).not.toContainText("Formula:");
      await row.getByRole("button", { name: "Expand details", exact: true }).click();
      await expect(row).toContainText(`Formula: ${formula}`);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(alerts).toHaveLength(count);
      await row.screenshot({ path: testInfo.outputPath(`compute-expanded-${section.toLowerCase()}-${width}.png`) });
      await row.getByRole("button", { name: "Collapse details", exact: true }).click();
      await expect(row).not.toContainText("Formula:");
      expect(await root.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      const boxes = await row.evaluate(node => Array.from(node.querySelectorAll("button, .compute-value")).map(element => element.getBoundingClientRect().toJSON()));
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
      }
      const valueBox = await row.locator(".compute-value").boundingBox();
      const actionsBox = await row.getByRole("group").boundingBox();
      expect(valueBox!.x + valueBox!.width).toBeLessThanOrEqual(actionsBox!.x);
      expect(Math.abs(valueBox!.y + valueBox!.height / 2 - actionsBox!.y - actionsBox!.height / 2)).toBeLessThanOrEqual(1);
      await root.screenshot({ path: testInfo.outputPath(`compute-${section.toLowerCase()}-${width}.png`) });
    }
    await root.getByRole("button", { name: "Factors", exact: true }).click();
    await expect(root.getByText("4", { exact: true })).toHaveCSS("text-align", "right");
    const factorRight = await root.getByText("4", { exact: true }).evaluate(node => node.getBoundingClientRect().right);
    await root.getByRole("button", { name: "Fees", exact: true }).click();
    const feeRight = await root.locator("article").getByText("$125.00", { exact: true }).evaluate(node => node.getBoundingClientRect().right);
    await root.getByRole("button", { name: "Funds", exact: true }).click();
    const fundRight = await root.locator("article").getByText("$75.00", { exact: true }).evaluate(node => node.getBoundingClientRect().right);
    expect(factorRight).toBeGreaterThan(feeRight);
    expect(Math.abs(feeRight - fundRight)).toBeLessThanOrEqual(1);
    await root.getByRole("button", { name: "Factors", exact: true }).click();
    const factorRow = root.locator("article").filter({ hasText: "Page count" });
    const copyBox = await factorRow.getByRole("button", { name: "Copy value 4", exact: true }).boundingBox();
    const expandBox = await factorRow.getByRole("button", { name: "Expand details", exact: true }).boundingBox();
    expect(expandBox!.x - copyBox!.x - copyBox!.width).toBeLessThanOrEqual(3);
    await factorRow.getByRole("button", { name: "Expand details", exact: true }).click();
    await expect(factorRow).toContainText("Explanation: Counted pages.");
    await root.screenshot({ path: testInfo.outputPath(`compute-factors-${width}.png`) });
  });
}

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
