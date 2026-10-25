import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function slider(page: Page, name: string, value: number) {
  const control = page.getByRole("slider", { name, exact: true });
  await control.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
test("discovery, all destinations, and subpath deep links load without console exceptions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Make the abstract",
  );
  await page.screenshot({
    path: "test-results/discover-desktop.png",
    fullPage: true,
  });
  for (const [route, title] of [
    ["explore/linear", "Transform space"],
    ["explore/calculus", "Touch change"],
    ["applications", "Ideas with a purpose"],
    ["challenges", "Put an idea to the test"],
    ["learning", "A little further every time"],
  ]) {
    await page.goto("#/" + route);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  }
  expect(errors).toEqual([]);
});
test("matrix keyboard input, SVG dragging, reset, and independent challenge share state", async ({
  page,
}) => {
  await page.goto("#/explore/linear");
  await page.getByRole("button", { name: "2D view", exact: true }).click();
  await page
    .getByRole("button", { name: "View numbers & geometry", exact: true })
    .click();
  const input = page.getByRole("spinbutton", {
    name: "Matrix row 1 column 1",
    exact: true,
  });
  await input.fill("2");
  await expect(page.locator(".metric").first()).toContainText("2");
  await input.press("ArrowDown");
  await expect(input).toHaveValue("1.95");
  const handle = page.getByTestId("vector-handle-0");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y - 25, { steps: 5 });
  await page.mouse.up();
  await expect(input).not.toHaveValue("1.95");
  await page.getByRole("button", { name: "Reset experiment" }).click();
  await expect(input).toHaveValue("1");
  await expect(page.locator(".metric").first()).toContainText("1");
  await page.getByRole("radio", { name: "Stays at 1", exact: true }).check();
  const text = await page.locator(".mission-intro").innerText();
  const angle = Number(text.match(/camera\s+(-?\d+)°/)![1]);
  await slider(page, "Rotate around z", angle);
  await page.getByRole("button", { name: "Check my transformation" }).click();
  await expect(page.locator(".feedback")).toContainText("Solved independently");
  await page.screenshot({ path: "test-results/linear-2d.png", fullPage: true });
  await page.goto("#/learning");
  await expect(
    page.getByRole("heading", { name: "1 independent solutions" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "1 independent solutions" }),
  ).toBeVisible();
});
test("3D geometry changes, orbit/home, and lost context preserve the model", async ({
  page,
}) => {
  await page.goto("#/explore/linear");
  const canvas = page.locator("canvas");
  await expect(canvas.or(page.locator(".fallback-notice"))).toBeVisible();
  if (await page.locator(".fallback-notice").isVisible()) {
    test.skip(
      true,
      "Browser does not provide WebGL2; fallback tested separately.",
    );
  }
  await expect(canvas).toBeVisible();
  const before = await canvas.screenshot();
  await page.getByRole("button", { name: "Reflect", exact: true }).click();
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
  await expect(page.locator(".metrics")).toContainText("Reversed");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 100, { steps: 4 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Home camera" }).click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Matrix row 1 column 1",
      exact: true,
    }),
  ).toHaveValue("-1");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await canvas.evaluate((el) => {
    (el as HTMLCanvasElement)
      .getContext("webgl2")
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext();
  });
  await expect(
    page.getByText("3D context was lost.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  await expect(page.locator(".metrics")).toContainText("Collapsed");
});
test("calculus gradient, overshoot, accumulation, and unfamiliar route", async ({
  page,
}) => {
  await page.goto("#/explore/calculus");
  await page.getByRole("button", { name: "2D view", exact: true }).click();
  await page
    .getByRole("radio", { name: "Opposite the gradient", exact: true })
    .check();
  await slider(page, "Particle x", -1.5);
  await slider(page, "Particle y", 1);
  for (let i = 0; i < 12; i++)
    await page.getByRole("button", { name: "Take a descent step" }).click();
  await page.getByRole("button", { name: "Check my route" }).click();
  await expect(page.locator(".feedback")).toContainText("Solved independently");
  await page.getByRole("button", { name: "Reset experiment" }).click();
  await slider(page, "Particle x", 0);
  await slider(page, "Particle y", 1);
  await slider(page, "Learning rate α", 1.2);
  await page.getByRole("button", { name: "Take a descent step" }).click();
  await expect(page.locator(".feedback")).toContainText("overshot");
  await page.getByRole("button", { name: "Slope & accumulation" }).click();
  await slider(page, "Secant gap h", 0.01);
  await expect(page.locator(".metrics")).toContainText("2.01");
  await slider(page, "Integration intervals", 64);
  await expect(page.locator(".metrics")).toContainText("2.667");
});
test("three applied missions grade mathematical outcomes and units", async ({
  page,
}) => {
  await page.goto("#/applications/robot");
  await slider(page, "Yaw around world z", 45);
  await slider(page, "Tilt around world x", 60);
  await page
    .getByRole("radio", { name: "Order changes the direction", exact: true })
    .check();
  await page.getByRole("button", { name: "Test my decision" }).click();
  await expect(page.locator(".feedback")).toContainText("Solved independently");
  await page.getByLabel("Apply rotations").selectOption("tilt-first");
  await page.getByRole("button", { name: "Test my decision" }).click();
  await expect(page.locator(".feedback")).toContainText("Keep exploring");
  await page.goto("#/applications/business");
  await page.getByLabel("Demand scenario").selectOption("100");
  await slider(page, "Daily production", 50);
  await page
    .getByRole("radio", { name: "Profit rises, then falls", exact: true })
    .check();
  await page.getByRole("button", { name: "Test my decision" }).click();
  await expect(page.locator(".feedback")).toContainText("Solved independently");
  await expect(page.locator(".metrics")).toContainText("$1900");
  await page.goto("#/applications/regression");
  await slider(page, "Slope m", 1.76);
  await slider(page, "Intercept b", 1);
  await page
    .getByRole("radio", { name: "Minimize squared residuals", exact: true })
    .check();
  await page.getByRole("button", { name: "Test my decision" }).click();
  await expect(page.locator(".feedback")).toContainText("Solved independently");
  await page.goto("#/learning");
  await expect(
    page.getByRole("heading", { name: "3 independent solutions" }),
  ).toBeVisible();
});
test("mobile, reduced motion, no WebGL, themes, and keyboard alternatives", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.goto("");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "test-results/discover-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(
    page.getByText("WebGL2 is unavailable.", { exact: false }),
  ).toBeVisible();
  const input = page.getByRole("spinbutton", {
    name: "Matrix row 1 column 1",
    exact: true,
  });
  await input.focus();
  await input.press("ArrowUp");
  await expect(input).toHaveValue("1.05");
  await page
    .getByRole("button", { name: "View numbers & geometry", exact: true })
    .click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("link", { name: /My learning settings/ }).click();
  await page.getByLabel("Appearance").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "test-results/learning-mobile-light.png",
    fullPage: true,
  });
});
test("essential paths have no serious or critical axe violations in both themes", async ({
  page,
}) => {
  for (const theme of ["dark", "light"]) {
    await page.goto("#/learning");
    await page.getByLabel("Appearance").selectOption(theme);
    for (const route of [
      "discover",
      "explore/linear",
      "explore/calculus",
      "applications/robot",
      "applications/business",
      "applications/regression",
      "learning",
    ]) {
      await page.goto("#/" + route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
        `${theme} / ${route}`,
      ).toEqual([]);
    }
  }
});
