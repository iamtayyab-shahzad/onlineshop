// Optimizes the shop's REAL product photos for the web/PWA. It never invents
// new photos or angles: each output is the same photo, cleaned up.
//
//   node scripts/optimize-pictures.mjs [inputDir=pictures] [outputDir=pictures/optimized]
//
// For each image: fix rotation, gently upscale very small photos (max 2x),
// fit inside 1000×1000, light sharpen, save as WebP (quality 82).
// Then upload the output folder in Admin → Images (bulk upload).
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const input = process.argv[2] ?? "pictures";
const output = process.argv[3] ?? path.join(input, "optimized");
const MAX = 1000;
const MIN_SIDE = 600; // photos smaller than this get a gentle (≤2x) upscale
const exts = new Set([".jpg", ".jpeg", ".jfif", ".png", ".webp", ".avif"]);

await mkdir(output, { recursive: true });
const files = (await readdir(input, { withFileTypes: true }))
  .filter((f) => f.isFile() && exts.has(path.extname(f.name).toLowerCase()))
  .map((f) => f.name);

const seen = new Map();
const report = [];
for (const name of files) {
  const buf = await readFile(path.join(input, name));
  const hash = createHash("sha256").update(buf).digest("hex");
  if (seen.has(hash)) {
    report.push({ name, skipped: `duplicate of ${seen.get(hash)}` });
    continue;
  }
  seen.set(hash, name);
  try {
    const img = sharp(buf, { failOn: "none" }).rotate();
    const meta = await img.metadata();
    const w = meta.autoOrient?.width ?? meta.width;
    const h = meta.autoOrient?.height ?? meta.height;
    const longest = Math.max(w, h);
    let target = Math.min(longest, MAX);
    if (longest < MIN_SIDE) target = Math.min(MIN_SIDE, longest * 2);
    const out = await img
      .resize({ width: w >= h ? target : null, height: h > w ? target : null, kernel: "lanczos3" })
      .sharpen({ sigma: longest < MIN_SIDE ? 0.9 : 0.5 })
      .webp({ quality: 82, effort: 5 })
      .toBuffer({ resolveWithObject: true });
    const base = path.basename(name, path.extname(name)).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    await writeFile(path.join(output, `${base}.webp`), out.data);
    report.push({
      name,
      out: `${base}.webp`,
      from: `${w}x${h}`,
      to: `${out.info.width}x${out.info.height}`,
      kb: Math.round(out.data.length / 1024),
      upscaled: longest < MIN_SIDE,
    });
  } catch (e) {
    report.push({ name, error: String(e.message ?? e) });
  }
}
console.table(report);
console.log(`Done: ${report.filter((r) => r.out).length} optimized into ${output}`);
