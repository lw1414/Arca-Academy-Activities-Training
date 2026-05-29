import { test, expect } from '@playwright/test';

const NEW_PAGES = [
  'changelog.html', 'manifesto.html', 'careers.html', 'customers.html',
  'press.html', 'contact.html', 'privacy.html', 'terms.html',
  'security.html', 'dpa.html', 'status.html',
];

test.describe('Link integrity audit', () => {
  test('all 11 new pages return 200 and contain a footer', async ({ page }) => {
    for (const slug of NEW_PAGES) {
      const r = await page.goto('/' + slug, { waitUntil: 'domcontentloaded' });
      expect(r.status(), `${slug} status`).toBe(200);
      await expect(page.locator('.colophon')).toBeVisible();
      await expect(page.locator('.nav .brand')).toBeVisible();
    }
  });

  test('index.html has no href="#" in colophon or footer-meta', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const dead = await page.locator('.colophon a[href="#"], .footer-meta a[href="#"]').count();
    expect(dead, 'no dead # links in footer').toBe(0);
  });

  test('logo links back to index.html (not "#")', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const href = await page.locator('.nav .brand').first().getAttribute('href');
    expect(href).toBe('index.html');
  });

  test('every visible footer link in index.html resolves to 200', async ({ page, request }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const hrefs = await page.locator('.colophon a, .footer-meta a').evaluateAll(as => as.map(a => a.getAttribute('href')));
    const unique = [...new Set(hrefs)].filter(Boolean);
    for (const href of unique) {
      if (href.startsWith('http')) continue;
      const url = href.startsWith('/') ? href : '/' + href.split('#')[0];
      if (!url || url === '/') continue;
      const r = await request.get('http://localhost:3000' + url);
      expect(r.status(), `${href} → ${url}`).toBe(200);
    }
  });
});
