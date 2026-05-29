// Headless console-log dump for debugging
const PUPPETEER_PATH = 'C:/Users/nateh/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
let puppeteer;
try { puppeteer = (await import(PUPPETEER_PATH)).default; }
catch { puppeteer = (await import('puppeteer')).default; }
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', msg => console.log('[browser]', msg.type(), msg.text()));
page.on('pageerror', err => console.log('[pageerror]', err.message));
page.on('requestfailed', req => console.log('[reqfailed]', req.url(), req.failure()?.errorText));
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:3000/Sights.html', { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));
const info = await page.evaluate(() => {
  const dl = (id) => {
    const el = document.getElementById(id);
    return el ? { exists: true, done: el.classList.contains('is-done'), fillWidth: el.querySelector(`#${id}-fill`)?.style.width } : { exists: false };
  };
  return {
    sagrada: dl('sagrada-loader'),
    pisa: dl('pisa-loader'),
    sagradaCanvas: !!document.getElementById('sagrada-canvas'),
    pisaCanvas: !!document.getElementById('pisa-canvas'),
  };
});
console.log('info:', JSON.stringify(info, null, 2));
await browser.close();
