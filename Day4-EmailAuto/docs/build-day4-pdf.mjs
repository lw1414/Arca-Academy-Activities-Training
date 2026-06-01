import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'day4-vercel-deploy.html');
const pdfPath  = path.join(__dirname, 'day4-vercel-deploy.pdf');

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log(`✓ ${path.relative(process.cwd(), pdfPath)}`);
