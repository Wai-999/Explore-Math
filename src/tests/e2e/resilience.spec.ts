import { test, expect } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { readFile } from "node:fs/promises";
test("a real 3D basis-tip drag changes the shared matrix and numbers", async ({
  page,
}) => {
  await page.goto("#/explore/linear");
  const canvas = page.locator("canvas");
  await expect(canvas.or(page.locator(".fallback-notice"))).toBeVisible();
  test.skip(
    await page.locator(".fallback-notice").isVisible(),
    "WebGL2 is unavailable in this runner; numeric fallback is covered separately.",
  );
  await expect(canvas).toHaveAttribute("data-ready", "true");
  const box = (await canvas.boundingBox())!;
  const camera = new PerspectiveCamera(38, box.width / box.height, 0.1, 1000);
  camera.up.set(0, 0, 1);
  camera.position.set(4.8, -7, 4.2);
  camera.lookAt(0.2, 0.2, 0.4);
  camera.updateMatrixWorld();
  const p = new Vector3(1, 0, 0).project(camera);
  const x = box.x + ((p.x + 1) * box.width) / 2,
    y = box.y + ((1 - p.y) * box.height) / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y - 25, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.getByRole("spinbutton", {
      name: "Matrix row 1 column 1",
      exact: true,
    }),
  ).not.toHaveValue("1");
  await page.getByRole("button", { name: "View numbers & geometry" }).click();
  await expect(page.getByRole("table")).toContainText("Basis b1");
  await page.screenshot({
    path: "test-results/linear-3d-drag.png",
    fullPage: true,
  });
});
test("export, validated restore, and corrupt backup handling preserve progress", async ({
  page,
}) => {
  await page.goto("#/learning");
  await page.getByLabel("Appearance").selectOption("light");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export progress" }).click();
  const download = await downloadEvent,
    exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.version).toBe(1);
  expect(exported.theme).toBe("light");
  const input = page.locator("input[type=file]");
  await input.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.getByRole("status")).toContainText(
    "not a valid Math World",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const backupEvent = page.waitForEvent("download");
  await input.setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        ...exported,
        theme: "dark",
        bookmarks: ["transform-space"],
      }),
    ),
  });
  await backupEvent;
  await expect(page.getByRole("status")).toContainText("Backup restored");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("link", { name: "Transform space", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Transform space", exact: true }),
  ).toBeVisible();
});
test("touch-sized controls respond without loading external services", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith(new URL(baseURL!).origin) &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await page.goto(baseURL! + "#/explore/linear");
  await page.getByRole("button", { name: "2D view", exact: true }).tap();
  await page.getByRole("button", { name: "Reflect", exact: true }).tap();
  await expect(page.locator(".metrics")).toContainText("Reversed");
  await page.getByRole("button", { name: "Reset experiment" }).tap();
  await expect(page.locator(".metrics")).toContainText("Preserved");
  expect(external).toEqual([]);
  await context.close();
});
