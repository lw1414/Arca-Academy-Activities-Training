import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PUPPETEER_PATH = 'C:/Users/nateh/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';

let puppeteer;
try {
  puppeteer = (await import(PUPPETEER_PATH)).default;
} catch {
  puppeteer = (await import('puppeteer')).default;
}

const url = process.argv[2];
const label = process.argv[3];
const viewportArg = process.argv[4]; // optional "mobile" or "WxH"

if (!url) {
  console.error('Usage: node screenshot.mjs <url> [label] [mobile|WxH]');
  process.exit(1);
}

const outDir = path.join(__dirname, 'temporary screenshots');
fs.mkdirSync(outDir, { recursive: true });

// find next N
let n = 1;
const existing = fs.readdirSync(outDir);
for (const f of existing) {
  const m = f.match(/^screenshot-(\d+)/);
  if (m) n = Math.max(n, parseInt(m[1], 10) + 1);
}
const fileName = label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`;
const outPath = path.join(outDir, fileName);

let viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
if (viewportArg === 'mobile' || label === 'mobile') {
  viewport = { width: 390, height: 844, deviceScaleFactor: 2 };
} else if (viewportArg && /^\d+x\d+$/.test(viewportArg)) {
  const [w, h] = viewportArg.split('x').map(Number);
  viewport = { width: w, height: h, deviceScaleFactor: 1 };
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport(viewport);
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(outPath);