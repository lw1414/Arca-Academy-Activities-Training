// Generate the TesterTech 8-device showcase video via Kie.ai (Veo3) → media/tt-showcase.mp4
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ENV = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const KEY = ENV.KIE_API_KEY;
if (!KEY) { console.error("Missing KIE_API_KEY in .env"); process.exit(1); }

const OUT = path.join("media", "tt-showcase.mp4");
if (fs.existsSync(OUT)) { console.log(`• ${OUT} already exists — delete it to regenerate.`); process.exit(0); }

const PROMPT = [
  "A sleek, premium 8-second consumer-tech product reveal sequence in the style of an Apple or Samsung product page.",
  "Clean off-white seamless studio backdrop with soft top-down lighting and a faint floor shadow. Slow continuous parallax push from left to right that links every shot.",
  "Eight smart devices appear one after another, each floating gently into frame from off-screen, briefly hero-lit at centre, then drifting out as the next device drifts in:",
  "(1) a premium titanium smartwatch with a brown leather strap and sapphire crystal;",
  "(2) a lightweight aluminum smartwatch with a charcoal fluoroelastomer sport band;",
  "(3) sleek AR smart-glasses with thin matte-black acetate frames and micro-OLED waveguide lenses;",
  "(4) open-ear audio glasses with tortoise-shell acetate and smoke-tinted lenses;",
  "(5) a cylindrical fabric-wrapped smart voice speaker in warm-grey wool;",
  "(6) a matte 8-inch smart display with a fabric-wrapped speaker back and small kickstand base;",
  "(7) a polished matte-black ceramic smart-ring on a tiny pedestal;",
  "(8) a pair of premium off-white wireless earbuds floating just above their open pill-shaped charging case.",
  "Closing beat: a gentle pull-back to reveal all eight devices arranged in a near-symmetric grid on the off-white surface, briefly held in stillness.",
  "Premium minimalist aesthetic: matte finishes, fine micro-detail, true-to-material textures, soft drop shadows. Muted neutral palette with a single accent of warm gold (#E6B979) glinting on each device.",
  "Cinematography: shallow depth of field, smooth motion, no jump cuts, calm pacing, weightless object motion.",
  "No people, no text, no labels, no captions, no logos, no UI overlays. 16:9, 8 seconds."
].join(" ");

console.log("→ Submitting TesterTech Veo3 generation request…");
const submit = await fetch("https://api.kie.ai/api/v1/veo/generate", {
  method: "POST",
  headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: PROMPT,
    model: "veo3_fast",
    aspectRatio: "16:9",
    enableTranslation: false
  })
}).then(r => r.json());

console.log("submit:", JSON.stringify(submit));
const taskId = submit?.data?.taskId || submit?.taskId || submit?.data?.task_id;
if (!taskId) { console.error("No taskId returned"); process.exit(1); }
console.log("→ taskId:", taskId);

let videoUrl = null;
for (let i = 0; i < 90; i++) { // up to ~15 min
  await sleep(10000);
  const r = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
    headers: { "Authorization": `Bearer ${KEY}` }
  }).then(r => r.json());
  const flag = r?.data?.successFlag;
  console.log(`  poll ${i+1}: successFlag=${flag} msg=${r?.msg ?? ""}`);
  if (flag === 1) {
    const urls = r?.data?.response?.resultUrls || r?.data?.resultUrls;
    videoUrl = Array.isArray(urls) ? urls[0] : urls;
    break;
  }
  if (flag === 2 || flag === 3) {
    console.error("Generation failed:", JSON.stringify(r));
    process.exit(1);
  }
}
if (!videoUrl) { console.error("Timed out waiting for video"); process.exit(1); }

console.log("→ downloading", videoUrl);
fs.mkdirSync("media", { recursive: true });
const buf = Buffer.from(await (await fetch(videoUrl)).arrayBuffer());
fs.writeFileSync(OUT, buf);
console.log(`✓ saved ${OUT} (${(buf.length/1024/1024).toFixed(2)} MB)`);
