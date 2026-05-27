// Generate the Leaning Tower of Pisa TILT TRANSITION clip via Kie.ai (Veo3).
// Start: upright blueprint. Middle: dramatic gradual tilt as it materializes.
// End: the famous finished leaning tower in full marble.
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

const PROMPT = [
  "A single continuous 8-second cinematic transition shot of the Leaning Tower of Pisa, Italy. Locked centered 3/4 elevation view, slow steady camera with no cuts, consistent framing, the tower stays centered as it transforms — the only motion is the tower itself tilting.",
  "Beats: 0-2s — the tower stands perfectly upright as a luminous architectural blueprint: thin glowing white line-art on deep ink-blue draft paper, eight stories of engineering line-work, force-vector arrows pointing straight down, no tilt yet, completely vertical.",
  "2-5s — the blueprint begins to tilt slowly and continuously to the right while simultaneously filling in: line-art transforms into Carrara marble texture, Romanesque arcades and slender colonnades materializing tier by tier, warm Tuscan golden-hour light starting to rake across the columns. The lean increases smoothly from 0 to about 4 degrees with visible engineering force diagrams briefly overlaying the structure (arrows showing the soil pressure, the compensating mass).",
  "5-8s — the finished iconic Leaning Tower of Pisa in full warm-white marble, tilted at its famous 4-degree angle, golden afternoon light, monolithic and complete against a deep charcoal sky, rim-light catching every column edge. The tower's final lean is the resolution.",
  "Style: dark, refined, museum-grade architectural engineering film. The tilt motion is the central drama — smooth, continuous, inevitable. No people, no text, no logos, no captions, no UI, no surrounding Piazza buildings — just the tower isolated against the sky. 16:9, 8 seconds."
].join(" ");

console.log("→ Submitting Veo3 generation request for Pisa TILT TRANSITION…");
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
for (let i = 0; i < 120; i++) {
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
if (!videoUrl) { console.error("Timed out"); process.exit(1); }

console.log("→ downloading", videoUrl);
fs.mkdirSync("media", { recursive: true });
const buf = Buffer.from(await (await fetch(videoUrl)).arrayBuffer());
const out = path.join("media", "pisa-tilt.mp4");
fs.writeFileSync(out, buf);
console.log(`✓ saved ${out} (${(buf.length/1024/1024).toFixed(2)} MB)`);
