// Generate four Heritage images via Kie.ai (Nano-Banana) → media/img/
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ENV = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const KEY = ENV.KIE_API_KEY;
if (!KEY) { console.error("Missing KIE_API_KEY in .env"); process.exit(1); }

const JOBS = [
  {
    file: "the-pair-01.png",
    prompt:
      "A nostalgic 1970s still-life photograph on a sunlit walnut sill in late-afternoon light. A vintage gold-tone mechanical wristwatch with brown leather strap rests beside a pair of oversized 1970s aviator sunglasses with amber-tinted lenses and a thin gold rim. Warm Kodachrome amber palette, soft window light, visible 16mm film grain, faint vignette, drifting dust motes. Slightly elevated angle, both objects in frame with gentle negative space; the strap of the watch curls toward the glasses. Photographic, reverent, contemplative. No people, no text, no captions, no logos. 5:4.",
  },
  {
    file: "the-watch.png",
    prompt:
      "A vintage drafting blueprint on aged, tea-stained cream paper showing a 1974 mechanical wristwatch in technical exploded view. Components arranged vertically with thin hairline guide lines and small dimension ticks: sapphire crystal at top, bezel, dial face with painted indices and minute track, hour / minute / sweep second hands, movement plate revealing 21 ruby jewels and the balance wheel, mainspring barrel, rotor, caseback, crown, lugs, brown leather strap with buckle. Brown sepia ink on warm cream paper, slight coffee-stain rings at the corners, faint deckled edge. Hand-drafted technical illustration look, no text and no labels visible, purely lines and components. 5:4.",
  },
  {
    file: "the-glasses.png",
    prompt:
      "A vintage drafting blueprint on aged, tea-stained cream paper showing a pair of 1970s amber-tinted aviator sunglasses in technical exploded view. Components arranged horizontally with thin hairline guide lines and small dimension ticks: thin gold-rim frame, two teardrop amber-tinted lenses floating apart from the frame, double bridge bar, nose pads, screws, hinges, two temple arms with end-pieces. Brown sepia ink on warm cream paper, slight coffee-stain rings at the corners, faint deckled edge. Hand-drafted technical illustration look, no text and no labels visible, purely lines and components. 5:4.",
  },
  {
    file: "the-pair-04.png",
    prompt:
      "A nostalgic 1970s still-life photograph, tight intimate framing. A pair of amber-tinted aviator sunglasses with thin gold rims is folded and resting on top of the closed brown leather strap of a vintage gold-tone mechanical wristwatch, on a warm walnut surface near a windowsill. Late golden hour light raking in from the right; long shadows; visible 16mm film grain; warm Kodachrome amber and oxblood tones; soft lens flare. Photographic, intimate, the patina of analog craftsmanship. No people, no text, no captions, no logos. 5:4.",
  },

  // ── TesterTech showcase — 8 consumer-tech devices, whole + exploded view ──
  {
    file: "tt-watch-pro.png",
    prompt:
      "Modern consumer-tech product photography on a clean off-white seamless backdrop with soft top-down studio lighting and a subtle floor shadow. A premium titanium smartwatch with sapphire crystal, AMOLED display and a brown leather strap shown in two views in a single composition: on the left, the finished watch photoreal and hero-lit at a slight angle; on the right, an exploded technical view of the same watch with components separated vertically along thin grey alignment lines and tiny dimension ticks — sapphire crystal, AMOLED display panel, titanium case, mainboard with sensor cluster, haptic engine, battery cell, caseback with optical PPG sensor array, crown, leather strap, buckle. Premium minimalist aesthetic in the style of Apple and Samsung product pages: matte finishes, fine micro-detail, true-to-material textures. Color palette muted neutral with a single accent of warm gold (#E6B979) on the crown and indices. No text, no labels, no logos, no people, no captions. 5:4.",
  },
  {
    file: "tt-watch-air.png",
    prompt:
      "Modern consumer-tech product photography on a clean off-white seamless backdrop with soft top-down studio lighting and a subtle floor shadow. A lightweight aluminum smartwatch with AMOLED display and a charcoal fluoroelastomer sport band shown in two views in a single composition: on the left, the finished watch photoreal and hero-lit at a slight angle; on the right, an exploded technical view of the same watch with components separated vertically along thin grey alignment lines and tiny dimension ticks — anodized aluminum case, AMOLED display panel, slim mainboard, battery cell, optical PPG sensor caseback, crown, quick-release band. Premium minimalist aesthetic in the style of Apple and Samsung product pages: matte finishes, fine micro-detail, true-to-material textures. Color palette muted neutral with a single accent of warm gold (#E6B979). No text, no labels, no logos, no people, no captions. 5:4.",
  },
  {
    file: "tt-lens-ar.png",
    prompt:
      "Modern consumer-tech product photography on a clean off-white seamless backdrop with soft top-down studio lighting and a subtle floor shadow. A pair of sleek modern AR smart-glasses with a thin matte-black acetate frame and micro-OLED waveguide lenses shown in two views in a single composition: on the left, the finished glasses photoreal at a slight three-quarter angle; on the right, an exploded technical view with components separated horizontally along thin grey alignment lines and tiny dimension ticks — micro-OLED waveguide lenses, acetate frame front, two temple arms each with embedded mainboard, IMU and dual forward cameras, bone-conduction speakers, slim batteries, hinges. Premium minimalist aesthetic in the style of Apple and Samsung product pages: matte finishes, fine micro-detail, true-to-material textures. Color palette muted neutral with a single accent of warm gold (#E6B979) on the hinges. No text, no labels, no logos, no people, no captions. 5:4.",
  },
  {
    file: "tt-lens-audio.png",
    prompt:
      "Modern consumer-tech product photography on a clean off-white seamless backdrop with soft top-down studio lighting and a subtle floor shadow. A pair of open-ear audio smart-glasses with smoke-tinted polycarbonate lenses and a slim tortoise-shell acetate frame shown in two views in a single composition: on the left, the finished glasses photoreal at a slight three-quarter angle; on the right, an exploded technical view with components separated horizontally along thin grey alignment lines and tiny dimension ticks — tinted polycarbonate lenses, slim acetate frame front, two temple arms with directional micro-speakers, dual MEMS microphones, batteries, hinges. Premium minimalist aesthetic in the style of Apple and Samsung product pages: matte finishes, fine micro-detail, true-to-material textures. Color palette muted neutral with a single accent of warm gold (#E6B979) on the hinge rivets. No text, no labels, no logos, no people, no captions. 5:4.",
  },
  {
    file: "tt-voice-hub.png",
    prompt:
      "Modern consumer-tech product photography on a clean off-white seamless backdrop with soft top-down studio lighting and a subtle floor shadow. A cylindrical fabric-wrapped smart voice speaker about 18 cm tall in soft warm-grey wool fabric shown in two views in a single composition: on the left, the finished speaker photoreal and hero-lit straight on; on the right, an exploded technical view of the same speaker with components separated vertically along thin grey alignment lines and tiny dimension ticks — fabric mesh sleeve, woofer driver, tweeter ring, 7-microphone far-field array board, mainboard, capacitive touch top cap, base with port. Premium minimalist aesthetic in the style of Apple and Samsung product pages: matte finishes, fine micro-detail, true-to-material textures. Color palette muted neutral with a single accent of warm gold (#E6B979) on the top cap ring. No text, no labels, no logos, no people, no captions. 5:4.",
  },
  {
    file: "tt-display-hub.png",
    prompt:
      "Modern consumer-tech product photography on a clean off-white seamless backdrop with soft top-down studio lighting and a subtle floor shadow. A matte 8-inch smart display with a rounded fabric-wrapped speaker back and a small kickstand base shown in two views in a single composition: on the left, the finished display photoreal at a slight three-quarter angle with a dark screen reflecting soft light; on the right, an exploded technical view of the same device with components separated horizontally along thin grey alignment lines and tiny dimension ticks — 8-inch matte display panel, bezel ring, mainboard, far-field microphone array, rear speaker drivers, fabric back panel, kickstand base. Premium minimalist aesthetic in the style of Apple and Samsung product pages: matte finishes, fine micro-detail, true-to-material textures. Color palette muted neutral with a single accent of warm gold (#E6B979) on the camera privacy slider. No text, no labels, no logos, no people, no captions. 5:4.",
  },
  {
    file: "tt-ring.png",
    prompt:
      "Modern consumer-tech product photography on a clean off-white seamless backdrop with soft top-down studio lighting and a subtle floor shadow. A polished matte black ceramic smart-ring with an inner titanium liner and a continuous inner sensor band shown in two views in a single composition: on the left, the finished ring photoreal at a slight angle on a small podium; on the right, an exploded technical view of the same ring with components separated along thin grey alignment lines and tiny dimension ticks — outer ceramic shell, inner titanium liner, optical PPG and temperature sensor band, slim ring-shaped battery, curved mainboard arc, induction charge coil. Premium minimalist aesthetic in the style of Apple and Samsung product pages: matte finishes, fine micro-detail, true-to-material textures. Color palette muted neutral with a single accent of warm gold (#E6B979) on the inner sensor band. No text, no labels, no logos, no people, no captions. 5:4.",
  },
  {
    file: "tt-buds-pro.png",
    prompt:
      "Modern consumer-tech product photography on a clean off-white seamless backdrop with soft top-down studio lighting and a subtle floor shadow. A pair of premium wireless in-ear earbuds in matte off-white with a small pill-shaped charging case shown in two views in a single composition: on the left, both earbuds and the open charging case photoreal and hero-lit at a slight angle; on the right, an exploded technical view of one earbud with components separated horizontally along thin grey alignment lines and tiny dimension ticks — silicone ear tip, in-ear shell with bone-conduction node, dual dynamic drivers, mainboard, microphone array, battery cell, charging contacts, plus the charging case with hinge and lid. Premium minimalist aesthetic in the style of Apple and Samsung product pages: matte finishes, fine micro-detail, true-to-material textures. Color palette muted neutral with a single accent of warm gold (#E6B979) on the charging contacts. No text, no labels, no logos, no people, no captions. 5:4.",
  },

  // ── Sights — 6 cinematic adventure-travel landscapes ──
  {
    file: "sights-dolomites.png",
    prompt:
      "A cinematic editorial landscape photograph of the Dolomites in northern Italy, shot in the style of a premium adventure-travel magazine (Sidetracked, Field Mag, Patagonia journal). Granite spires catching warm golden-hour light, an alpine meadow of summer wildflowers in the foreground, soft warm fog drifting through the valley, distant pine forest. Medium-format film aesthetic, soft natural light, fine detail, painterly atmosphere, warm but restrained palette of ochre, slate and sage. No people, no text, no captions, no logos, no signage. 5:4.",
  },
  {
    file: "sights-atacama.png",
    prompt:
      "A cinematic editorial landscape photograph of the Atacama Desert in northern Chile, shot in the style of a premium adventure-travel magazine. A vast cracked salt-flat plain at blue-hour twilight, a single distant volcano cone on the horizon, a wide lavender-and-rose sky with the first stars appearing, gentle wind ripples in the salt crust. Medium-format film aesthetic, soft directional light, fine detail, painterly atmosphere, restrained palette of bone, lavender and rust. No people, no text, no captions, no logos, no signage. 5:4.",
  },
  {
    file: "sights-iceland.png",
    prompt:
      "A cinematic editorial landscape photograph of the Iceland highlands and south coast, shot in the style of a premium adventure-travel magazine. A long black-sand coastline at low tide, basalt sea stacks rising from the surf, low silver mist hovering over the water, dark volcanic cliffs in the middle distance, slate-grey sky. Medium-format film aesthetic, soft diffuse light, fine detail, painterly atmosphere, restrained palette of charcoal, silver and deep teal. No people, no text, no captions, no logos, no signage. 5:4.",
  },
  {
    file: "sights-patagonia.png",
    prompt:
      "A cinematic editorial landscape photograph of Torres del Paine in Patagonia, shot in the style of a premium adventure-travel magazine. A turquoise glacial lake in the middle distance, the three jagged granite towers of the massif rising sharply behind under a low cloud, wind-bent yellow grass in the immediate foreground, scattered boulders. Medium-format film aesthetic, soft cool natural light, fine detail, painterly atmosphere, restrained palette of turquoise, slate-grey and ochre. No people, no text, no captions, no logos, no signage. 5:4.",
  },
  {
    file: "sights-japan-alps.png",
    prompt:
      "A cinematic editorial landscape photograph of the Northern Japanese Alps in winter, shot in the style of a premium adventure-travel magazine. A dense cedar forest dusted with fresh snow, a narrow stone path curving away into the trees, soft early-morning blue light, fine snowflakes still drifting, low mist between the trunks. Medium-format film aesthetic, soft diffuse light, fine detail, painterly atmosphere, restrained palette of cold blue, deep green and bone. No people, no text, no captions, no logos, no signage. 5:4.",
  },
  {
    file: "sights-marrakech-atlas.png",
    prompt:
      "A cinematic editorial landscape photograph of a Berber village in the High Atlas mountains of Morocco at dusk, shot in the style of a premium adventure-travel magazine. Ochre-walled stone houses cascading down a terraced hillside, narrow agricultural terraces of olive and barley below, a thin column of smoke rising from one chimney, the late sun catching the upper ridge in warm pink. Medium-format film aesthetic, soft golden-hour light, fine detail, painterly atmosphere, restrained palette of clay-red, olive and dusty rose. No people, no text, no captions, no logos, no signage. 5:4.",
  },
];

const MODELS = ["google/nano-banana", "nano-banana", "google/nano-banana-edit"];
const SUBMIT = "https://api.kie.ai/api/v1/jobs/createTask";
const POLL   = "https://api.kie.ai/api/v1/jobs/recordInfo";

async function submitJob(prompt) {
  let lastErr = null;
  for (const model of MODELS) {
    const r = await fetch(SUBMIT, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: { prompt, image_size: "5:4", output_format: "png" } }),
    }).then(r => r.json()).catch(e => ({ code: 0, msg: String(e) }));
    if (r?.code === 200 && (r.data?.taskId || r.data?.task_id)) {
      return { taskId: r.data.taskId || r.data.task_id, model };
    }
    lastErr = r;
  }
  throw new Error("Submit failed for all models: " + JSON.stringify(lastErr));
}

async function pollJob(taskId) {
  for (let i = 0; i < 80; i++) {
    await sleep(6000);
    const r = await fetch(`${POLL}?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    }).then(r => r.json());
    const state = r?.data?.state || r?.data?.status;
    if (state === "success" || state === "succeeded" || state === "completed" || r?.data?.successFlag === 1) {
      let urls =
        r?.data?.resultUrls ||
        r?.data?.response?.resultUrls ||
        r?.data?.result?.resultUrls;
      if (!urls && r?.data?.resultJson) {
        try { urls = JSON.parse(r.data.resultJson)?.resultUrls; } catch {}
      }
      if (Array.isArray(urls) && urls[0]) return urls[0];
      throw new Error("Success but no URL: " + JSON.stringify(r));
    }
    if (state === "fail" || state === "failed" || r?.data?.successFlag === 2 || r?.data?.successFlag === 3) {
      throw new Error("Job failed: " + JSON.stringify(r));
    }
  }
  throw new Error("Polling timed out");
}

async function runJob(job) {
  const out = path.join("media/img", job.file);
  if (fs.existsSync(out)) { console.log(`• skip    ${out}  (already exists)`); return; }
  console.log(`→ submit  ${job.file}`);
  const { taskId, model } = await submitJob(job.prompt);
  console.log(`  taskId  ${job.file}  ${taskId}  (model=${model})`);
  const url = await pollJob(taskId);
  console.log(`  ready   ${job.file}  ${url}`);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.mkdirSync("media/img", { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`✓ saved   ${out}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

const results = await Promise.allSettled(JOBS.map(runJob));
let failed = 0;
results.forEach((r, i) => {
  if (r.status === "rejected") {
    failed++;
    console.error(`✗ FAILED  ${JOBS[i].file}: ${r.reason?.message || r.reason}`);
  }
});
process.exit(failed ? 1 : 0);
