// Generate a nostalgic vintage-accessories video via Kie.ai (Veo3) and save to ./media/
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
  "A slow, nostalgic, cinematic close-up still-life on a sunlit walnut surface.",
  "Centered: a 1970s mechanical wristwatch with a warm-patina gold-tone case, brown leather strap, and a slowly sweeping second hand — and beside it a pair of oversized 1970s aviator sunglasses with amber-tinted lenses and a thin gold frame.",
  "Camera: gentle push-in and slow lateral dolly between the two objects; shallow depth of field; warm afternoon sunbeam with drifting dust motes; soft lens flare across the sunglasses.",
  "Color: Kodachrome amber, oxblood shadows, cream highlights; visible 16mm film grain and a faint vignette.",
  "Mood: reverent, contemplative, the patina of analog craftsmanship — without the past there is no future; without analog watches, no smart watches.",
  "No other objects, no people, no text, no captions, no logos. 16:9, 8 seconds."
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
const out = path.join("media", "heritage-watch-glasses.mp4");
fs.writeFileSync(out, buf);
console.log(`✓ saved ${out} (${(buf.length/1024/1024).toFixed(2)} MB)`);
