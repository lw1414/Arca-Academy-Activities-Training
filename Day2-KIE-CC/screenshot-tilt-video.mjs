// Screenshot the Pisa tilt-video section at multiple video playback times
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

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport(viewport);
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

// scroll to tilt section
await page.evaluate(() => {
  document.getElementById('pisa-tilt').scrollIntoView({ behavior: 'instant', block: 'start' });
});
await new Promise(r => setTimeout(r, 800));

// wait for video to have metadata
await page.waitForFunction(() => {
  const v = document.getElementById('pisa-tilt-video');
  return v && v.readyState >= 2 && v.duration > 0;
}, { timeout: 15000 });

const duration = await page.evaluate(() => document.getElementById('pisa-tilt-video').duration);
console.log(`video duration: ${duration.toFixed(2)}s`);

let n = 1;
for (const f of fs.readdirSync(outDir)) {
  const m = f.match(/^screenshot-(\d+)/);
  if (m) n = Math.max(n, parseInt(m[1], 10) + 1);
}

const timesPercent = [0.05, 0.35, 0.7, 0.95];
for (const tp of timesPercent) {
  const t = duration * tp;
  await page.evaluate((time) => {
    const v = document.getElementById('pisa-tilt-video');
    v.pause();
    v.currentTime = time;
    // manually trigger tagline visibility update since 'seeked' fires after currentTime set
    v.dispatchEvent(new Event('timeupdate'));
  }, t);
  await new Promise(r => setTimeout(r, 700));
  // re-fire timeupdate after pause so tagline state matches new time
  await page.evaluate(() => {
    document.getElementById('pisa-tilt-video').dispatchEvent(new Event('timeupdate'));
  });
  await new Promise(r => setTimeout(r, 250));
  const out = path.join(outDir, `screenshot-${n++}-${viewportArg}-tilt-${Math.round(tp*100)}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(out);
}

await browser.close();
