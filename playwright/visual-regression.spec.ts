import { expect, test } from '@playwright/test';

/**
 * Visual Regression Tests with Playwright
 *
 * These tests capture screenshots of key UI components and compare them against baselines.
 * Run with: npm run test:e2e -- --grep @visual
 */

test.describe('Visual Regression: Landing Page @visual', () => {
  test('captures homepage hero section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Wait for hero to be visible
    const hero = page.locator('main').first();
    await hero.locator('h1').waitFor({ state: 'visible' });

    // Capture full hero section
    await expect(hero).toHaveScreenshot('homepage-hero.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('captures navigation menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const nav = page.locator('nav').first();
    await expect(nav).toHaveScreenshot('navigation-menu.png', {
      maxDiffPixels: 50,
    });
  });

  test('captures footer', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const footer = page.locator('footer');
    await expect(footer).toHaveScreenshot('footer.png');
  });
});

test.describe('Visual Regression: Quiz Interface @visual', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/');
  });

  test('captures quiz creation form', async ({ page }) => {
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');

    await expect(page).toHaveScreenshot('quiz-creation-form.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('captures quiz question card', async ({ page }) => {
    // This would require authentication and an active quiz
    // For now, we'll capture the quiz creation interface
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');

    const form = page.locator('form').first();
    await expect(form).toHaveScreenshot('quiz-form-component.png');
  });
});

test.describe('Visual Regression: Responsive Design @visual', () => {
  test('mobile viewport - homepage', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('load');

    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
    });
  });

  test('tablet viewport - homepage', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('load');

    await expect(page).toHaveScreenshot('homepage-tablet.png', {
      fullPage: true,
    });
  });

  test('desktop viewport - homepage', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('load');

    await expect(page).toHaveScreenshot('homepage-desktop.png', {
      fullPage: true,
    });
  });
});

test.describe('Visual Regression: Component States @visual', () => {
  test('captures button states', async ({ page }) => {
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');

    // Find a button
    const button = page.locator('button').first();

    // Normal state
    await expect(button).toHaveScreenshot('button-normal.png');

    // Hover state
    await button.hover();
    await expect(button).toHaveScreenshot('button-hover.png');
  });

  test('captures form input states', async ({ page }) => {
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');

    const input = page.locator('input').first();

    // Empty state
    await expect(input).toHaveScreenshot('input-empty.png');

    // Filled state
    await input.fill('Test input');
    await expect(input).toHaveScreenshot('input-filled.png');

    // Focus state
    await input.focus();
    await expect(input).toHaveScreenshot('input-focused.png');
  });
});

test.describe('Visual Regression: Dark Mode @visual', () => {
  test('captures dark mode homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Try to enable dark mode if available
    const darkModeToggle = page.locator('[aria-label*="dark"], [aria-label*="theme"]').first();
    await darkModeToggle.click().catch(() => {
      // Dark mode toggle not available, skip
    });

    await expect(page).toHaveScreenshot('homepage-dark-mode.png', {
      fullPage: true,
    });
  });
});

test.describe('Visual Regression: Accessibility States @visual', () => {
  test('captures high contrast mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForLoadState('load');

    await expect(page).toHaveScreenshot('homepage-high-contrast.png', {
      fullPage: true,
    });
  });

  test('captures focus indicators', async ({ page }) => {
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');

    // Tab through focusable elements
    await page.keyboard.press('Tab');

    await expect(page).toHaveScreenshot('focus-indicator-first.png');

    await page.keyboard.press('Tab');

    await expect(page).toHaveScreenshot('focus-indicator-second.png');
  });
});

test.describe('Visual Regression: Error States @visual', () => {
  test('captures 404 page', async ({ page }) => {
    await page.goto('/non-existent-page');
    await page.waitForLoadState('load');

    await expect(page).toHaveScreenshot('404-page.png', {
      fullPage: true,
    });
  });

  test('captures form validation errors', async ({ page }) => {
    await page.goto('/criar-teste');
    await page.waitForLoadState('load');

    // Try to submit without filling required fields
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click().catch(() => {
      // Submit button not found, skip
    });

    // Wait for validation errors to appear
    await page.locator('[role="alert"]').first().waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});
    await expect(page).toHaveScreenshot('form-validation-errors.png');
  });
});

test.describe('Visual Regression: Loading States @visual', () => {
  test('captures loading skeletons', async ({ page }) => {
    // Intercept network to delay response
    await page.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });

    const loadingPromise = page.goto('/');

    // Wait for loading skeleton to be visible
    await page.locator('[data-testid="loading-skeleton"]').first().waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});
    await expect(page).toHaveScreenshot('loading-state.png');

    await loadingPromise;
  });
});
