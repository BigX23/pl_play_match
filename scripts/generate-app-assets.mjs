#!/usr/bin/env node
/**
 * Generates the master images in resources/ that `@capacitor/assets` turns into
 * every iOS/Android icon and splash size (M1 in docs/MOBILE_APP_PLAN.md).
 *
 * PLACEHOLDER ART: the lucide "trophy" glyph (the logo used in the app header)
 * in cream on brand green, matching capacitor-shell/index.html. Replace the
 * PNGs in resources/ with designed art when it exists, then re-run
 * `npm run cap:assets`.
 *
 *   node scripts/generate-app-assets.mjs && npm run cap:assets
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const BRAND_GREEN = "#12463A";
const CREAM = "#FBFAF4";
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "resources");

// lucide-react 0.475 "trophy" (ISC license), 24x24 viewBox, stroke-based.
const TROPHY_PATHS = [
  "M6 9H4.5a2.5 2.5 0 0 1 0-5H6",
  "M18 9h1.5a2.5 2.5 0 0 0 0-5H18",
  "M4 22h16",
  "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22",
  "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22",
  "M18 2H6v7a6 6 0 0 0 12 0V2Z",
];

/** SVG of `size`px with the glyph spanning `glyph`px, centered. */
function svg(size, glyph, background) {
  const scale = glyph / 24;
  const offset = (size - glyph) / 2;
  const bg = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : "";
  const paths = TROPHY_PATHS.map((d) => `<path d="${d}"/>`).join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}` +
      `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${CREAM}" ` +
      `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`
  );
}

async function write(name, image) {
  await image.toFile(join(out, name));
  console.log(`resources/${name}`);
}

mkdirSync(out, { recursive: true });

// iOS + legacy Android icon: opaque (App Store rejects alpha on the icon).
await write("icon-only.png", sharp(svg(1024, 560, BRAND_GREEN)).flatten({ background: BRAND_GREEN }).removeAlpha().png());
// Android adaptive icon: capacitor-assets insets this layer 16.7%, so the image maps to the visible 72dp area; keep the glyph inside the circular mask.
await write("icon-foreground.png", sharp(svg(1024, 500, null)).png());
await write("icon-background.png", sharp({ create: { width: 1024, height: 1024, channels: 3, background: BRAND_GREEN } }).png());
// Splash (2732px covers the largest iPad); same art for dark mode.
for (const name of ["splash.png", "splash-dark.png"]) {
  await write(name, sharp(svg(2732, 520, BRAND_GREEN)).flatten({ background: BRAND_GREEN }).removeAlpha().png());
}
