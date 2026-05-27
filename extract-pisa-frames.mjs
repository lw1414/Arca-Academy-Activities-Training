// Extract WebP frames from media/pisa-tower.mp4 into pisa-frames/
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import fs from "node:fs";

fs.mkdirSync("pisa-frames", { recursive: true });
for (const f of fs.readdirSync("pisa-frames")) {
  if (f.endsWith(".webp")) fs.unlinkSync(`pisa-frames/${f}`);
}

const args = [
  "-y",
  "-i", "media/pisa-tower.mp4",
  "-vf", "fps=20,scale=1920:-2",
  "-vcodec", "libwebp",
  "-lossless", "0",
  "-q:v", "78",
  "-vsync", "0",
  "-f", "image2",
  "pisa-frames/frame_%04d.webp",
];
console.log("→", ffmpegPath, args.join(" "));
const r = spawnSync(ffmpegPath, args, { stdio: "inherit" });
if (r.status !== 0) { console.error("ffmpeg failed"); process.exit(1); }

const frames = fs.readdirSync("pisa-frames").filter(f => f.endsWith(".webp"));
console.log(`✓ extracted ${frames.length} frames`);
