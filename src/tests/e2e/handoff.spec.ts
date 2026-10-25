import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const stage = (page: Page, n: number) =>
  page.locator(".lesson-steps>button").nth(n).click();
for (const project of ["energy", "maintenance", "demand"]) {
  test(`${project}: frozen batch export, Python parity, input timing, and delayed outcomes`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60000);
    await page.goto(`#/explore/prediction/${project}`);
    await stage(page, 6);
    await expect(page.locator(".batch-handoff")).toHaveCount(0);
    await stage(page, 0);
    await page
      .getByLabel("Your working hypothesis")
      .fill(
        "Available historical features should improve our declared baseline.",
      );
    await stage(page, 3);
    await page.getByRole("button", { name: /Train 200 updates/ }).click();
    await stage(page, 5);
    await page.getByRole("button", { name: "Freeze this experiment" }).click();
    await page.getByRole("button", { name: "Open final test once" }).click();
    await stage(page, 6);
    await page
      .getByText("Use the frozen model on a new batch", { exact: true })
      .click();
    const modelEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download frozen model", exact: true })
      .click();
    const model = await modelEvent;
    expect(model.suggestedFilename()).toBe(`${project}-frozen-model.json`);
    await page
      .getByRole("button", { name: "Validate & score batch", exact: true })
      .click();
    const predictions = page.getByRole("table", {
      name: /New-batch predictions/,
    });
    await expect(predictions).toContainText("Within training ranges");
    const inputsEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download scored inputs", exact: true })
      .click();
    const inputs = await inputsEvent;
    const output = testInfo.outputPath("portable-predictions.json");
    execFileSync("python3", [
      "public/workshops/serve.py",
      "score",
      (await model.path())!,
      (await inputs.path())!,
      output,
    ]);
    const portable = JSON.parse(await readFile(output, "utf8"));
    const browserPrediction = Number(
      await predictions
        .getByRole("row")
        .nth(1)
        .getByRole("cell")
        .first()
        .innerText(),
    );
    expect(browserPrediction).toBeCloseTo(portable.rows[0].prediction, 2);
    await page
      .getByRole("button", { name: "Join available outcomes", exact: true })
      .click();
    await expect(page.locator(".batch-handoff [role=status]")).toContainText(
      "0 labeled · 2 pending",
    );
    await expect(page.locator(".batch-handoff [role=status]")).toContainText(
      "Outcome performance is unavailable",
    );
    await page
      .getByRole("button", {
        name: "Advance to example label arrival",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Join available outcomes", exact: true })
      .click();
    await expect(page.locator(".batch-handoff [role=status]")).toContainText(
      "2 labeled · 0 pending",
    );
    if (project !== "maintenance")
      await expect(page.locator(".batch-handoff [role=status]")).toContainText(
        "Observed MAE 6",
      );
    await page
      .getByRole("button", { name: "Load a late input", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Validate & score batch", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "arrives after the prediction cutoff",
    );
    await expect(predictions).toHaveCount(0);
    await page
      .getByRole("button", { name: "Load an input range change", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Validate & score batch", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Join available outcomes", exact: true })
      .click();
    await expect(page.locator(".batch-handoff [role=status]")).toContainText(
      "1 of 2 issued rows",
    );
    for (const theme of ["dark", "light"]) {
      if (theme === "light") {
        await page.goto("#/learning");
        await page.getByLabel("Appearance").selectOption(theme);
        await page.goto(`#/explore/prediction/${project}`);
        await page
          .getByText("Use the frozen model on a new batch", { exact: true })
          .click();
        await page
          .getByRole("button", { name: "Validate & score batch", exact: true })
          .click();
      }
      const scan = await new AxeBuilder({ page }).analyze();
      expect(
        scan.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
        `${project}/${theme}`,
      ).toEqual([]);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await page.locator(".batch-handoff").screenshot({
      path: `test-results/handoff-${project}-${testInfo.project.name}.png`,
    });
  });
}
