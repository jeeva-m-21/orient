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

test.describe('Orient Persona E2E Usability Journeys (SPRINT-8.2)', () => {
  test('Persona Journey 1 (Meera): Agent finishes task → Open Inbox → Review delta and mark reviewed', async ({
    page
  }) => {
    const startTime = Date.now();
    await page.goto('/');

    // 1. Meera lands and opens the Inbox
    await page.getByTestId('nav-inbox').click();
    await expect(page.getByTestId('inbox-screen')).toBeVisible();

    // 2. High priority outdated change flagged
    await expect(page.getByText('Outdated Card: Stripe Webhook Changes')).toBeVisible();

    // 3. Meera clicks to review diff and card
    const reviewBtn = page.getByRole('button', { name: /Review Diff/i }).first();
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // 4. Explorer opens with the affected card selected
    await expect(page.getByTestId('card-panel')).toBeVisible();

    // 5. Outdated delta banner is prominently displayed
    const deltaBanner = page.getByTestId('outdated-delta-banner');
    await expect(deltaBanner).toBeVisible();
    await expect(deltaBanner).toContainText('Interface drift detected');

    // 6. Meera verifies and clicks "Mark Reviewed"
    const markReviewedBtn = page.getByRole('button', { name: /Mark Reviewed/i });
    await expect(markReviewedBtn).toBeVisible();
    await markReviewedBtn.click();
    await expect(page.getByRole('button', { name: 'Reviewed' })).toBeVisible();

    // 7. Meera returns to Inbox and clears all items to reach calm "All Clear"
    await page.getByTestId('nav-inbox').click();
    await page.getByTestId('mark-all-reviewed-btn').click();
    await expect(page.getByTestId('empty-inbox-state')).toBeVisible();
    await expect(page.getByText('All Clear')).toBeVisible();

    // Verify time constraint (< 90 seconds)
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    expect(elapsedSeconds).toBeLessThan(90);

    // Capture Meera journey screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'persona-meera-triage.png'), fullPage: true });
  });

  test('Persona Journey 2 (Arjun): Onboarding engineer → Start Here path → Locate routes & key files', async ({
    page
  }) => {
    const startTime = Date.now();
    await page.goto('/');

    // 1. Arjun starts on Overview
    await page.getByTestId('nav-overview').click();
    await expect(page.getByTestId('overview-screen')).toBeVisible();

    // 2. Clicks "Start Here Path" button
    const startHereBtn = page.getByTestId('start-here-btn');
    await expect(startHereBtn).toBeVisible();
    await startHereBtn.click();

    // 3. Lands on Auth card
    const cardPanel = page.getByTestId('card-panel');
    await expect(cardPanel).toContainText('src/auth');

    // 4. Locates the key file and routes
    const keyFile = page.getByTestId('key-file-src/auth/routes.ts');
    await expect(keyFile).toBeVisible();
    await keyFile.click();

    // 5. Code Drawer opens with route definitions
    const drawer = page.getByTestId('code-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('authRoutes');

    // Verify time constraint (< 120 seconds)
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    expect(elapsedSeconds).toBeLessThan(120);

    // Capture Arjun journey screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'persona-arjun-onboarding.png'), fullPage: true });
  });

  test('Persona Journey 3 (Kabir): Low-focus mode → Step-by-step walkthrough of core modules', async ({
    page
  }) => {
    await page.goto('/');

    // 1. Kabir triggers Focus Mode via top toggle
    await page.getByTestId('focus-mode-toggle').click();

    // 2. Distraction-free single pane is displayed
    await expect(page.getByTestId('left-rail')).not.toBeVisible();
    await expect(page.getByTestId('repository-tree')).not.toBeVisible();
    await expect(page.getByTestId('card-panel')).toBeVisible();

    // 3. Step 1: Root module
    await expect(page.getByText('FOCUS MODE · STEP 1 OF 4')).toBeVisible();

    // 4. Step 2: Next card
    await page.getByTestId('focus-next-btn').click();
    await expect(page.getByText('FOCUS MODE · STEP 2 OF 4')).toBeVisible();

    // 5. Step 3: Next card
    await page.getByTestId('focus-next-btn').click();
    await expect(page.getByText('FOCUS MODE · STEP 3 OF 4')).toBeVisible();

    // 6. Step 4: Next card
    await page.getByTestId('focus-next-btn').click();
    await expect(page.getByText('FOCUS MODE · STEP 4 OF 4')).toBeVisible();

    // Capture Kabir journey screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'persona-kabir-focus.png'), fullPage: true });
  });

  test('Persona Journey 4 (Priya): Lead audit → Structural findings & container topology', async ({
    page
  }) => {
    await page.goto('/');

    // 1. Priya opens Overview
    await page.getByTestId('nav-overview').click();
    await expect(page.getByTestId('overview-screen')).toBeVisible();

    // 2. Reviews Top Structural Findings
    await expect(page.getByText('Top Findings')).toBeVisible();
    await expect(page.getByText('Untested payment webhook logic')).toBeVisible();
    await expect(page.getByText('High centrality module (12 reverse imports)')).toBeVisible();

    // 3. Inspects System Container Topology
    await expect(page.getByTestId('container-diagram')).toBeVisible();
    await expect(page.getByTestId('diagram-node-auth')).toBeVisible();
    await expect(page.getByTestId('diagram-node-stripe')).toBeVisible();

    // 4. Exports Mermaid diagram
    const exportBtn = page.getByTestId('export-mermaid-btn');
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    // Capture Priya journey screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'persona-priya-audit.png'), fullPage: true });
  });
});
