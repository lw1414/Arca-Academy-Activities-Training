// Generate the La Sagrada Familia scroll-driven hero clip via Kie.ai (Veo3).
// Three temporal beats packed into 8s: blueprint line-art → imagined full build → blackened finished basilica.
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
  "A single continuous 8-second cinematic shot of La Sagrada Familia basilica in Barcelona, locked 3/4 elevation view, perfectly centered, slow steady camera with no cuts.",
  "Beats: 0-2s — pure architectural blueprint phase: thin glowing white line-art of the basilica drawing itself stroke by stroke on deep ink-blue draft paper, faint compass arcs and grid, no fill, no color, just luminous drafting lines emerging.",
  "2-6s — imagined materialization: the line-art fills in with dreamlike fully-built Gaudí spires, ornate stone facades, stained-glass windows glowing warm amber and rose, intricate organic ornament forming over the lines, soft golden interior light bleeding outward, painterly and reverent.",
  "6-8s — final state: all color and warmth drain away, the basilica resolves into a stark high-contrast blackened silhouette against a deep charcoal sky, only thin rim-light on the spire edges, monumental, monolithic, finished.",
  "Style: dark, refined, museum-grade architectural film. No people, no text, no logos, no captions, no UI. Consistent framing across all beats so frames blend smoothly. 16:9, 8 seconds."
].join(" ");

console.log("→ Submitting Veo3 generation request…");
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
if (!videoUrl) { console.error("Timed out waiting for video"); process.exit(1); }

console.log("→ downloading", videoUrl);
fs.mkdirSync("media", { recursive: true });
const buf = Buffer.from(await (await fetch(videoUrl)).arrayBuffer());
const out = path.join("media", "sagrada-familia.mp4");
fs.writeFileSync(out, buf);
console.log(`✓ saved ${out} (${(buf.length/1024/1024).toFixed(2)} MB)`);
