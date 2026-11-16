// Downloads the showcase dish photos chosen in showcase-photos.json from Unsplash (free licence),
// resized and compressed to WebP in scripts/showcase-photos/. Already downloaded files are kept.
// Usage: node scripts/fetch-photos.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const sharp = createRequire(import.meta.url)("../../../node_modules/sharp");

const list = JSON.parse(readFileSync(new URL("./showcase-photos.json", import.meta.url), "utf8"));
const dir = new URL("./showcase-photos/", import.meta.url);
mkdirSync(dir, { recursive: true });
let bytes = 0;
for (const [name, id] of Object.entries(list)) {
  const file = new URL(`${name}.webp`, dir);
  if (existsSync(file)) continue;
  const wide = name.startsWith("_");
  const res = await fetch(`https://images.unsplash.com/photo-${id}?w=${wide ? 1600 : 900}&q=80&fm=jpg`);
  if (!res.ok) {
    console.log("failed", name, res.status);
    continue;
  }
  const out = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize({ width: wide ? 1600 : 900, height: wide ? 900 : 675, fit: "cover" })
    .webp({ quality: 72 })
    .toBuffer();
  writeFileSync(file, out);
  bytes += out.length;
}
console.log(`Photos ready (${Math.round(bytes / 1024)} KB downloaded this run).`);
