import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(
  '/home/jeeva/.gemini/antigravity-cli/brain/cc9fce54-7c7a-4f41-8ee6-6eeeb0e5792d/screenshots'
);

test.beforeAll(() => {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
});

test.describe('Orient Explorer & Card E2E User Journeys (SPRINT-6.6)', () => {
  test('Journey 1: Open repository, render shell, virtual tree, and signature 10-slot card', async ({ page }) => {
    await page.goto('/');

    // Verify Shell elements
    await expect(page.getByTestId('top-bar')).toBeVisible();
    await expect(page.getByTestId('left-rail')).toBeVisible();
    await expect(page.getByTestId('status-strip')).toBeVisible();

    // Verify Tree and Card Panel
    await expect(page.getByTestId('repository-tree')).toBeVisible();
    await expect(page.getByTestId('card-panel')).toBeVisible();

    // Verify Card Badges
    await expect(page.getByTestId('status-badge')).toBeVisible();
    await expect(page.getByTestId('source-badge')).toBeVisible();

    // Capture screenshot of default Explorer view
    await page.screenshot({ path: path.join(screenshotDir, '01-explorer-default.png'), fullPage: true });
  });

  test('Journey 2: Navigate repository tree and update selected card', async ({ page }) => {
    await page.goto('/');

    // Find and click the 'src/auth' node in the tree
    const authNode = page.getByTestId('tree-node-src/auth');
    await expect(authNode).toBeVisible();
    await authNode.click();

    // Verify card updates to src/auth
    const cardPanel = page.getByTestId('card-panel');
    await expect(cardPanel).toContainText('src/auth');
    await expect(cardPanel).toContainText('Authentication subsystem');

    // Capture screenshot of selected auth card
    await page.screenshot({ path: path.join(screenshotDir, '02-tree-selected-auth.png'), fullPage: true });
  });

  test('Journey 3: Open Command Palette (Cmd+K), search, and navigate', async ({ page }) => {
    await page.goto('/');

    // Trigger Command Palette via keyboard (Cmd+K or Ctrl+K) or trigger button
    await page.getByTestId('command-palette-trigger').click();

    // Verify Command Palette is visible
    const palette = page.getByTestId('command-palette');
    await expect(palette).toBeVisible();

    // Capture screenshot of open Command Palette
    await page.screenshot({ path: path.join(screenshotDir, '03-command-palette.png') });

    // Select billing card from palette
    const billingItem = page.getByTestId('palette-item-billing');
    await expect(billingItem).toBeVisible();
    await billingItem.click();

    // Verify palette closed and card updated to billing
    await expect(palette).not.toBeVisible();
    await expect(page.getByTestId('card-panel')).toContainText('src/billing');
  });

  test('Journey 4: Open Code Preview Drawer on key file click', async ({ page }) => {
    await page.goto('/');

    // Navigate to auth card
    await page.getByTestId('tree-node-src/auth').click();

    // Click on key file 'src/auth/routes.ts'
    const keyFileBtn = page.getByTestId('key-file-src/auth/routes.ts');
    await expect(keyFileBtn).toBeVisible();
    await keyFileBtn.click();

    // Verify Code Drawer slides open with source code and line numbers
    const drawer = page.getByTestId('code-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('src/auth/routes.ts');
    await expect(drawer).toContainText('authRoutes');

    // Capture screenshot of open code drawer
    await page.screenshot({ path: path.join(screenshotDir, '04-code-drawer.png') });
  });

  test('Journey 5: Toggle Focus Mode (distraction-free single pane)', async ({ page }) => {
    await page.goto('/');

    // Toggle Focus Mode
    await page.getByTestId('focus-mode-toggle').click();

    // Verify Left Rail and Tree are hidden, Card is centered
    await expect(page.getByTestId('left-rail')).not.toBeVisible();
    await expect(page.getByTestId('repository-tree')).not.toBeVisible();
    await expect(page.getByTestId('card-panel')).toBeVisible();

    // Capture screenshot of Focus Mode
    await page.screenshot({ path: path.join(screenshotDir, '05-focus-mode.png'), fullPage: true });
  });
});
