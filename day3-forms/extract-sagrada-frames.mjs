// Extract WebP frames from media/sagrada-familia.mp4 into sagrada-frames/
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import fs from "node:fs";

fs.mkdirSync("sagrada-frames", { recursive: true });
// Clear stale
for (const f of fs.readdirSync("sagrada-frames")) {
  if (f.endsWith(".webp")) fs.unlinkSync(`sagrada-frames/${f}`);
}

const args = [
  "-y",
  "-i", "media/sagrada-familia.mp4",
  "-vf", "fps=20,scale=1920:-2",
  "-vcodec", "libwebp",
  "-lossless", "0",
  "-q:v", "78",
  "-vsync", "0",
  "-f", "image2",
  "sagrada-frames/frame_%04d.webp",
];
console.log("→", ffmpegPath, args.join(" "));
const r = spawnSync(ffmpegPath, args, { stdio: "inherit" });
if (r.status !== 0) { console.error("ffmpeg failed"); process.exit(1); }

const frames = fs.readdirSync("sagrada-frames").filter(f => f.endsWith(".webp"));
console.log(`✓ extracted ${frames.length} frames`);
