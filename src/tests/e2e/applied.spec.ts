import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
test("Sales vertical slice: scene, prediction, derivation, mission and portable project", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("#/applications/worlds/sales");
  await expect(page.locator("h1")).toContainText("Sales Decision Simulator");
  const nav = page.getByRole("navigation", { name: "Applied learning stages" });
  await nav.getByRole("button", { name: "2. Predict", exact: true }).click();
  await page
    .getByRole("radio", {
      name: "Demand falls; profit can rise or fall",
      exact: true,
    })
    .check();
  await nav.getByRole("button", { name: "3. Experiment", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Price ($/item)", exact: true })
    .fill("10");
  await expect(page.locator(".applied-metrics")).toContainText("122 $/day");
  await nav
    .getByRole("button", { name: "4. Understand & Prove", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load worked example 1", exact: true })
    .click();
  await expect(page.locator(".applied-metrics")).toContainText("480 $/day");
  await page
    .getByRole("button", { name: "Load worked example 2", exact: true })
    .click();
  await expect(page.locator(".applied-metrics")).toContainText("122 $/day");
  await page
    .getByRole("button", { name: "Next proof step", exact: true })
    .click();
  await expect(page.locator(".derivation-stepper")).toContainText("Step 2");
  await nav.getByRole("button", { name: "5. Mission", exact: true }).click();
  await page
    .getByRole("button", { name: "Reveal after an attempt", exact: true })
    .isDisabled()
    .then((v) => expect(v).toBe(true));
  await page
    .getByRole("radio", {
      name: "Margin, costs and constraints determine the decision",
      exact: true,
    })
    .check();
  // Seed 17 has mix .45: interior revenue price is 78/(2×1.9).
  await page
    .getByRole("spinbutton", { name: "Price ($/item)", exact: true })
    .fill(String(78 / 3.8));
  await page
    .getByRole("button", { name: "Check mission", exact: true })
    .click();
  await expect(page.locator(".applied-feedback")).toContainText(
    "Objective met",
  );
  await page
    .getByRole("button", { name: "Conceptual hint", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Current world task" }),
  ).toContainText("Current case is guided");
  await nav.getByRole("button", { name: "6. Build", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Sales acceptance scenario");
  await page
    .getByRole("button", { name: "Save world project", exact: true })
    .click();
  await expect(page.locator(".applied-feedback")).toContainText(
    "saved locally",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export world JSON", exact: true })
    .click();
  const file = (await (await download).path())!;
  const p = JSON.parse(await readFile(file, "utf8"));
  expect(p.world).toBe("sales");
  expect(p.record.attempts[0].guided).toBe(false);
  expect(p.record.guidance.length).toBe(1);
  await page.locator("input[type=file]").setInputFiles(file);
  await expect(page.locator(".applied-feedback")).toContainText(
    "imported as a remix",
  );
  const scan = await new AxeBuilder({ page }).analyze();
  expect(
    scan.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
  await page.goto("#/learning");
  await expect(
    page.getByRole("link", {
      name: "Sales acceptance scenario →",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("link", { name: "Sales acceptance scenario →", exact: true })
    .click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Sales acceptance scenario",
  );
  await page.screenshot({
    path: `test-results/applied-sales-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("Sales 3D changes and context-loss/mobile fallback retain the same decision", async ({
  page,
}) => {
  await page.goto("#/applications/worlds/sales");
  const canvas = page.locator("canvas");
  await expect(canvas.or(page.locator(".fallback-notice"))).toBeVisible();
  if (await canvas.isVisible()) {
    await expect(canvas).toHaveAttribute("data-ready", "true");
    const before = await canvas.screenshot();
    await page
      .getByRole("spinbutton", { name: "Price ($/item)", exact: true })
      .fill("10");
    expect(before.equals(await canvas.screenshot())).toBe(false);
    await canvas.evaluate((el) =>
      (el as HTMLCanvasElement)
        .getContext("webgl2")
        ?.getExtension("WEBGL_lose_context")
        ?.loseContext(),
    );
    await expect(page.locator(".fallback-notice")).toContainText("lost");
  }
  await page
    .getByRole("spinbutton", { name: "Price ($/item)", exact: true })
    .fill("20");
  await expect(page.locator(".applied-metrics")).toContainText("542 $/day");
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 375);
  await expect(page.locator(".applied-fallback")).toBeVisible();
});
test("Marketing connects budget allocation, derivation, independent case and saved project", async ({
  page,
}) => {
  await page.goto("#/applications/worlds/marketing");
  await expect(page.locator("h1")).toContainText("Marketing Mix Sandbox");
  const nav = page.getByRole("navigation", { name: "Applied learning stages" });
  await nav
    .getByRole("button", { name: "4. Understand & Prove", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load worked example 1", exact: true })
    .click();
  await expect(page.locator(".applied-metrics")).toContainText("0 $/day");
  await page
    .getByRole("button", { name: "Load worked example 2", exact: true })
    .click();
  await expect(page.locator(".applied-metrics")).toContainText("28.877 $/day");
  await expect(page.locator(".applied-experiment")).toContainText(
    "Attribution is not incremental lift",
  );
  await nav.getByRole("button", { name: "5. Mission", exact: true }).click();
  const x = (Math.log((31 * 0.03) / (21 * 0.02)) + 0.02 * 97) / 0.05;
  await page
    .getByRole("spinbutton", { name: "Channel A spend ($/day)", exact: true })
    .fill(String(x));
  await page
    .getByRole("spinbutton", { name: "Channel B spend ($/day)", exact: true })
    .fill(String(97 - x));
  await page
    .getByRole("radio", {
      name: "Respect marginal value and constraints; use valid randomized comparisons for incrementality",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Check mission", exact: true })
    .click();
  await expect(page.locator(".applied-feedback")).toContainText(
    "Objective met",
  );
  await nav.getByRole("button", { name: "6. Build", exact: true }).click();
  await page
    .getByRole("button", { name: "Save world project", exact: true })
    .click();
  await page
    .getByText("Experiment-planning worksheet", { exact: true })
    .click();
  await page
    .getByLabel("Assignment unit and randomization", { exact: true })
    .fill("Randomize eligible stores; do not use customer identities.");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Current world task" }),
  ).toContainText("Build a reusable experiment");
  await page
    .getByText("Experiment-planning worksheet", { exact: true })
    .click();
  await expect(
    page.getByLabel("Assignment unit and randomization", { exact: true }),
  ).toHaveValue("Randomize eligible stores; do not use customer identities.");
});
test("ML loss world freezes a model before exposing its separate holdout", async ({
  page,
}) => {
  await page.goto("#/applications/worlds/ml");
  await expect(page.locator("h1")).toContainText("Train the Predictor");
  const nav = page.getByRole("navigation", { name: "Applied learning stages" });
  await nav.getByRole("button", { name: "3. Experiment", exact: true }).click();
  await page
    .getByRole("button", { name: "Take one model step", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Weight 1 (meals/feature unit)",
      exact: true,
    }),
  ).toHaveValue("1.05");
  await nav.getByRole("button", { name: "5. Mission", exact: true }).click();
  await page
    .getByRole("spinbutton", {
      name: "Weight 1 (meals/feature unit)",
      exact: true,
    })
    .fill("2");
  await page
    .getByRole("spinbutton", {
      name: "Weight 2 (meals/feature unit)",
      exact: true,
    })
    .fill("3");
  await page
    .getByRole("radio", {
      name: "Use the negative training gradient with a suitable step; evaluate a frozen model separately",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Check mission", exact: true })
    .click();
  await expect(page.locator(".applied-feedback")).toContainText(
    "Numerical objective met",
  );
  await page
    .getByRole("button", {
      name: "Freeze coefficients and evaluate held-out data",
      exact: true,
    })
    .click();
  await expect(page.locator(".applied-feedback")).toContainText("0.056667");
  await expect(
    page.getByRole("spinbutton", {
      name: "Weight 1 (meals/feature unit)",
      exact: true,
    }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("spinbutton", {
      name: "Weight 1 (meals/feature unit)",
      exact: true,
    }),
  ).toBeDisabled();
});
test("Warehouse arm uses joint coordinates, certified path and singularity reasoning", async ({
  page,
}) => {
  await page.goto("#/applications/worlds/robotics");
  await expect(page.locator("h1")).toContainText("Move the Warehouse Arm");
  const nav = page.getByRole("navigation", { name: "Applied learning stages" });
  await nav
    .getByRole("button", { name: "4. Understand & Prove", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load worked example 1", exact: true })
    .click();
  await expect(page.locator(".applied-metrics")).toContainText("(2.4, 0) m");
  await page
    .getByRole("button", { name: "Load worked example 2", exact: true })
    .click();
  await expect(page.locator(".applied-metrics")).toContainText("-0.715");
  await nav.getByRole("button", { name: "5. Mission", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Joint 1 angle (degrees)", exact: true })
    .fill("36");
  await page
    .getByRole("spinbutton", { name: "Joint 2 angle (degrees)", exact: true })
    .fill("-53");
  await page
    .getByRole("radio", {
      name: "Compose frame transforms; use the Jacobian for instantaneous rates and check the whole modeled path",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Check mission", exact: true })
    .click();
  await expect(page.locator(".applied-feedback")).toContainText(
    "Objective met",
  );
  await page
    .getByRole("button", { name: "Replay computed path", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause path replay", exact: true }),
  ).toBeVisible();
});
test("Finance rejects an infeasible proposal and checks a boundary optimum", async ({
  page,
}) => {
  await page.goto("#/applications/worlds/finance");
  await expect(page.locator("h1")).toContainText("Sustainable Profit Decision");
  const nav = page.getByRole("navigation", { name: "Applied learning stages" });
  await nav
    .getByRole("button", { name: "4. Understand & Prove", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load worked example 1", exact: true })
    .click();
  await expect(page.locator(".applied-metrics")).toContainText("248 $/day");
  await page
    .getByRole("button", { name: "Load worked example 2", exact: true })
    .click();
  await expect(page.locator(".applied-metrics")).toContainText("412 $/day");
  await page
    .getByRole("button", {
      name: "A high-profit but infeasible proposal",
      exact: true,
    })
    .click();
  await expect(page.locator(".applied-warning").first()).toContainText(
    "exceeds",
  );
  await nav.getByRole("button", { name: "5. Mission", exact: true }).click();
  const q = (20 + 0.18 * 147) / 0.96;
  await page
    .getByRole("spinbutton", {
      name: "Production quantity (items/day)",
      exact: true,
    })
    .fill(String(q));
  await page
    .getByRole("spinbutton", { name: "Investment spend ($/day)", exact: true })
    .fill(String(147 - 2 * q));
  await page
    .getByRole("radio", {
      name: "Check the feasible set, boundary candidates and the concavity assumptions",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Check mission", exact: true })
    .click();
  await expect(page.locator(".applied-feedback")).toContainText(
    "Objective met",
  );
});
test("GIS rejects a hazard route and grades the lowest-cost traversable corridor", async ({
  page,
}) => {
  await page.goto("#/applications/worlds/gis");
  await expect(page.locator("h1")).toContainText("Deliver Through the Terrain");
  const nav = page.getByRole("navigation", { name: "Applied learning stages" });
  await nav
    .getByRole("button", { name: "4. Understand & Prove", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load worked example 2", exact: true })
    .click();
  await expect(page.locator(".applied-metrics")).toContainText("1.25 m/unit t");
  await page
    .getByRole("button", {
      name: "A short route can cross a hazard",
      exact: true,
    })
    .click();
  await expect(page.locator(".applied-metrics")).toContainText(
    "blocked / infeasible",
  );
  await nav.getByRole("button", { name: "5. Mission", exact: true }).click();
  const values = await page
    .locator(".applied-metrics > div")
    .filter({ hasText: "Alternatives 0,1,2,3" })
    .locator("strong")
    .innerText();
  const costs = values.split(" · ").map(Number),
    best = costs.slice(0, 3).indexOf(Math.min(...costs.slice(0, 3)));
  await page
    .getByRole("spinbutton", { name: "Route alternative (index)", exact: true })
    .fill(String(best));
  await page
    .getByRole("radio", {
      name: "Use nonnegative graph costs; distinguish local slope from cumulative route cost",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Check mission", exact: true })
    .click();
  await expect(page.locator(".applied-feedback")).toContainText(
    "Optimal corridor found",
  );
});
for (const id of ["sales", "marketing", "ml", "robotics", "finance", "gis"]) {
  test(`${id}: mobile fallback, both themes, all stages and portable project`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
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
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`#/applications/worlds/${id}`);
    await expect(page.locator(".applied-fallback")).toBeVisible();
    await expect(page.locator(".fallback-notice")).toContainText("unavailable");
    const first = page
        .locator(".applied-controls")
        .first()
        .locator("input")
        .first(),
      before = await first.inputValue();
    await first.press("ArrowUp");
    await expect(first).not.toHaveValue(before);
    for (const theme of ["dark", "light"]) {
      await page.goto("#/learning");
      await page.getByLabel("Appearance", { exact: true }).selectOption(theme);
      await page.goto(`#/applications/worlds/${id}`);
      const nav = page.getByRole("navigation", {
        name: "Applied learning stages",
      });
      for (let stage = 0; stage < 6; stage++) {
        await nav.locator("button").nth(stage).click();
        const result = await new AxeBuilder({ page }).analyze();
        expect(
          result.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical",
          ),
          `${id}/${theme}/${stage}`,
        ).toEqual([]);
        await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 375);
      }
    }
    await page
      .getByLabel("Project name", { exact: true })
      .fill(id + " portable fixture");
    await page
      .getByRole("button", { name: "Save world project", exact: true })
      .click();
    const event = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export world JSON", exact: true })
      .click();
    const file = (await (await event).path())!,
      project = JSON.parse(await readFile(file, "utf8"));
    expect(project.world).toBe(id);
    expect(project.assumptions.length).toBeGreaterThan(2);
    await page.locator("input[type=file]").setInputFiles(file);
    await expect(page.locator(".applied-feedback")).toContainText(
      "imported as a remix",
    );
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Current world task" }),
    ).toContainText("Build a reusable experiment");
    await page.screenshot({
      path: `test-results/applied-${id}-phone-${info.project.name}.png`,
      fullPage: true,
    });
  });
}
test("six worlds stay under Applications; gallery filters and selected level survive a reload", async ({
  page,
}) => {
  await page.goto("#/applications");
  const gallery = page.getByRole("region", {
    name: "Make a decision. See its mathematics.",
    exact: true,
  });
  await expect(
    gallery.getByRole("link", { name: "Start mission →", exact: true }),
  ).toHaveCount(6);
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveCount(5);
  await page
    .getByLabel("Applied world domain", { exact: true })
    .selectOption("Sales");
  await page
    .getByLabel("World mission level", { exact: true })
    .selectOption("3");
  await expect(
    gallery.getByRole("link", { name: "Start mission →", exact: true }),
  ).toHaveCount(1);
  await gallery
    .getByRole("link", { name: "Start mission →", exact: true })
    .click();
  await expect(
    page.getByLabel("Mission difficulty", { exact: true }),
  ).toHaveValue("3");
  await page
    .getByRole("navigation", { name: "Applied learning stages" })
    .getByRole("button", { name: "6. Build", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Current world task" }),
  ).toContainText("Build a reusable experiment");
});
