// Renders docs/commands-reference.html to docs/commands-reference.pdf
// via Playwright (already installed for the test suite).
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'commands-reference.html');
const pdfPath  = path.join(__dirname, 'commands-reference.pdf');

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log(`✓ ${path.relative(process.cwd(), pdfPath)}`);
