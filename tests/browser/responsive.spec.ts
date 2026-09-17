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
    await cleanupFixture(f);
    await pool.end();
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

      // 3. Navigate to Calendar/Agenda View
      await page.goto("/gestao?view=agenda", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);

      const agendaOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          hasOverflow: doc.scrollWidth > doc.clientWidth + 1 || document.body.scrollWidth > doc.clientWidth + 1,
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      expect(agendaOverflow.hasOverflow, `Agenda overflow on ${device.name}`).toBe(false);

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

      expect(pageErrors).toEqual([]);
    });
  }
});
