// Extract WebP frames from media/pisa-tilt.mp4 into pisa-tilt-frames/
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import fs from "node:fs";

fs.mkdirSync("pisa-tilt-frames", { recursive: true });
for (const f of fs.readdirSync("pisa-tilt-frames")) {
  if (f.endsWith(".webp")) fs.unlinkSync(`pisa-tilt-frames/${f}`);
}

const args = [
  "-y",
  "-i", "media/pisa-tilt.mp4",
  "-vf", "fps=20,scale=1920:-2",
  "-vcodec", "libwebp",
  "-lossless", "0",
  "-q:v", "78",
  "-vsync", "0",
  "-f", "image2",
  "pisa-tilt-frames/frame_%04d.webp",
];
console.log("→", ffmpegPath, args.join(" "));
const r = spawnSync(ffmpegPath, args, { stdio: "inherit" });
if (r.status !== 0) { console.error("ffmpeg failed"); process.exit(1); }

const frames = fs.readdirSync("pisa-tilt-frames").filter(f => f.endsWith(".webp"));
console.log(`✓ extracted ${frames.length} frames`);
