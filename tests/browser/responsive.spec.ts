import "dotenv/config";
import { test, expect, devices } from "@playwright/test";
import fs from "fs";
import path from "path";
import { pool } from "../../src/db";
import { bookingFixture, cleanupFixture, type Fixture } from "../booking-fixture";

interface TestDevice {
  name: string;
  slug: string;
  viewport: { width: number; height: number };
  userAgent?: string;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

const TEST_DEVICES: TestDevice[] = [
  { name: "iPhone SE", slug: "iphone-se", ...devices["iPhone SE"] },
  { name: "iPhone 13", slug: "iphone-13", ...devices["iPhone 13"] },
  { name: "iPhone 14 Pro Max", slug: "iphone-14-pro-max", ...devices["iPhone 14 Pro Max"] },
  { name: "Pixel 5", slug: "pixel-5", ...devices["Pixel 5"] },
  { name: "iPad Mini", slug: "ipad-mini", ...devices["iPad Mini"] },
  { name: "iPad Pro 11", slug: "ipad-pro-11", ...devices["iPad Pro 11"] },
  {
    name: "Desktop 1280x800",
    slug: "desktop-1280x800",
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
  },
  {
    name: "Desktop 1440x900",
    slug: "desktop-1440x900",
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
  },
  {
    name: "Desktop 1920x1080",
    slug: "desktop-1920x1080",
    viewport: { width: 1920, height: 1080 },
    isMobile: false,
    hasTouch: false,
  },
];

const PUBLIC_ROUTES = [
  { path: "/login", name: "login" },
  { path: "/planos", name: "planos" },
  { path: "/agendar/studio-prime", name: "agendar-studio-prime" },
  { path: "/minhas-reservas", name: "minhas-reservas" },
  { path: "/termos", name: "termos" },
  { path: "/privacidade", name: "privacidade" },
];

test.describe("Public & Marketing Mobile-First Responsive Verification Suite", () => {
  for (const device of TEST_DEVICES) {
    test.describe(`Device: ${device.name}`, () => {
      for (const route of PUBLIC_ROUTES) {
        test(`Route: ${route.name} (${route.path}) on ${device.name}`, async ({ page }) => {
          const pageErrors: string[] = [];
          page.on("pageerror", (err) => pageErrors.push(err.message));

          await page.setViewportSize(device.viewport);
          await page.goto(route.path, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(400);

          // 1. Validate NO horizontal overflow: scrollWidth <= clientWidth + 1
          const overflowData = await page.evaluate(() => {
            const doc = document.documentElement;
            const body = document.body;
            const docWidth = doc.scrollWidth;
            const bodyWidth = body.scrollWidth;
            const clientWidth = doc.clientWidth;
            const innerWidth = window.innerWidth;
            return {
              docWidth,
              bodyWidth,
              clientWidth,
              innerWidth,
              hasOverflow: docWidth > clientWidth + 1 || bodyWidth > clientWidth + 1,
            };
          });

          expect(
            overflowData.hasOverflow,
            `Horizontal overflow on ${route.path} with ${device.name}: docWidth=${overflowData.docWidth}, bodyWidth=${overflowData.bodyWidth}, clientWidth=${overflowData.clientWidth}`
          ).toBe(false);

          // 2. Validate zero console / page errors
          expect(pageErrors, `Uncaught page errors on ${route.path} with ${device.name}`).toEqual([]);

          // 3. Validate interactive touch targets on key action buttons (>= 44x44px where applicable)
          if (route.path === "/login") {
            const submitBtn = page.locator('button[type="submit"]').first();
            if (await submitBtn.isVisible()) {
              const box = await submitBtn.boundingBox();
              if (box) {
                expect(box.height, "Login submit button height should be >= 44px").toBeGreaterThanOrEqual(44);
              }
            }
          }

          if (route.path.startsWith("/agendar/")) {
            const actionBtn = page.locator("button").first();
            if (await actionBtn.isVisible()) {
              const box = await actionBtn.boundingBox();
              if (box && box.height > 0) {
                expect(box.height, "Action button height in booking flow should be >= 40px").toBeGreaterThanOrEqual(40);
              }
            }
          }

          // 4. Validate navigation behavior relative to md breakpoint (768px)
          const isBelowMd = device.viewport.width < 768;
          const mobileMenuBtn = page.locator(".mobile-menu-button");
          if ((await mobileMenuBtn.count()) > 0) {
            if (isBelowMd) {
              await expect(mobileMenuBtn, "Mobile hamburger button should be visible below md").toBeVisible();
              const box = await mobileMenuBtn.boundingBox();
              if (box) {
                expect(box.width, "Hamburger button width >= 44px").toBeGreaterThanOrEqual(44);
                expect(box.height, "Hamburger button height >= 44px").toBeGreaterThanOrEqual(44);
              }
            } else {
              await expect(mobileMenuBtn, "Mobile hamburger button should be hidden at md and above").toBeHidden();
            }
          }

          // 5. Capture and save visual regression screenshot
          const screenshotDir = path.join(process.cwd(), "test-results", "responsive", route.name);
          fs.mkdirSync(screenshotDir, { recursive: true });
          const screenshotPath = path.join(screenshotDir, `${device.slug}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          expect(fs.existsSync(screenshotPath)).toBe(true);
        });
      }
    });
  }
});

test.describe("Authenticated Dashboard, Calendar & Management Responsive Suite", () => {
  let f: Fixture;

  test.beforeAll(async () => {
    f = await bookingFixture();
  });

  test.afterAll(async () => {
    // Do not close the shared `pool` here: the "Narrow Viewport Deep Audit"
    // describe block below also needs it and runs afterward in the same
    // worker process. Only the last describe block in this file should end it.
    await cleanupFixture(f);
  });

  const AUTH_TEST_DEVICES: TestDevice[] = [
    { name: "iPhone 13", slug: "iphone-13", ...devices["iPhone 13"] },
    { name: "Pixel 5", slug: "pixel-5", ...devices["Pixel 5"] },
    { name: "iPad Mini", slug: "ipad-mini", ...devices["iPad Mini"] },
    {
      name: "Desktop 1440x900",
      slug: "desktop-1440x900",
      viewport: { width: 1440, height: 900 },
      isMobile: false,
      hasTouch: false,
    },
  ];

  for (const device of AUTH_TEST_DEVICES) {
    test(`Dashboard & Agenda responsive flow on ${device.name}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      await page.setViewportSize(device.viewport);
      await page.request.post("/api/auth/login", {
        data: { email: f.owner.email, password: f.password },
      });

      // Navigate to Dashboard
      await page.goto("/gestao", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);

      const isBelowMd = device.viewport.width < 768;

      // 1. Validate No Overflow on Dashboard
      const dashboardOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          hasOverflow: doc.scrollWidth > doc.clientWidth + 1 || document.body.scrollWidth > doc.clientWidth + 1,
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      expect(dashboardOverflow.hasOverflow, `Dashboard overflow on ${device.name}`).toBe(false);

      // 2. Validate navigation
      const hamburger = page.locator(".mobile-menu-button");
      if (isBelowMd) {
        await expect(hamburger).toBeVisible();
        const box = await hamburger.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);

        // Open mobile drawer
        await hamburger.click();
        const sidebar = page.locator(".sidebar.mobile-open");
        await expect(sidebar).toBeVisible();

        // Close button touch target >= 44x44
        const closeBtn = page.locator(".mobile-close-button");
        await expect(closeBtn).toBeVisible();
        const closeBox = await closeBtn.boundingBox();
        expect(closeBox?.width).toBeGreaterThanOrEqual(44);
        expect(closeBox?.height).toBeGreaterThanOrEqual(44);

        // Close mobile drawer
        await closeBtn.click();
        await expect(sidebar).toBeHidden();

        // Check mobile bottom navigation
        const bottomNav = page.locator(".mobile-bottom-nav");
        await expect(bottomNav).toBeVisible();
      } else {
        await expect(hamburger).toBeHidden();
        await expect(page.locator(".sidebar")).toBeVisible();
        await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
      }

      // 3. Navigate to Calendar/Agenda View (real path route — "?view=" is not a
      // routing convention this app understands; /gestao/page.tsx hardcodes
      // initialView="dashboard" and the query string is silently ignored, so
      // asserting here proves we actually left the dashboard).
      await page.goto("/gestao/agenda", { waitUntil: "domcontentloaded" });
      const filterRow = page.locator(".calendar-filter-row").first();
      await expect(filterRow, `Calendar filter row should render on /gestao/agenda for ${device.name}`).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(400);

      const agendaOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          hasOverflow: doc.scrollWidth > doc.clientWidth + 1 || document.body.scrollWidth > doc.clientWidth + 1,
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      expect(agendaOverflow.hasOverflow, `Agenda overflow on ${device.name}`).toBe(false);

      // 3b. Professional filter (select) must never be clipped by the viewport.
      const professionalSelect = filterRow.locator("select, .select-input").first();
      await expect(professionalSelect).toBeVisible();
      const selectBox = await professionalSelect.boundingBox();
      if (selectBox) {
        expect(selectBox.x, `Professional select left edge clipped on ${device.name}`).toBeGreaterThanOrEqual(0);
        expect(
          selectBox.x + selectBox.width,
          `Professional select right edge clipped by viewport on ${device.name}`,
        ).toBeLessThanOrEqual(device.viewport.width + 1);
      }

      // 3c. Professional legend chips: either they all fit without any scroll
      // needed, or the row is a genuine horizontal-scroll container and every
      // chip is reachable by scrolling it (never permanently cut off with no
      // way to reach it, which was the originally reported bug).
      const legendChips = page.locator(".legend-chip");
      const chipCount = await legendChips.count();
      if (chipCount > 0) {
        const rowScroll = await filterRow.evaluate((el) => ({
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: getComputedStyle(el).overflowX,
        }));
        const rowOverflows = rowScroll.scrollWidth > rowScroll.clientWidth + 1;
        if (rowOverflows) {
          expect(
            ["auto", "scroll"].includes(rowScroll.overflowX),
            `Legend chips overflow their row on ${device.name} but the row does not scroll (overflow-x: ${rowScroll.overflowX}) — chips would be permanently cut off`,
          ).toBe(true);
          // Prove the last chip is actually reachable via scroll, not just theoretically.
          await filterRow.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
          await page.waitForTimeout(150);
          const lastChipBox = await legendChips.last().boundingBox();
          if (lastChipBox) {
            expect(
              lastChipBox.x + lastChipBox.width,
              `Last professional chip still clipped by viewport after scrolling row to end on ${device.name}`,
            ).toBeLessThanOrEqual(device.viewport.width + 1);
          }
          await filterRow.evaluate((el) => { el.scrollLeft = 0; });
        } else {
          // No scroll needed — every chip must sit fully inside the row already.
          const rowBox = await filterRow.boundingBox();
          for (let i = 0; i < chipCount; i++) {
            const chipBox = await legendChips.nth(i).boundingBox();
            if (chipBox && rowBox) {
              expect(
                chipBox.x + chipBox.width,
                `Legend chip ${i} overflows the filter row on ${device.name}`,
              ).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
            }
          }
        }
      }

      const agendaDir = path.join(process.cwd(), "test-results", "responsive", "gestao-agenda");
      fs.mkdirSync(agendaDir, { recursive: true });
      await page.screenshot({ path: path.join(agendaDir, `${device.slug}.png`), fullPage: true });

      // 4. Navigate to Serviços View and verify catalog loads cleanly without errors
      await page.goto("/gestao/servicos", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);

      const servicosOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          hasOverflow: doc.scrollWidth > doc.clientWidth + 1 || document.body.scrollWidth > doc.clientWidth + 1,
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      expect(servicosOverflow.hasOverflow, `Serviços overflow on ${device.name}`).toBe(false);
      await expect(page.getByRole("heading", { name: "Serviços Avulsos" })).toBeVisible();

      // Open "Novo serviço" modal
      const novoServicoBtn = page.getByRole("button", { name: "Novo serviço" }).first();
      await expect(novoServicoBtn).toBeVisible();
      await novoServicoBtn.click();
      await expect(page.getByLabel("Nome do serviço")).toBeVisible();

      // 5. Save screenshot
      const servicosDir = path.join(process.cwd(), "test-results", "responsive", "gestao-servicos");
      fs.mkdirSync(servicosDir, { recursive: true });
      await page.screenshot({ path: path.join(servicosDir, `${device.slug}.png`), fullPage: true });

      // 6. "Seu link público" hero card: the action row (Copiar link, Visualizar,
      // Compartilhar, QR Code, Page Builder) must never let a button spill past
      // the card's right edge — this was reported cut off with no wrap on mobile.
      await page.goto("/gestao/link-agendamento", { waitUntil: "domcontentloaded" });
      const linkTab = page.getByRole("button", { name: "Link & Informações" });
      await linkTab.waitFor({ state: "attached", timeout: 10000 });
      await linkTab.click();

      const heroCard = page.locator('[class*="heroCard"]').first();
      await expect(heroCard).toBeVisible();
      const actionButtons = page.locator('[class*="urlActions"] button, [class*="urlActions"] a');
      const actionCount = await actionButtons.count();
      expect(actionCount, "Seu link público action row should render its buttons").toBeGreaterThan(0);
      const heroBox = await heroCard.boundingBox();
      for (let i = 0; i < actionCount; i++) {
        const box = await actionButtons.nth(i).boundingBox();
        if (box && heroBox) {
          expect(
            box.x + box.width,
            `Link público action button ${i} overflows the hero card on ${device.name}`,
          ).toBeLessThanOrEqual(heroBox.x + heroBox.width + 1);
        }
      }

      const linkDir = path.join(process.cwd(), "test-results", "responsive", "link-agendamento");
      fs.mkdirSync(linkDir, { recursive: true });
      await page.screenshot({ path: path.join(linkDir, `${device.slug}.png`), fullPage: true });

      // 7. Open Page Builder 2.0 and verify it loads completely (no infinite loading spinner)
      if (device.slug === "desktop-1440x900") {
        // Step 6 switched to the "Link & Informações" tab — go back to Branding
        // Studio, which is where the save button and Page Builder entry live.
        await page.getByRole("button", { name: "Identidade & Branding Studio" }).click();
        await page.waitForTimeout(300);

        // Verify Branding Studio save button styling and visibility (not bugged/washed out)
        const saveBtn = page.getByRole("button", { name: "Salvar alterações" }).first();
        await expect(saveBtn).toBeVisible();

        const btnStyles = await saveBtn.evaluate((el) => {
          const cs = window.getComputedStyle(el);
          return {
            color: cs.color,
            backgroundColor: cs.backgroundColor,
            opacity: cs.opacity,
            cursor: cs.cursor,
            filter: cs.filter,
          };
        });

        // Ensure filter is not washing out the button and text is clearly readable
        expect(btnStyles.filter).toBe("none");
        expect(btnStyles.opacity).toBe("1");

        // Click save button and verify successful save feedback
        await saveBtn.click();
        await expect(page.getByRole("button", { name: "Salvo!" }).first()).toBeVisible({ timeout: 5000 });

        // Save screenshot of Branding Studio with working button
        const brandingDir = path.join(process.cwd(), "test-results", "responsive", "branding-studio");
        fs.mkdirSync(brandingDir, { recursive: true });
        await page.screenshot({ path: path.join(brandingDir, "branding-save-button.png") });

        const pageBuilderBtn = page.getByRole("button", { name: "Page Builder 2.0 (Visual)", exact: true });
        await expect(pageBuilderBtn).toBeVisible();
        await pageBuilderBtn.click();

        // Must load past the loading spinner and render toolbar and exit button
        const exitBtn = page.getByRole("button", { name: "Voltar" }).first();
        await expect(exitBtn).toBeVisible({ timeout: 15000 });
        await expect(page.getByText("Carregando Page Builder 2.0...")).toBeHidden();

        // Exit Page Builder
        await exitBtn.click();
        await expect(pageBuilderBtn).toBeVisible();
      }

      expect(pageErrors).toEqual([]);
    });
  }
});

test.describe("Narrow Viewport Deep Audit (iPhone SE 320px)", () => {
  // This viewport is the tightest realistic width in the matrix and is what
  // originally exposed every bug below. Page-level scrollWidth checks miss
  // these because `.main-content { overflow-x: clip }` silently clips
  // overflowing content instead of producing a scrollable/measurable
  // document width — so each check here inspects the specific element.
  let f: Fixture;

  test.beforeAll(async () => {
    f = await bookingFixture();
  });

  test.afterAll(async () => {
    await cleanupFixture(f);
    await pool.end();
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 667 });
    await page.request.post("/api/auth/login", { data: { email: f.owner.email, password: f.password } });
  });

  test("KPI metric card labels wrap instead of truncating with ellipsis", async ({ page }) => {
    await page.goto("/gestao/clientes", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const labels = page.locator(".metric-copy p");
    const count = await labels.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const label = labels.nth(i);
      const text = (await label.innerText()).trim();
      expect(text.endsWith("…") || text.endsWith("..."), `Metric label truncated: "${text}"`).toBe(false);
      const overflowsOwnBox = await label.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflowsOwnBox, `Metric label clipped within its own box: "${text}"`).toBe(false);
    }
  });

  test("Sort control label ('Ordenar:') never breaks mid-word", async ({ page }) => {
    await page.goto("/gestao/clientes", { waitUntil: "domcontentloaded" });
    const sortLabel = page.locator(".sort-label").first();
    await expect(sortLabel).toBeVisible();
    const box = await sortLabel.boundingBox();
    // A single-line label at this font size is well under 24px tall; the
    // original bug rendered it across 4 broken lines at ~66px tall.
    expect(box && box.height).toBeLessThan(24);
    expect((await sortLabel.innerText()).replace(/\s+/g, " ")).toBe("Ordenar:");
  });

  test("Relatórios analytics panels (Status/Equipe) never exceed the viewport", async ({ page }) => {
    await page.goto("/gestao/relatorios", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Status dos Atendimentos")).toBeVisible({ timeout: 10000 });
    const panels = page.locator(".reports-panel");
    const count = await panels.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await panels.nth(i).boundingBox();
      if (box) {
        expect(box.x, `reports-panel ${i} starts left of viewport`).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width, `reports-panel ${i} extends past the 320px viewport`).toBeLessThanOrEqual(321);
      }
    }
  });

  test("Profile page action buttons (Página de Agendamento / Salvar) wrap instead of overflowing", async ({ page }) => {
    await page.goto("/gestao/perfil", { waitUntil: "domcontentloaded" });
    const saveBtn = page.getByRole("button", { name: "Salvar alterações" }).first();
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    const linkBtn = page.getByRole("button", { name: "Página de Agendamento" });
    await expect(linkBtn).toBeVisible();
    const saveBox = await saveBtn.boundingBox();
    const linkBox = await linkBtn.boundingBox();
    if (saveBox) {
      expect(saveBox.x + saveBox.width, "Salvar alterações button overflows viewport").toBeLessThanOrEqual(321);
    }
    if (linkBox) {
      expect(linkBox.x + linkBox.width, "Página de Agendamento button overflows viewport").toBeLessThanOrEqual(321);
    }
  });

  test("Modal footer buttons are never covered by the fixed bottom nav", async ({ page }) => {
    await page.goto("/gestao", { waitUntil: "domcontentloaded" });
    const customizeBtn = page.getByRole("button", { name: "Personalizar início" });
    await customizeBtn.waitFor({ state: "visible", timeout: 15000 });
    await customizeBtn.click();

    const saveBtn = page.getByRole("button", { name: "Salvar preferências" });
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    // Playwright's actionability check fails if another element (like the nav
    // bar sitting at a higher z-index) intercepts the click target.
    await saveBtn.click({ trial: true });

    const nav = page.locator(".mobile-bottom-nav");
    const saveBox = await saveBtn.boundingBox();
    const navBox = await nav.boundingBox();
    if (saveBox && navBox) {
      const verticallyOverlaps = saveBox.y < navBox.y + navBox.height && saveBox.y + saveBox.height > navBox.y;
      if (verticallyOverlaps) {
        const modalZ = await page.locator(".modal").first().evaluate((el) => Number(getComputedStyle(el).zIndex));
        const navZ = await nav.evaluate((el) => Number(getComputedStyle(el).zIndex));
        expect(modalZ, "Modal z-index must be above the bottom nav when they occupy the same screen area").toBeGreaterThan(navZ);
      }
    }
  });

  test("Service editor: Cancelar/Salvar footer has bottom breathing room and stacks", async ({ page }) => {
    await page.goto("/gestao/servicos", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Novo serviço" }).first().click();
    await page.getByLabel("Nome do serviço").waitFor({ state: "visible", timeout: 10000 });

    const cancelBtn = page.getByRole("button", { name: "Cancelar" });
    const saveBtn = page.getByRole("button", { name: "Salvar serviço" });
    await expect(cancelBtn).toBeVisible();
    await expect(saveBtn).toBeVisible();

    const cancelBox = await cancelBtn.boundingBox();
    const viewportHeight = page.viewportSize()?.height ?? 667;
    if (cancelBox) {
      // The footer must leave real breathing room below the last button
      // instead of sitting flush against the screen edge (previously 0px).
      expect(viewportHeight - (cancelBox.y + cancelBox.height), "Cancelar button has no bottom breathing room").toBeGreaterThan(8);
    }
    // Stacked (column) layout means Cancelar sits below Salvar, not beside it.
    const saveBox = await saveBtn.boundingBox();
    if (saveBox && cancelBox) {
      expect(cancelBox.y, "Cancelar/Salvar should stack vertically, not sit side by side").toBeGreaterThan(saveBox.y);
    }
  });

  test("Service editor: pricing mode toggle stacks instead of wrapping mid-label", async ({ page }) => {
    await page.goto("/gestao/servicos", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Novo serviço" }).first().click();
    const quoteBtn = page.getByRole("button", { name: "Orçamento direto (Sob consulta)" });
    await expect(quoteBtn).toBeVisible({ timeout: 10000 });
    const box = await quoteBtn.boundingBox();
    // A single-line label (with this button's padding) is ~34px tall; wrapped
    // to 2 lines (the original bug) it was closer to 50-60px.
    expect(box && box.height).toBeLessThan(40);
  });

  test("Shared identity notice never orphans a lone period on its own line", async ({ page }) => {
    await page.goto("/gestao/perfil", { waitUntil: "domcontentloaded" });
    const notice = page.getByText("Identidade Visual Compartilhada");
    await expect(notice).toBeVisible({ timeout: 10000 });
    const paragraphs = await page.locator(".profile-identity-notice-banner .notice-content p").allInnerTexts();
    for (const text of paragraphs) {
      for (const line of text.split("\n")) {
        expect(line.trim().startsWith("."), `Orphaned leading period in: "${line}"`).toBe(false);
      }
    }
  });

  test("Branding Studio embedded preview never leaks a fixed CTA bar over the admin nav", async ({ page }) => {
    await page.goto("/gestao/link-agendamento", { waitUntil: "domcontentloaded" });
    // Scroll to the preview's own sticky CTA bar specifically — scrolling to
    // an unrelated anchor point can put a `position: fixed` descendant that's
    // correctly contained by a transformed ancestor at coordinates that
    // coincidentally look like a viewport-bottom overlap without one being
    // visually true; checking at the bar itself avoids that false positive.
    await page.locator('[class*="mobileBottomBar"]').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const nav = page.locator(".mobile-bottom-nav");
    const navBox = await nav.boundingBox();
    // Nothing besides the real nav/sidebar/toast should claim a fixed position
    // reaching the bottom 100px of the real viewport — the embedded booking
    // preview's own sticky CTA bar must stay contained inside its frame.
    const offenders = await page.evaluate(() => {
      const allowed = ["mobile-bottom-nav", "sidebar", "toast-stack", "sidebar-backdrop"];
      const found: string[] = [];
      document.querySelectorAll("*").forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed") return;
        if (el.getBoundingClientRect().bottom < window.innerHeight - 100) return;
        const cls = (el as HTMLElement).className?.toString() ?? "";
        if (allowed.some((a) => cls.includes(a))) return;
        found.push(`${el.tagName}.${cls.slice(0, 60)}`);
      });
      return found;
    });
    expect(offenders, `Unexpected fixed-position elements reaching the bottom nav area: ${offenders.join(", ")}`).toEqual([]);
    expect(navBox).toBeTruthy();
  });
});
