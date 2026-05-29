import { test, expect } from '@playwright/test';

const SAMPLES = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  return {
    name: `Test User ${String(n).padStart(2, '0')}`,
    email: `test.user${String(n).padStart(2, '0')}@example.com`,
    message: `Sample inquiry #${n}: interested in a demo and pricing details for the Tester.io platform.`,
  };
});

test.describe('Contact form — 20 mocked submissions', () => {
  for (const [i, sample] of SAMPLES.entries()) {
    test(`submission ${String(i + 1).padStart(2, '0')} — ${sample.email}`, async ({ page }) => {
      const seen = { sheets: false, supabase: false };

      await page.route('**/script.google.com/**', async (route) => {
        seen.sheets = true;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      });

      await page.route('**/*.supabase.co/functions/v1/submit', async (route) => {
        seen.supabase = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, id: `mock-id-${i + 1}` }),
        });
      });

      await page.goto('/index.html#contact', { waitUntil: 'domcontentloaded' });
      await page.locator('#cf-name').fill(sample.name);
      await page.locator('#cf-email').fill(sample.email);
      await page.locator('#cf-message').fill(sample.message);

      await Promise.all([
        page.waitForURL('**/thank-you.html', { timeout: 10_000 }),
        page.locator('#contact-form button[type="submit"], #contact-form .submit').first().click(),
      ]);

      expect(page.url()).toContain('thank-you.html');
      expect(seen.sheets, 'Google Sheets endpoint was not hit').toBe(true);
      expect(seen.supabase, 'Supabase submit endpoint was not hit').toBe(true);
    });
  }
});
