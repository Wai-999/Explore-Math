import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { freshSession } from "../../prediction/session";
type Subject = "vectors" | "matrices" | "derivatives" | "gradients";
const route = (id: Subject) =>
  `#/explore/${id === "vectors" || id === "matrices" ? "linear" : "calculus"}/${id}`;
const lens = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Learning lenses" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
async function skipGuide(page: Page) {
  const skip = page.getByRole("button", { name: "Skip tutorial", exact: true });
  if (await skip.isVisible()) await skip.click();
}
async function backup(page: Page) {
  await page.goto("#/learning");
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export progress", exact: true })
    .click();
  return JSON.parse(await readFile((await (await event).path())!, "utf8"));
}
// Read the learner-visible problem; independently compute its small numeric answer.
async function visibleAnswers(page: Page, id: Subject) {
  const question = await page.locator(".journey-card").innerText();
  let answers: number[];
  if (id === "vectors") {
    if (question.includes("Project a=")) {
      const a = question.match(/a=\((-?\d+),(-?\d+)\)/)!;
      answers = [Number(a[1]), 0];
    } else {
      const p = question.match(/P=\((-?\d+),(-?\d+)\)/)!,
        w = question.match(/w=\((-?\d+),(-?\d+)\)/)!,
        t = question.match(/T=\((-?\d+),(-?\d+)\)/)!;
      answers = [
        Number(t[1]) - Number(p[1]) - Number(w[1]),
        Number(t[2]) - Number(p[2]) - Number(w[2]),
      ];
    }
  } else if (id === "matrices") {
    const a = question.match(
        /rows \((-?\d+),(-?\d+),0\), \((-?\d+),(-?\d+),0\)/,
      )!,
      v = question.match(/v=\((-?\d+),(-?\d+),1\)/)!;
    answers = [
      Number(a[1]) * Number(a[4]) - Number(a[2]) * Number(a[3]),
      Number(a[1]) * Number(v[1]) + Number(a[2]) * Number(v[2]),
    ];
  } else if (id === "derivatives") {
    if (question.includes("one-sided") || question.includes("left and right"))
      answers = [-1, 1];
    else {
      const x = Number(question.match(/at x=(-?[\d.]+)/)![1]),
        h = Number(question.match(/h=([\d.]+)/)![1]);
      answers = [2 * x, 2 * x + h];
    }
  } else {
    if (question.includes("stationary point")) answers = [0, 0];
    else {
      const p = question.match(/at \((-?[\d.]+),(-?[\d.]+)\)/)!;
      const x = Number(p[1]),
        y = Number(p[2]);
      answers = question.includes("next point")
        ? [0.75 * x, 0.5 * y]
        : [x, 2 * y];
    }
  }
  return answers;
}
async function answerCurrentCase(page: Page, id: Subject) {
  const answers = await visibleAnswers(page, id);
  const inputs = page.locator(".journey-card input[type=number]");
  await expect(inputs).toHaveCount(2);
  await inputs.nth(0).fill(String(answers[0]));
  await inputs.nth(1).fill(String(answers[1]));
  await page.locator(".journey-card input[type=radio]").first().check();
}
for (const id of [
  "vectors",
  "matrices",
  "derivatives",
  "gradients",
] as Subject[]) {
  test(`${id}: discovery, two worked cases, justification, fresh challenge, and persistence`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (id === "vectors") {
      await page.goto("#/discover");
      await page
        .getByRole("link", { name: "Start with vectors", exact: true })
        .click();
      await expect(page).toHaveURL(/explore\/linear\/vectors/);
    } else await page.goto(route(id));
    await expect(page.locator("[data-concept]")).toHaveAttribute(
      "data-concept",
      id,
    );
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link"),
    ).toHaveCount(5);
    await skipGuide(page);
    await page
      .getByLabel("Before changing a value, what do you predict?")
      .fill(
        "I predict that changing one coordinate will change the matching output.",
      );
    const field = page.locator(".journey-fields input[type=number]").first();
    const before = await field.inputValue();
    await field.press("ArrowUp");
    await expect(field).not.toHaveValue(before);
    if (id === "vectors") {
      const tip = page.getByTestId("journey-control-tip");
      await tip.scrollIntoViewIfNeeded();
      const box = (await tip.boundingBox())!;
      const old = await field.inputValue();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 12,
        box.y + box.height / 2 - 8,
        { steps: 4 },
      );
      await page.mouse.up();
      await expect(field).not.toHaveValue(old);
    }
    if (id === "matrices") {
      const tip = page.getByTestId("matrix-plane-column-0");
      await tip.scrollIntoViewIfNeeded();
      const box = (await tip.boundingBox())!;
      const old = await field.inputValue();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 8,
        box.y + box.height / 2 - 6,
        { steps: 4 },
      );
      await page.mouse.up();
      await expect(field).not.toHaveValue(old);
    }
    await lens(page, "Understand");
    for (const n of [1, 2]) {
      await page
        .getByRole("button", { name: `Load worked example ${n}`, exact: true })
        .click();
      await expect(page.locator(".worked-example")).toBeVisible();
      await page
        .getByRole("button", { name: "Next example step", exact: true })
        .click();
      await expect(page.locator(".worked-example")).toContainText(
        "Worked step 2",
      );
    }
    await lens(page, "Why is it true");
    await expect(page.locator(".derivation-stepper")).toContainText(
      "Derivation from stated assumptions",
    );
    await page
      .getByRole("button", { name: "Next proof step", exact: true })
      .click();
    await expect(page.locator(".step-count")).toContainText("Step 2");
    await expect(page.locator(".journey-stage")).not.toHaveAttribute(
      "data-highlight",
      "",
    );
    await page
      .getByLabel("Explanation depth", { exact: true })
      .selectOption("advanced");
    await expect(page.locator(".depth-extension")).toContainText("Deep:");
    await page
      .getByLabel("Explanation depth", { exact: true })
      .selectOption("research");
    await expect(page.locator(".depth-extension")).toContainText("Rigorous:");
    await page
      .getByLabel("Explanation depth", { exact: true })
      .selectOption("intuition");
    await lens(page, "Use it");
    await expect(
      page.getByRole("button", {
        name: "Reveal this solution after an attempt",
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByLabel("Explain why your method applies")
      .fill(
        "I applied the stated coordinate or derivative rule, checked its assumptions, and kept the units consistent. A numerical result alone is not a general proof.",
      );
    await answerCurrentCase(page, id);
    await page
      .getByRole("button", { name: "Check this fresh case", exact: true })
      .click();
    await expect(page.locator(".journey-feedback")).toContainText(
      "Objective check passed for seed 17",
    );
    await page
      .getByText("Take a snapshot and reflect", { exact: true })
      .click();
    await page
      .getByLabel("Observation", { exact: true })
      .fill("The scene and live numbers changed together.");
    await page
      .getByLabel("Reflection / next experiment", { exact: true })
      .fill("Next I will change one assumption and test a new case.");
    await page
      .getByRole("button", { name: "Save experiment snapshot", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Try fresh parameters", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Give a conceptual hint", exact: true })
      .click();
    await answerCurrentCase(page, id);
    await page
      .getByRole("button", { name: "Check this fresh case", exact: true })
      .click();
    await expect(page.locator(".journey-feedback")).toContainText(
      "This attempt is guided",
    );
    await page.reload();
    await expect(page.locator(".journey-card")).toContainText("seed 34");
    await expect(page.locator(".journey-card")).toContainText(
      "Current case is guided",
    );
    await page.screenshot({
      path: `test-results/v2-${id}-${info.project.name}.png`,
      fullPage: true,
    });
    const exported = await backup(page),
      record = exported.journeys[id];
    expect(
      record.attempts.filter(
        (a: { activity: string }) => a.activity === "practice",
      ),
    ).toHaveLength(2);
    expect(record.attempts[0]).toMatchObject({
      correct: true,
      guided: false,
      seed: 17,
      attemptNumber: 1,
      reasoning: "unreviewed",
    });
    expect(record.attempts[1]).toMatchObject({
      correct: true,
      guided: true,
      seed: 34,
    });
    expect(record.snapshots).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}
test("function and gradient counterexamples keep undefined states and assumptions honest", async ({
  page,
}) => {
  await page.goto(route("derivatives"));
  await skipGuide(page);
  const h = page.getByRole("spinbutton", {
    name: "Signed gap h (unitless)",
    exact: true,
  });
  await h.fill("0");
  await expect(page.locator(".journey-interpretation")).toContainText(
    "undefined",
  );
  await expect(page.locator(".metrics")).toContainText("undefined at h=0");
  await page.getByLabel("Function case", { exact: true }).selectOption("jump");
  await lens(page, "Why is it true");
  await expect(page.locator(".journey-card h2")).toContainText(
    "unequal one-sided",
  );
  await page
    .getByLabel("Explanation depth", { exact: true })
    .selectOption("research");
  await expect(page.locator(".depth-extension")).toContainText("No single L");
  await page.getByLabel("Function case", { exact: true }).selectOption("cusp");
  await expect(page.locator(".metrics")).toContainText("does not exist here");
  await expect(page.locator(".depth-extension")).toContainText(
    "Continuity holds",
  );
  await page.goto(route("vectors"));
  await skipGuide(page);
  await page
    .getByLabel("Vector question", { exact: true })
    .selectOption("projection");
  await lens(page, "Why is it true");
  await page
    .getByRole("button", { name: "Load a counterexample", exact: true })
    .click();
  await expect(page.locator(".metrics")).toContainText("undefined");
  await expect(page.locator(".journey-warning")).toContainText(
    "nonzero assumption fails",
  );
  await page.goto(route("gradients"));
  await skipGuide(page);
  await page.getByLabel("Objective", { exact: true }).selectOption("valleys");
  await lens(page, "Why is it true");
  await expect(page.locator(".journey-card h2")).toContainText("saddle");
  await expect(page.locator(".metrics")).toContainText("(0, 0)");
  await page
    .getByRole("button", { name: "Take a gradient step", exact: true })
    .click();
  await expect(page.locator(".journey-feedback")).toContainText("0.25 → 0.25");
  await page.getByLabel("Objective", { exact: true }).selectOption("bowl");
  await page
    .getByRole("button", { name: "Load a counterexample", exact: true })
    .click();
  await expect(page.locator(".journey-warning")).toContainText(
    "does not apply",
  );
  await expect(page.locator(".journey-interpretation")).toContainText(
    "raises energy",
  );
});
test("R1 routes remain accessible, responsive, keyboard usable, and functional without WebGL", async ({
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
  for (const theme of ["dark", "light"]) {
    await page.goto("#/learning");
    await page.getByLabel("Appearance").selectOption(theme);
    for (const id of [
      "vectors",
      "matrices",
      "derivatives",
      "gradients",
    ] as Subject[]) {
      await page.goto(route(id));
      await skipGuide(page);
      for (const name of [
        "Discover",
        "Understand",
        "Why is it true",
        "Use it",
      ]) {
        await lens(page, name);
        const scan = await new AxeBuilder({ page }).analyze();
        expect(
          scan.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical",
          ),
          `${theme}/${id}/${name}`,
        ).toEqual([]);
      }
    }
  }
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of [
      "vectors",
      "matrices",
      "derivatives",
      "gradients",
    ] as Subject[]) {
      await page.goto(route(id));
      await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
    }
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(route("matrices"));
  await lens(page, "Discover");
  const field = page.getByRole("spinbutton", {
    name: "Matrix a (row 1 column 1)",
    exact: true,
  });
  await field.focus();
  await field.press("ArrowUp");
  await expect(field).toHaveValue("1.1");
  await page.getByText("Show the 3D volume view", { exact: true }).click();
  await expect(page.locator(".fallback-notice")).toContainText(
    "WebGL2 is unavailable",
  );
  await page.screenshot({
    path: `test-results/v2-phone-fallback-${info.project.name}.png`,
    fullPage: true,
  });
});
test("legacy progress, guided history and a saved project survive protected backup and restore", async ({
  page,
}) => {
  const original = JSON.stringify({
    version: 2,
    theme: "light",
    depth: "foundations",
    solved: [
      {
        id: "old-proof",
        seed: 42,
        at: "2026-10-25T00:00:00.000Z",
        attempts: 2,
      },
    ],
    bookmarks: ["transform-space"],
    attempts: { "old-proof": 2 },
    studio: {
      energy: {
        ...freshSession(),
        hypothesis: "Preserve this earlier prediction experiment.",
      },
    },
    studioHistory: [],
  });
  await page.addInitScript((raw) => {
    if (!localStorage.getItem("v2-protected-fixture")) {
      localStorage.setItem("math-world-3d:v2", raw);
      localStorage.setItem("v2-protected-fixture", "yes");
    }
  }, original);
  await page.goto(route("vectors"));
  await skipGuide(page);
  await lens(page, "Use it");
  await answerCurrentCase(page, "vectors");
  await page
    .getByRole("button", { name: "Check this fresh case", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Create a project from this idea", exact: true })
    .click();
  await expect(page).toHaveURL(/applications\/builder\/vector-navigation/);
  await page
    .getByLabel("Project name", { exact: true })
    .fill("My first V2 project");
  await page.locator(".builder-steps button").nth(2).click();
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const exported = await backup(page);
  expect(exported.studio.energy.hypothesis).toContain("Preserve");
  expect(exported.solved[0].id).toBe("old-proof");
  expect(exported.projects[0].title).toBe("My first V2 project");
  expect(exported.journeys.vectors.attempts[0].guided).toBe(false);
  const protectedEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download original saved data", exact: true })
    .click();
  expect(await readFile((await (await protectedEvent).path())!, "utf8")).toBe(
    original,
  );
  const input = page.locator("input[type=file]");
  await input.setInputFiles({
    name: "future.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...exported, version: 99 })),
  });
  await expect(page.getByRole("status")).toContainText(
    "not a valid Math World",
  );
  const currentEvent = page.waitForEvent("download");
  await input.setInputFiles({
    name: "roundtrip.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await currentEvent;
  await expect(page.getByRole("status")).toContainText("Backup restored");
  await page.reload();
  await expect(
    page.getByRole("link", { name: "My first V2 project →", exact: true }),
  ).toBeVisible();
  await page.goto(route("vectors"));
  await expect(page.locator(".journey-card")).toContainText("seed 17");
  await page.goto("#/applications/builder/quadratic-cost");
  await page.goBack();
  await expect(page.locator("[data-concept]")).toHaveAttribute(
    "data-concept",
    "vectors",
  );
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Make an idea your own",
  );
});

test("real Tab and keyboard input complete vector, calculus, and applied tasks in SVG mode", async ({
  page,
  browserName,
}) => {
  test.setTimeout(90000);
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
  async function tabTo(target: ReturnType<Page["locator"]>) {
    await expect(target).toBeVisible();
    const visited: string[] = [];
    const forward =
      browserName === "webkit" && process.platform === "darwin"
        ? "Alt+Tab"
        : "Tab";
    let key = forward;
    for (let i = 0; i < 140; i++) {
      if (await target.evaluate((el) => el === document.activeElement)) return;
      visited.push(
        await page.evaluate(() => {
          const e = document.activeElement;
          return `${e?.tagName}: ${e?.getAttribute("aria-label") || e?.textContent?.slice(0, 45)}`;
        }),
      );
      // Some headless browsers leave focus on the last link at the page boundary.
      // A keyboard user can reverse direction instead of needing programmatic focus.
      if (
        visited.length >= 4 &&
        visited.slice(-4).every((x) => x === visited.at(-1))
      )
        key = key === forward ? "Shift+Tab" : forward;
      await page.keyboard.press(key);
    }
    throw Error(
      `Keyboard Tab could not reach ${(await target.getAttribute("aria-label")) || (await target.innerText())}. Focus cycle: ${visited.slice(-30).join(" → ")}`,
    );
  }
  async function activate(target: ReturnType<Page["locator"]>) {
    await tabTo(target);
    await page.keyboard.press("Enter");
  }
  async function type(target: ReturnType<Page["locator"]>, value: string) {
    await tabTo(target);
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+A" : "Control+A",
    );
    await page.keyboard.type(value);
  }
  for (const id of ["vectors", "derivatives"] as Subject[]) {
    await page.goto(route(id));
    const skip = page.getByRole("button", {
      name: "Skip tutorial",
      exact: true,
    });
    if (await skip.isVisible()) await activate(skip);
    await activate(
      page
        .getByRole("navigation", { name: "Learning lenses" })
        .getByRole("button", { name: /Use it/ }),
    );
    const answers = await visibleAnswers(page, id),
      inputs = page.locator(".journey-card input[type=number]");
    await type(inputs.nth(0), String(answers[0]));
    await type(inputs.nth(1), String(answers[1]));
    const rule = page.locator(".journey-card input[type=radio]").first();
    await tabTo(rule);
    await page.keyboard.press("Space");
    await activate(
      page.getByRole("button", { name: "Check this fresh case", exact: true }),
    );
    await expect(page.locator(".journey-feedback")).toContainText(
      "Objective check passed",
    );
  }
  await page.goto("#/applications/builder/vector-navigation");
  await type(
    page.getByLabel("Project name", { exact: true }),
    "Keyboard route project",
  );
  await type(
    page.getByLabel("What do you predict before changing an input?", {
      exact: true,
    }),
    "I can counter the wind using a displacement in the same frame and meter units.",
  );
  await activate(page.getByRole("button", { name: /Run my experiment/ }));
  await type(
    page.getByRole("spinbutton", {
      name: "Control displacement x (m)",
      exact: true,
    }),
    "6",
  );
  await type(
    page.getByRole("spinbutton", {
      name: "Control displacement y (m)",
      exact: true,
    }),
    "3",
  );
  await activate(
    page.getByRole("button", { name: "Check numeric goal", exact: true }),
  );
  await expect(page.locator(".builder-notice")).toContainText(
    "numeric goal is met",
  );
  await activate(page.getByRole("button", { name: /Reflect on the result/ }));
  await type(
    page.getByLabel(
      "Your decision, explanation, limitations, and next experiment",
      { exact: true },
    ),
    "I used destination minus start minus wind, all in meters. This model does not include real drone dynamics.",
  );
  await activate(
    page.getByRole("button", { name: "Save project", exact: true }),
  );
  await expect(page.locator(".builder-notice")).toContainText(
    "Project saved on this device",
  );
});
