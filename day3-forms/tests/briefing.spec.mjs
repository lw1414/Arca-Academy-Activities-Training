import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PREVIEW = path.join(process.cwd(), 'briefing', 'preview.html');

test.describe('Morning briefing — preview', () => {
  test.beforeAll(() => {
    // Run the preview command with --demo so we don't need Supabase or Groq for the smoke test
    const r = spawnSync('node', ['morning-briefing.mjs', 'preview', '--demo'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: false,
    });
    if (r.status !== 0) {
      throw new Error(`preview command failed (exit ${r.status}):\nSTDOUT: ${r.stdout}\nSTDERR: ${r.stderr}`);
    }
    expect(fs.existsSync(PREVIEW), 'preview.html should exist').toBe(true);
  });

  test('preview HTML renders headline, 3 top picks, full leads table, dashboard CTA', async ({ page }) => {
    await page.goto('/briefing/preview.html', { waitUntil: 'domcontentloaded' });

    // Headline banner
    await expect(page.locator('text=Morning briefing')).toBeVisible();

    // 6 sample leads should appear in the table
    for (const email of [
      'emily.johnson@acmecorp.com',
      'michael.smith@finflow.com',
      'olivia.brown@growthlab.com',
      'james.williams@stackr.com',
      'sophia.davis@clarityhq.com',
      'liam.miller@buildco.com',
    ]) {
      await expect(page.locator(`text=${email}`).first()).toBeVisible();
    }

    // Dashboard CTA button
    await expect(page.locator('a:has-text("Open dashboard")')).toHaveAttribute('href', /dashboard\.html/);

    // Footer attribution
    await expect(page.locator('text=morning-briefing.mjs')).toBeVisible();
  });
});
