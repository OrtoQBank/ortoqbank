import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * Screenshot Automation Tests
 *
 * Automated screenshot capture for documentation and design review.
 * Run with: npm run test:e2e -- screenshots-automation.spec.ts
 */

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');

test.beforeAll(() => {
  // Ensure screenshots directory exists
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
});

test.describe('Screenshot Automation: Full Page Captures', () => {
  const pages = [
    { name: 'homepage', path: '/' },
    { name: 'criar-teste', path: '/criar-teste' },
  ];

  for (const { name, path: pagePath } of pages) {
    test(`captures ${name} page`, async ({ page }) => {
      await page.goto(pagePath);
      await page.waitForLoadState('load');

      const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}-full.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      // Verify screenshot was created
      expect(fs.existsSync(screenshotPath)).toBe(true);
    });
  }
});

test.describe('Screenshot Automation: Component Captures', () => {
  test('captures all buttons on criar-teste page', async ({ page }) => {
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');

    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const filename = `button-${i}-${text?.slice(0, 20).replaceAll(/\s+/g, '-')}.png`;
      const screenshotPath = path.join(SCREENSHOTS_DIR, 'components', filename);

      // Ensure components directory exists
      const componentsDir = path.join(SCREENSHOTS_DIR, 'components');
      if (!fs.existsSync(componentsDir)) {
        fs.mkdirSync(componentsDir, { recursive: true });
      }

      await button.screenshot({ path: screenshotPath });
    }
  });

  test('captures all form inputs', async ({ page }) => {
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');

    const inputs = page.locator('input, select, textarea');
    const count = await inputs.count();

    const inputsDir = path.join(SCREENSHOTS_DIR, 'inputs');
    if (!fs.existsSync(inputsDir)) {
      fs.mkdirSync(inputsDir, { recursive: true });
    }

    for (let i = 0; i < Math.min(count, 10); i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type') || 'input';
      const screenshotPath = path.join(inputsDir, `${type}-${i}.png`);

      await input.screenshot({ path: screenshotPath });
    }
  });

  test('captures navigation components', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const navDir = path.join(SCREENSHOTS_DIR, 'navigation');
    if (!fs.existsSync(navDir)) {
      fs.mkdirSync(navDir, { recursive: true });
    }

    // Capture header
    const header = page.locator('header').first();
    if (await header.count() > 0) {
      await header.screenshot({ path: path.join(navDir, 'header.png') });
    }

    // Capture nav
    const nav = page.locator('nav').first();
    if (await nav.count() > 0) {
      await nav.screenshot({ path: path.join(navDir, 'nav.png') });
    }

    // Capture footer
    const footer = page.locator('footer');
    if (await footer.count() > 0) {
      await footer.screenshot({ path: path.join(navDir, 'footer.png') });
    }
  });
});

test.describe('Screenshot Automation: Multi-Device Captures', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'ultrawide', width: 2560, height: 1440 },
  ];

  for (const viewport of viewports) {
    test(`captures homepage on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('load');

      const devicesDir = path.join(SCREENSHOTS_DIR, 'devices');
      if (!fs.existsSync(devicesDir)) {
        fs.mkdirSync(devicesDir, { recursive: true });
      }

      const screenshotPath = path.join(devicesDir, `homepage-${viewport.name}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      expect(fs.existsSync(screenshotPath)).toBe(true);
    });
  }
});

test.describe('Screenshot Automation: User Flows', () => {
  test('captures quiz creation flow', async ({ page }) => {
    const flowDir = path.join(SCREENSHOTS_DIR, 'flows', 'quiz-creation');
    if (!fs.existsSync(flowDir)) {
      fs.mkdirSync(flowDir, { recursive: true });
    }

    // Step 1: Landing on criar-teste
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');
    await page.screenshot({ path: path.join(flowDir, '01-initial.png'), fullPage: true });

    // Step 2: Select mode (if available)
    const modeButtons = page.locator('button').filter({ hasText: /estudo|prova/i });
    if (await modeButtons.count() > 0) {
      await modeButtons.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(flowDir, '02-mode-selected.png'), fullPage: true });
    }

    // Step 3: Select themes (if available)
    const themeSelectors = page.locator('[role="checkbox"], input[type="checkbox"]');
    if (await themeSelectors.count() > 0) {
      await themeSelectors.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(flowDir, '03-theme-selected.png'), fullPage: true });
    }

    // Step 4: Final state
    await page.screenshot({ path: path.join(flowDir, '04-final.png'), fullPage: true });
  });
});

test.describe('Screenshot Automation: State Variations', () => {
  test('captures button state variations', async ({ page }) => {
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');

    const statesDir = path.join(SCREENSHOTS_DIR, 'states', 'buttons');
    if (!fs.existsSync(statesDir)) {
      fs.mkdirSync(statesDir, { recursive: true });
    }

    const button = page.locator('button').first();

    // Normal state
    await button.screenshot({ path: path.join(statesDir, 'normal.png') });

    // Hover state
    await button.hover();
    await page.waitForTimeout(100);
    await button.screenshot({ path: path.join(statesDir, 'hover.png') });

    // Focus state
    await button.focus();
    await page.waitForTimeout(100);
    await button.screenshot({ path: path.join(statesDir, 'focus.png') });

    // Disabled state (if we can make it disabled)
    await page.evaluate(btn => {
      (btn as HTMLButtonElement).disabled = true;
    }, await button.elementHandle());
    await button.screenshot({ path: path.join(statesDir, 'disabled.png') });
  });

  test('captures form validation states', async ({ page }) => {
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');

    const validationDir = path.join(SCREENSHOTS_DIR, 'states', 'validation');
    if (!fs.existsSync(validationDir)) {
      fs.mkdirSync(validationDir, { recursive: true });
    }

    const form = page.locator('form').first();

    // Empty state
    await form.screenshot({ path: path.join(validationDir, 'empty.png') });

    // Try to submit (may trigger validation)
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(500);
      await form.screenshot({ path: path.join(validationDir, 'errors.png') });
    }
  });
});

test.describe('Screenshot Automation: Performance Metrics', () => {
  test('captures with performance timing', async ({ page }) => {
    const metricsDir = path.join(SCREENSHOTS_DIR, 'metrics');
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }

    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    await page.waitForLoadState('load');
    const screenshotPath = path.join(metricsDir, 'homepage.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Save metrics
    const metricsPath = path.join(metricsDir, 'homepage-metrics.json');
    const metrics = {
      loadTime,
      timestamp: new Date().toISOString(),
      viewport: await page.viewportSize(),
    };

    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  });
});

test.describe('Screenshot Automation: Comparison Report', () => {
  test('generates screenshot manifest', async ({ page }) => {
    const manifest = {
      generatedAt: new Date().toISOString(),
      screenshots: [] as any[],
    };

    // Scan screenshots directory
    if (fs.existsSync(SCREENSHOTS_DIR)) {
      const scanDir = (dir: string, prefix = '') => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            scanDir(fullPath, path.join(prefix, item));
          } else if (item.endsWith('.png')) {
            manifest.screenshots.push({
              name: item,
              path: path.join(prefix, item),
              size: stats.size,
              created: stats.birthtime,
            });
          }
        }
      };

      scanDir(SCREENSHOTS_DIR);
    }

    const manifestPath = path.join(SCREENSHOTS_DIR, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    expect(fs.existsSync(manifestPath)).toBe(true);
  });
});
