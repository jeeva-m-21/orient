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

  test('Journey 6: Overview screen and container topology diagram (SPRINT-7.1, SPRINT-7.2)', async ({ page }) => {
    await page.goto('/');

    // Navigate to Overview screen via rail
    await page.getByTestId('nav-overview').click();

    // Verify Overview Screen & Container Diagram
    await expect(page.getByTestId('overview-screen')).toBeVisible();
    await expect(page.getByTestId('container-diagram')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'acme-commerce' })).toBeVisible();
    await expect(page.getByText('System Container Topology')).toBeVisible();

    // Verify SVG Nodes
    const gatewayNode = page.getByTestId('diagram-node-gateway');
    await expect(gatewayNode).toBeVisible();
    await gatewayNode.click();

    // Verify Mermaid Export button
    const exportBtn = page.getByTestId('export-mermaid-btn');
    await expect(exportBtn).toBeVisible();

    // Capture screenshot
    await page.screenshot({ path: path.join(screenshotDir, '06-overview-screen.png'), fullPage: true });
  });

  test('Journey 7: Start Here Path navigation from Overview (SPRINT-7.1)', async ({ page }) => {
    await page.goto('/');

    // Navigate to Overview screen
    await page.getByTestId('nav-overview').click();
    await expect(page.getByTestId('overview-screen')).toBeVisible();

    // Click "Start Here Path" button
    const startHereBtn = page.getByTestId('start-here-btn');
    await expect(startHereBtn).toBeVisible();
    await startHereBtn.click();

    // Verify transition to Explorer view with src/auth selected
    await expect(page.getByTestId('repository-tree')).toBeVisible();
    await expect(page.getByTestId('card-panel')).toContainText('src/auth');

    // Capture screenshot
    await page.screenshot({ path: path.join(screenshotDir, '07-start-here-transition.png'), fullPage: true });
  });

  test('Journey 8: Review Inbox screen triage and empty state (SPRINT-7.3)', async ({ page }) => {
    await page.goto('/');

    // Navigate to Inbox screen via rail
    await page.getByTestId('nav-inbox').click();

    // Verify Inbox Screen & Pending Items
    await expect(page.getByTestId('inbox-screen')).toBeVisible();
    await expect(page.getByText('Review Inbox')).toBeVisible();
    await expect(page.getByText('Outdated Card: Stripe Webhook Changes')).toBeVisible();

    // Capture screenshot with triage items
    await page.screenshot({ path: path.join(screenshotDir, '08-inbox-screen.png'), fullPage: true });

    // Mark All Reviewed
    const markAllBtn = page.getByTestId('mark-all-reviewed-btn');
    await expect(markAllBtn).toBeVisible();
    await markAllBtn.click();

    // Verify calm honest "All Clear" empty state
    await expect(page.getByTestId('empty-inbox-state')).toBeVisible();
    await expect(page.getByText('All Clear')).toBeVisible();

    // Capture screenshot of empty state
    await page.screenshot({ path: path.join(screenshotDir, '09-inbox-empty-state.png'), fullPage: true });
  });

  test('Journey 9: Activity screen monitoring real-time agent tasks (SPRINT-7.4)', async ({ page }) => {
    await page.goto('/');

    // Navigate to Activity screen via rail
    await page.getByTestId('nav-activity').click();

    // Verify Activity Screen
    await expect(page.getByTestId('activity-screen')).toBeVisible();
    await expect(page.getByText('Active Agent Sessions')).toBeVisible();
    await expect(page.getByText('Claude Code')).toBeVisible();
    await expect(page.getByText('Implementing rate limiting on /auth/login route')).toBeVisible();
    await expect(page.getByText('Cursor Agent')).toBeVisible();

    // Capture screenshot
    await page.screenshot({ path: path.join(screenshotDir, '10-activity-screen.png'), fullPage: true });
  });

  test('Journey 10: Single-pane Focus Mode walkthrough navigation (SPRINT-7.5)', async ({ page }) => {
    await page.goto('/');

    // Toggle Focus Mode
    await page.getByTestId('focus-mode-toggle').click();

    // Verify Focus Mode Header
    await expect(page.getByText('FOCUS MODE · STEP 1 OF 4')).toBeVisible();

    // Click Next
    const nextBtn = page.getByTestId('focus-next-btn');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Verify Step 2
    await expect(page.getByText('FOCUS MODE · STEP 2 OF 4')).toBeVisible();

    // Click Back
    const backBtn = page.getByTestId('focus-back-btn');
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Verify Step 1
    await expect(page.getByText('FOCUS MODE · STEP 1 OF 4')).toBeVisible();

    // Capture screenshot
    await page.screenshot({ path: path.join(screenshotDir, '11-focus-mode-walkthrough.png'), fullPage: true });
  });
});
