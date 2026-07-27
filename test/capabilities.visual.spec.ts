import { expect, test } from "@playwright/test";

test("renders deterministic capability panels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Recording Summary")).toBeVisible();
  await expect(page.getByText("Redaction Ready")).toBeVisible();
  await expect(page.getByText("Manifest Ready")).toBeVisible();
});
