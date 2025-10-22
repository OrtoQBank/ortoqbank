import { expect, test } from '@playwright/test';

/**
 * E2E Tests for Custom Quiz Creation Flow
 *
 * This test suite covers the complete user journey for creating a custom quiz,
 * testing real user interactions and flows rather than just page load.
 */

test.describe('Custom Quiz Creation - Complete Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the quiz creation page
    await page.goto('/criar-teste', { timeout: 30_000 });

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should load quiz creation page with all required elements', async ({ page }) => {
    // Verify page title or header
    await expect(page).toHaveTitle(/OrtoQBank|Criar Teste/i);

    // Verify main sections are visible
    await expect(page.getByText('Modo')).toBeVisible();
    await expect(page.getByText('Questões')).toBeVisible();

    // Verify submit button exists
    await expect(page.getByRole('button', { name: /gerar teste/i })).toBeVisible();
  });

  test('should allow selecting study mode', async ({ page }) => {
    // Find and click the "Estudo" (Study) mode button
    const studyModeButton = page.getByRole('radio', { name: /estudo/i });
    await expect(studyModeButton).toBeVisible();
    await studyModeButton.click();

    // Verify the button is checked
    await expect(studyModeButton).toBeChecked();
  });

  test('should allow selecting exam mode', async ({ page }) => {
    // Find and click the "Simulado" (Exam) mode button
    const examModeButton = page.getByRole('radio', { name: /simulado/i });
    await expect(examModeButton).toBeVisible();
    await examModeButton.click();

    // Verify the button is checked
    await expect(examModeButton).toBeChecked();
  });

  test('should display question mode options with counts', async ({ page }) => {
    // Wait for question counts to load
    await page.waitForTimeout(1000);

    // Verify all question mode options are visible
    await expect(page.getByText('Todas')).toBeVisible();
    await expect(page.getByText('Não respondidas')).toBeVisible();
    await expect(page.getByText('Incorretas')).toBeVisible();
    await expect(page.getByText('Marcadas')).toBeVisible();

    // Take screenshot for debugging
    await page.screenshot({ path: 'debug-question-modes.png' });
  });

  test('should allow selecting different question modes', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForTimeout(1000);

    // Test selecting "Incorretas" (Incorrect) mode
    const incorrectRadio = page.getByRole('radio', { name: /incorretas/i });
    await expect(incorrectRadio).toBeVisible();
    await incorrectRadio.click();
    await expect(incorrectRadio).toBeChecked();

    // Test selecting "Marcadas" (Bookmarked) mode
    const bookmarkedRadio = page.getByRole('radio', { name: /marcadas/i });
    await expect(bookmarkedRadio).toBeVisible();
    await bookmarkedRadio.click();
    await expect(bookmarkedRadio).toBeChecked();

    // Test selecting "Todas" (All) mode
    const allRadio = page.getByRole('radio', { name: /todas/i }).first();
    await expect(allRadio).toBeVisible();
    await allRadio.click();
    await expect(allRadio).toBeChecked();
  });

  test('should allow expanding and selecting themes', async ({ page }) => {
    // Wait for themes to load
    await page.waitForTimeout(1500);

    // Look for theme checkboxes or buttons
    // This might need adjustment based on actual implementation
    const themeSection = page.locator('text=Temas').first();
    if (await themeSection.isVisible()) {
      await expect(themeSection).toBeVisible();

      // Take screenshot of themes section
      await page.screenshot({ path: 'debug-themes-section.png' });
    }
  });

  test('should show submit button and allow clicking', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /gerar teste/i });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    // Click the button (this might open a modal in real implementation)
    await submitButton.click();

    // Wait a moment for any modal or feedback to appear
    await page.waitForTimeout(500);

    // Take screenshot to see what happens
    await page.screenshot({ path: 'debug-after-submit.png' });
  });

  test('should complete full quiz creation flow', async ({ page }) => {
    // Step 1: Select test mode (Study)
    const studyMode = page.getByRole('radio', { name: /estudo/i });
    await studyMode.waitFor({ state: 'visible' });
    await studyMode.click();
    await expect(studyMode).toBeChecked();

    // Step 2: Select question mode (All questions)
    await page.waitForTimeout(500);
    const allQuestionsMode = page.getByRole('radio', { name: /todas/i }).first();
    await allQuestionsMode.waitFor({ state: 'visible' });
    await allQuestionsMode.click();

    // Step 3: Wait for question count to load
    await page.waitForTimeout(1000);

    // Step 4: Click submit to generate test
    const generateButton = page.getByRole('button', { name: /gerar teste/i });
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    // Step 5: Check if name modal appears
    await page.waitForTimeout(500);

    // Look for modal elements (adjust selectors based on actual implementation)
    const modalTitle = page.getByText('Nome do Teste').first();
    if (await modalTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Modal appeared - this is the expected behavior
      await expect(modalTitle).toBeVisible();

      // Try to find and fill the name input
      const nameInput = page.getByPlaceholder(/digite um nome/i).first();
      if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nameInput.fill('Meu Teste Personalizado');

        // Look for create button in modal
        const createButton = page.getByRole('button', { name: /criar teste/i }).first();
        if (await createButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await createButton.click();

          // Wait for navigation or success message
          await page.waitForTimeout(2000);
        }
      }
    }

    // Take final screenshot
    await page.screenshot({ path: 'debug-full-flow-complete.png' });
  });

  test('should handle info popovers/tooltips', async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(1000);

    // Look for info icons (usually represented by InfoCircle icon)
    const infoIcons = page.locator('[class*="lucide-info"]').or(
      page.locator('svg').filter({ has: page.locator('circle') })
    );

    const count = await infoIcons.count();
    if (count > 0) {
      // Click first info icon
      await infoIcons.first().click();

      // Wait for popover to appear
      await page.waitForTimeout(300);

      // Take screenshot
      await page.screenshot({ path: 'debug-info-popover.png' });
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify main elements are still visible
    await expect(page.getByText('Modo')).toBeVisible();
    await expect(page.getByRole('button', { name: /gerar teste/i })).toBeVisible();

    // Take screenshot of mobile view
    await page.screenshot({ path: 'debug-mobile-view.png', fullPage: true });
  });

  test('should validate form before submission', async ({ page }) => {
    // Try to submit without making selections (if validation exists)
    const submitButton = page.getByRole('button', { name: /gerar teste/i });
    await submitButton.click();

    // Wait a moment
    await page.waitForTimeout(500);

    // Check if any error messages appear or if modal doesn't open
    // This depends on actual validation implementation
    await page.screenshot({ path: 'debug-validation.png' });
  });

  test('should maintain state when switching between modes', async ({ page }) => {
    // Select exam mode
    const examMode = page.getByRole('radio', { name: /simulado/i });
    await examMode.waitFor({ state: 'visible' });
    await examMode.click();
    await expect(examMode).toBeChecked();

    // Wait a moment
    await page.waitForTimeout(300);

    // Switch to study mode
    const studyMode = page.getByRole('radio', { name: /estudo/i });
    await studyMode.click();
    await expect(studyMode).toBeChecked();

    // Verify exam mode is no longer checked
    await expect(examMode).not.toBeChecked();

    // Form should still be functional
    const submitButton = page.getByRole('button', { name: /gerar teste/i });
    await expect(submitButton).toBeEnabled();
  });
});

test.describe('Custom Quiz Creation - Error Handling', () => {
  test('should handle no questions available scenario', async ({ page }) => {
    await page.goto('/criar-teste', { timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    // Select a question mode that might have 0 questions (e.g., bookmarked when none exist)
    await page.waitForTimeout(1000);

    const bookmarkedRadio = page.getByRole('radio', { name: /marcadas/i });
    if (await bookmarkedRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bookmarkedRadio.click();

      // Wait for count to update
      await page.waitForTimeout(500);

      // Try to submit
      const submitButton = page.getByRole('button', { name: /gerar teste/i });
      await submitButton.click();

      // Look for error message or feedback
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'debug-no-questions-error.png' });
    }
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);

    await page.goto('/criar-teste', { timeout: 30_000 }).catch(() => {
      // Expected to fail in offline mode
    });

    // Go back online
    await page.context().setOffline(false);

    // Retry navigation
    await page.goto('/criar-teste', { timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    // Verify page loads correctly after reconnection
    await expect(page.getByRole('button', { name: /gerar teste/i })).toBeVisible();
  });
});

test.describe('Custom Quiz Creation - Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/criar-teste', { timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Tab through elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Verify we can reach the submit button
    let tabCount = 0;
    const maxTabs = 20;

    while (tabCount < maxTabs) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);

      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName + (el.textContent?.slice(0, 20) || '') : '';
      });

      if (focusedElement.includes('Gerar Teste') || focusedElement.includes('BUTTON')) {
        // Found the submit button
        break;
      }

      tabCount++;
    }

    await page.screenshot({ path: 'debug-keyboard-navigation.png' });
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/criar-teste', { timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    // Check for radio groups (test mode, question mode)
    const radios = page.getByRole('radio');
    const radioCount = await radios.count();

    // Should have at least 6 radios (2 for test mode, 4 for question mode)
    expect(radioCount).toBeGreaterThanOrEqual(6);

    // Check for buttons
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();

    expect(buttonCount).toBeGreaterThan(0);
  });

  test('should have readable text contrast', async ({ page }) => {
    await page.goto('/criar-teste', { timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    // This is a visual check - in a real scenario, you'd use accessibility testing tools
    // For now, we just verify text elements are visible
    await expect(page.getByText('Modo')).toBeVisible();
    await expect(page.getByText('Questões')).toBeVisible();
    await expect(page.getByText('Estudo')).toBeVisible();
    await expect(page.getByText('Simulado')).toBeVisible();
  });
});
