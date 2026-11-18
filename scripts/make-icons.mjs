// Generates the PWA icons in /public from an inline SVG (run: node scripts/make-icons.mjs).
import sharp from "sharp";

const basket = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#2f8a4c"/>
  <g transform="translate(256 270) scale(${pad ? 0.72 : 0.92}) translate(-256 -270)" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <path d="M110 215h292l-34 170a24 24 0 0 1-24 19H168a24 24 0 0 1-24-19z"/>
    <path d="M180 215l50-90M332 215l-50-90"/>
    <path d="M210 270v80M256 270v80M302 270v80"/>
  </g>
</svg>`;

for (const [file, size, pad] of [
  ["public/icon-192.png", 192, false],
  ["public/icon-512.png", 512, false],
  ["public/icon-maskable-512.png", 512, true],
  ["src/app/apple-icon.png", 180, true],
]) {
  await sharp(Buffer.from(basket(pad))).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
