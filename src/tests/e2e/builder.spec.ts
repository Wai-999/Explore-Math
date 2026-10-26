import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
async function phase(page: Page, index: number) {
  await page.locator(".builder-steps button").nth(index).click();
}
async function exported(page: Page) {
  await page.getByText("Portable project files", { exact: true }).click();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export project JSON", exact: true })
    .click();
  return JSON.parse(await readFile((await (await event).path())!, "utf8"));
}
test("vector project can be solved, saved, restored, and exported without granting mastery", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("#/applications/builder/vector-navigation");
  await page
    .getByLabel("Project name", { exact: true })
    .fill("My harbor delivery");
  await page
    .getByLabel("What do you predict before changing an input?", {
      exact: true,
    })
    .fill(
      "Increasing the control x displacement should move the landing right.",
    );
  await page
    .getByRole("button", { name: "Run my experiment", exact: false })
    .click();
  const control = page.getByRole("spinbutton", {
    name: "Control displacement x (m)",
    exact: true,
  });
  await control.focus();
  await control.press("ArrowUp");
  await expect(control).toHaveValue("0.1");
  await control.fill("6");
  await page
    .getByRole("spinbutton", {
      name: "Control displacement y (m)",
      exact: true,
    })
    .fill("3");
  await page
    .getByRole("button", { name: "Check numeric goal", exact: true })
    .click();
  await expect(page.locator(".builder-notice")).toContainText(
    "numeric goal is met",
  );
  await page
    .getByRole("button", { name: "Reflect on the result", exact: false })
    .click();
  await page
    .getByLabel(
      "Your decision, explanation, limitations, and next experiment",
      { exact: true },
    )
    .fill(
      "I subtracted the start and wind from the destination in meters. The model omits acceleration and uncertain wind; next I would change the wind before planning an actual flight.",
    );
  await page
    .getByRole("checkbox", {
      name: "I reviewed my explanation using this rubric.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.locator(".builder-notice")).toContainText(
    "Project saved on this device",
  );
  const first = await exported(page);
  expect(first.version).toBe(1);
  expect(first.parameters.controlX).toBe(6);
  expect(first.evidence.goalMet).toBe(true);
  expect(first.evidence.hintUsed).toBe(false);
  expect(first.evidence.selfChecked).toBe(true);
  await page
    .getByText("Show me the code (marks guided)", { exact: true })
    .click();
  await phase(page, 1);
  await page
    .getByText("Experiment tools: undo, reset, compare", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reset model inputs", exact: true })
    .click();
  await phase(page, 2);
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page.goto("#/learning");
  await page
    .getByRole("link", { name: "My harbor delivery →", exact: true })
    .click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "My harbor delivery",
  );
  await phase(page, 2);
  await expect(page.locator(".builder-stage")).toContainText(
    "Solution or remix guidance was used",
  );
  await page.getByText(/Saved projects \(/).click();
  await page.getByLabel("Import a project JSON file").setInputFiles({
    name: "future.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...first, version: 99 })),
  });
  await expect(page.locator(".builder-notice")).toContainText(
    "not a supported version-1 project",
  );
  await page.getByLabel("Import a project JSON file").setInputFiles({
    name: "roundtrip.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(first)),
  });
  await expect(page.locator(".builder-notice")).toContainText(
    "Imported into a draft",
  );
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "My harbor delivery imported",
  );
  await phase(page, 2);
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page.reload();
  await page.getByText(/Saved projects \(/).click();
  await expect(page.locator(".builder-library")).toContainText(
    "Saved projects (2/20)",
  );
  expect(errors).toEqual([]);
});
test("business project compares interior/boundary optima and reproduces its code", async ({
  page,
}) => {
  await page.goto("#/applications/builder/quadratic-cost");
  await page
    .getByLabel("Project name", { exact: true })
    .fill("My workshop cost model");
  await phase(page, 1);
  await page
    .getByRole("spinbutton", {
      name: "Production quantity q (units)",
      exact: true,
    })
    .fill("6");
  await page
    .getByRole("button", { name: "Check numeric goal", exact: true })
    .click();
  await expect(page.locator(".builder-notice")).toContainText(
    "numeric goal is met",
  );
  await page
    .getByRole("spinbutton", {
      name: "Linear coefficient b ($/unit)",
      exact: true,
    })
    .fill("4");
  await page
    .getByRole("spinbutton", {
      name: "Production quantity q (units)",
      exact: true,
    })
    .fill("0");
  await page
    .getByRole("button", { name: "Check numeric goal", exact: true })
    .click();
  await expect(page.locator(".builder-notice")).toContainText(
    "numeric goal is met",
  );
  await page
    .getByRole("spinbutton", {
      name: "Quadratic coefficient a ($/unit²)",
      exact: true,
    })
    .fill("0.25");
  await page
    .getByRole("spinbutton", {
      name: "Linear coefficient b ($/unit)",
      exact: true,
    })
    .fill("-20");
  await page
    .getByRole("spinbutton", {
      name: "Production quantity q (units)",
      exact: true,
    })
    .fill("20");
  await page
    .getByRole("button", { name: "Check numeric goal", exact: true })
    .click();
  await expect(page.locator(".builder-notice")).toContainText(
    "numeric goal is met",
  );
  await page
    .getByText("Trace the worked calculation (marks guided)", { exact: true })
    .click();
  await expect(page.locator(".builder-stage")).toContainText("outside [0,20]");
  await phase(page, 2);
  await page.getByText("Portable project files", { exact: true }).click();
  await page
    .getByText("Show me the code (marks guided)", { exact: true })
    .click();
  const codeEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Python example", exact: true })
    .click();
  const source = await readFile((await (await codeEvent).path())!, "utf8");
  const result = JSON.parse(
    execFileSync("python3", ["-c", source], { encoding: "utf8" }),
  );
  expect(result).toMatchObject({ cost: 100, optimum: 20, minimum: 100 });
  const reportEvent = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Download project report (marks guided)",
      exact: true,
    })
    .click();
  const report = await readFile((await (await reportEvent).path())!, "utf8");
  expect(report).toContain("## Calculations");
  expect(report).toContain("hint/solution used: yes");
  expect(report).toContain("Feasible minimum: q = 20, C = 100.");
});
test("builder stages are accessible in both themes and fit phone/tablet layouts", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: unknown,
    ) {
      if (type === "webgl" || type === "webgl2") return null;
      return native.call(this, type, options);
    } as typeof native;
  });
  for (const theme of ["dark", "light"]) {
    await page.goto("#/learning");
    await page.getByLabel("Appearance").selectOption(theme);
    await page.goto("#/applications/builder/vector-navigation");
    for (let i = 0; i < 3; i++) {
      await phase(page, i);
      const scan = await new AxeBuilder({ page }).analyze();
      expect(
        scan.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
        `${theme}/${i}`,
      ).toEqual([]);
    }
  }
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (let i = 0; i < 3; i++) {
      await phase(page, i);
      await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
    }
  }
  await phase(page, 1);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({
    path: `test-results/builder-phone-${info.project.name}.png`,
    fullPage: true,
  });
});
