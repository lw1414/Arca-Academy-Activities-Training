import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUPPETEER_PATH = 'C:/Users/nateh/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';

let puppeteer;
try { puppeteer = (await import(PUPPETEER_PATH)).default; }
catch { puppeteer = (await import('puppeteer')).default; }

const url = 'http://localhost:3000/product.html';
const outDir = path.join(__dirname, 'temporary screenshots');
fs.mkdirSync(outDir, { recursive: true });

let n = 1;
for (const f of fs.readdirSync(outDir)) {
  const m = f.match(/^screenshot-(\d+)/);
  if (m) n = Math.max(n, parseInt(m[1], 10) + 1);
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));

// scroll past hero (260vh = 2340px) then walk through intro + features
const targets = [
  { label: 'visual-intro',     y: 2400 },
  { label: 'visual-movement',  y: 3100 },
  { label: 'visual-sensing',   y: 3900 },
  { label: 'visual-material',  y: 4700 },
];

for (const t of targets) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), t.y);
  await new Promise(r => setTimeout(r, 400));
  const file = `screenshot-${n++}-${t.label}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  console.log(file);
}

await browser.close();
