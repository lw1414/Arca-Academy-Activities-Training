// Generate the Leaning Tower of Pisa scroll-driven hero clip via Kie.ai (Veo3).
// Three temporal beats packed into 8s: blueprint line-art → imagined full build → finished leaning tower.
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
  "A single continuous 8-second cinematic shot of the Leaning Tower of Pisa (Torre Pendente), Italy. Locked 3/4 elevation view, perfectly centered, the tower visibly tilted ~4 degrees to the right, slow steady camera with no cuts, consistent framing across all beats so frames blend smoothly.",
  "Beats: 0-2s — pure architectural blueprint phase: thin glowing white line-art of the tower drawing itself stroke by stroke on deep ink-blue draft paper, faint engineering annotations and force-vector arrows showing the lean, drafting compass arcs, no fill, no color, just luminous drafting lines emerging.",
  "2-6s — imagined materialization: the line-art fills in with the eight-story Romanesque marble cylinder, blind arcades and slender colonnades wrapping each tier, warm white Carrara marble texture forming over the lines, golden Tuscan afternoon light raking across the columns, painterly and reverent.",
  "6-8s — final state: the tower resolves into the finished Leaning Tower of Pisa, fully built, monumental, glowing white marble against a deep charcoal sky, only thin rim-light on the column edges and bell chamber, monolithic, complete.",
  "Style: dark, refined, museum-grade architectural engineering film. The lean is precise and visible throughout. No people, no text, no logos, no captions, no UI, no surrounding Piazza dei Miracoli buildings — just the tower isolated against the sky. 16:9, 8 seconds."
].join(" ");

console.log("→ Submitting Veo3 generation request for Leaning Tower of Pisa…");
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
const out = path.join("media", "pisa-tower.mp4");
fs.writeFileSync(out, buf);
console.log(`✓ saved ${out} (${(buf.length/1024/1024).toFixed(2)} MB)`);
