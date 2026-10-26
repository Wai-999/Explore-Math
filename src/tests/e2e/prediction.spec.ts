import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const stage = (page: Page, index: number) =>
  page.locator(".lesson-steps>button").nth(index).click();
async function start(page: Page, project = "demand") {
  await page.goto("#/explore/prediction");
  if (project === "energy")
    await page
      .getByRole("button", { name: /Predict tomorrow’s energy/ })
      .click();
  if (project === "maintenance")
    await page.getByRole("button", { name: /Decide what to inspect/ }).click();
  await page
    .getByLabel("Your working hypothesis")
    .fill(
      "Available historical measurements and known plans should improve on the baseline.",
    );
}
test("complete store forecast, untouched test lock, journal, transfer, and reload", async ({
  page,
}) => {
  await start(page);
  await stage(page, 1);
  const questions = page.locator(".feature-audit fieldset");
  for (let i = 0; i < 4; i++)
    await questions
      .nth(i)
      .getByRole("radio", {
        name: i < 2 ? "Available" : "Unavailable",
        exact: true,
      })
      .check();
  await stage(page, 2);
  await page
    .getByRole("radio", {
      name: "Train on earlier time; evaluate later",
      exact: true,
    })
    .check();
  await stage(page, 3);
  await page
    .getByRole("button", { name: "Train 200 updates", exact: false })
    .click();
  await expect(page.locator(".metrics")).toContainText("200");
  await stage(page, 4);
  await expect(
    page.getByRole("img", { name: /Validation rows/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Compare development models" })
    .click();
  await expect(page.getByRole("table").last()).toContainText("One-split tree");
  await page.screenshot({
    path: "test-results/prediction-validation.png",
    fullPage: true,
  });
  await stage(page, 5);
  await expect(page.locator(".metrics")).toHaveCount(0);
  await page.getByRole("button", { name: "Freeze this experiment" }).click();
  await page.getByRole("button", { name: "Open final test once" }).click();
  await expect(
    page.getByRole("button", { name: "Open final test once" }),
  ).toHaveCount(0);
  await expect(page.locator(".metrics")).toContainText("Final MAE");
  await page.reload();
  await expect(page.locator(".lesson-stage")).toContainText(
    "Final evidence opened",
  );
  await stage(page, 3);
  await expect(
    page.getByRole("button", { name: /Train 200 updates/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("slider", { name: "Learning rate", exact: true }),
  ).toBeDisabled();
  await stage(page, 6);
  const pilot = await page
    .getByRole("heading", {
      name: "A monitored pilot may be worth investigating",
    })
    .isVisible();
  await page
    .getByRole("radio", {
      name: pilot
        ? "Consider a monitored pilot, with safeguards"
        : "Hold deployment and investigate",
      exact: true,
    })
    .check();
  await page
    .getByLabel("Evidence, assumptions, and what would change your decision")
    .fill(
      "The frozen result is compared with the seasonal baseline. Synthetic coverage and known-store evaluation limit any real-world claim.",
    );
  await page
    .getByLabel("Operating plan and rollback trigger")
    .fill(
      "Manager reviews weekly errors after labels mature; preserve a manual seasonal rule and rollback on material bias.",
    );
  await stage(page, 7);
  const text = await page
    .getByLabel(/A new numerical check/)
    .getAttribute("id");
  expect(text).toBe("mae-answer");
  const label = await page.locator("label[for=mae-answer]").innerText();
  const matches = label.match(/errors are (\d+) and (\d+)/)!;
  await page
    .getByLabel(/A new numerical check/)
    .fill(String((Number(matches[1]) + Number(matches[2])) / 2));
  await page
    .getByRole("button", { name: "Check structured understanding" })
    .click();
  await expect(page.locator(".studio-feedback")).toContainText(
    "Structured checks passed",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download learning kit" }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toBe("prediction-workshops.zip");
  expect(
    (await readFile((await downloaded.path())!)).subarray(0, 2).toString(),
  ).toBe("PK");
  await page
    .getByRole("button", { name: "Fresh experiment", exact: false })
    .click();
  await expect(page.locator(".session-meta")).toContainText("59");
  await page.goto("#/learning");
  await expect(page.locator(".studio-progress")).toContainText("seed 42");
});
test("future-feature shortcut cannot pass the final-test gate", async ({
  page,
}) => {
  await start(page, "energy");
  await stage(page, 3);
  await page
    .getByRole("checkbox", { name: /Deliberately add the future/ })
    .check();
  await page.getByRole("button", { name: /Train 200 updates/ }).click();
  await stage(page, 5);
  await expect(
    page.getByRole("button", { name: "Freeze this experiment" }),
  ).toBeDisabled();
  await expect(page.locator(".lesson-stage")).toContainText(
    "remove the future-outcome feature",
  );
});
test("maintenance probabilities and threshold produce coherent decisions", async ({
  page,
}) => {
  await start(page, "maintenance");
  await stage(page, 2);
  await page
    .getByRole("radio", { name: "Separate whole machines", exact: true })
    .check();
  await expect(page.locator(".lesson-stage")).toContainText(
    "Entity overlap across the prescribed partitions: 0",
  );
  await stage(page, 3);
  await page.getByRole("button", { name: /Train 200 updates/ }).click();
  await stage(page, 4);
  await expect(
    page.getByRole("img", { name: /Validation probability calibration/ }),
  ).toBeVisible();
  const range = page.getByRole("slider", {
    name: "Inspection threshold",
    exact: true,
  });
  await range.focus();
  await range.press("Home");
  await expect(range).toHaveValue("0.05");
  await page.screenshot({
    path: "test-results/prediction-classification.png",
    fullPage: true,
  });
  await stage(page, 5);
  await page.getByRole("button", { name: "Freeze this experiment" }).click();
  await page.getByRole("button", { name: "Open final test once" }).click();
  await expect(page.locator(".metrics")).toContainText("Final error cost");
});
test("v1 progress migrates safely and v2 exports contain prediction sessions", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "math-world-3d:v1",
      JSON.stringify({
        version: 1,
        theme: "light",
        depth: "advanced",
        solved: [],
        bookmarks: ["transform-space"],
        attempts: {},
      }),
    ),
  );
  await start(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.getByLabel("Your working hypothesis")).toHaveValue(
    /Available historical/,
  );
  const values = await page.evaluate(() => ({
    old: JSON.parse(localStorage.getItem("math-world-3d:v1")!),
    next: JSON.parse(localStorage.getItem("math-world-3d:v2")!),
  }));
  expect(values.old.version).toBe(1);
  expect(values.next.version).toBe(2);
  expect(values.next.studio.demand.hypothesis).toContain(
    "Available historical",
  );
});
test("each stage is accessible in both themes and narrow layouts", async ({
  page,
}) => {
  test.setTimeout(120000);
  await start(page);
  for (const theme of ["dark", "light"]) {
    await page.goto("#/learning");
    await page.getByLabel("Appearance").selectOption(theme);
    await page.goto("#/explore/prediction");
    for (let i = 0; i < 8; i++) {
      await stage(page, i);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
        `${theme}, stage ${i}`,
      ).toEqual([]);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await stage(page, 0);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "test-results/prediction-mobile.png",
    fullPage: true,
  });
});
