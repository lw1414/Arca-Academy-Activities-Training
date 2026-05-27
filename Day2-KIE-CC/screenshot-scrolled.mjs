// Screenshot Sights.html at multiple scroll positions inside .sagrada-track
import path from 'node:path';
import fs from 'node:fs';

const PUPPETEER_PATH = 'C:/Users/nateh/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
let puppeteer;
try { puppeteer = (await import(PUPPETEER_PATH)).default; }
catch { puppeteer = (await import('puppeteer')).default; }

const url = process.argv[2] || 'http://localhost:3000/Sights.html';
const viewportArg = process.argv[3] || 'desktop';
const outDir = path.join(process.cwd(), 'temporary screenshots');
fs.mkdirSync(outDir, { recursive: true });

const viewport = viewportArg === 'mobile'
  ? { width: 390, height: 844, deviceScaleFactor: 2 }
  : { width: 1440, height: 900, deviceScaleFactor: 1 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport(viewport);
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
// Wait until the loader bar reaches 100%
await page.waitForFunction(() => {
  const loaders = ['pisa-loader'].map(id => document.getElementById(id)).filter(Boolean);
  return loaders.length > 0 && loaders.every(el => el.classList.contains('is-done'));
}, { timeout: 60000 });
await new Promise(r => setTimeout(r, 400));

const positions = [
  { label: 'top', p: 0 },
  { label: 'mid-blueprint', p: 0.18 },
  { label: 'mid-imagined', p: 0.48 },
  { label: 'mid-finished', p: 0.85 },
];

const trackSel = process.argv[4] || '#sagrada-familia .scrub-track';
const trackInfo = await page.evaluate((sel) => {
  const t = document.querySelector(sel);
  const r = t.getBoundingClientRect();
  return {
    top: r.top + window.scrollY,
    height: t.offsetHeight,
    viewportH: window.innerHeight,
  };
}, trackSel);

// find next index
let n = 1;
for (const f of fs.readdirSync(outDir)) {
  const m = f.match(/^screenshot-(\d+)/);
  if (m) n = Math.max(n, parseInt(m[1], 10) + 1);
}

for (const pos of positions) {
  const scrollY = trackInfo.top + pos.p * (trackInfo.height - trackInfo.viewportH);
  await page.evaluate((y) => {
    window.scrollTo(0, y);
    window.dispatchEvent(new Event('scroll'));
  }, scrollY);
  await new Promise(r => setTimeout(r, 800));
  const debug = await page.evaluate((sel) => {
    const t = document.querySelector(sel);
    const c = t.querySelector('canvas');
    const r = c ? c.getBoundingClientRect() : { top: 0, height: 0 };
    return { w: c?.width || 0, h: c?.height || 0, rectTop: r.top, rectH: r.height, sy: window.scrollY };
  }, trackSel);
  console.log(`  pos=${pos.label} scrollY=${debug.sy.toFixed(0)} canvas=${debug.w}x${debug.h} rectTop=${debug.rectTop.toFixed(0)} rectH=${debug.rectH.toFixed(0)}`);
  const out = path.join(outDir, `screenshot-${n++}-${viewportArg}-${pos.label}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(out);
}

await browser.close();
