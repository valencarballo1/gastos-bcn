import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const source = path.join(
  projectRoot,
  "public",
  "icons",
  "casa-clara-icon-master.png",
);
const publicIcons = path.join(projectRoot, "public", "icons");

const outputs = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["favicon-48x48.png", 48],
  ["apple-touch-icon.png", 180],
  ["android-chrome-192x192.png", 192],
  ["android-chrome-512x512.png", 512],
  ["maskable-icon-192x192.png", 192],
  ["maskable-icon-512x512.png", 512],
];

await mkdir(publicIcons, { recursive: true });

await Promise.all(
  outputs.map(([filename, size]) =>
    sharp(source)
      .resize(size, size, {
        fit: "cover",
        kernel: sharp.kernel.lanczos3,
      })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toFile(path.join(publicIcons, filename)),
  ),
);

const faviconSizes = [16, 32, 48];
const faviconImages = await Promise.all(
  faviconSizes.map((size) =>
    readFile(path.join(publicIcons, `favicon-${size}x${size}.png`)),
  ),
);
const directorySize = 6 + faviconImages.length * 16;
const favicon = Buffer.alloc(
  directorySize +
    faviconImages.reduce((total, image) => total + image.length, 0),
);

favicon.writeUInt16LE(0, 0);
favicon.writeUInt16LE(1, 2);
favicon.writeUInt16LE(faviconImages.length, 4);

let imageOffset = directorySize;

faviconImages.forEach((image, index) => {
  const entryOffset = 6 + index * 16;
  const size = faviconSizes[index];

  favicon.writeUInt8(size, entryOffset);
  favicon.writeUInt8(size, entryOffset + 1);
  favicon.writeUInt8(0, entryOffset + 2);
  favicon.writeUInt8(0, entryOffset + 3);
  favicon.writeUInt16LE(1, entryOffset + 4);
  favicon.writeUInt16LE(32, entryOffset + 6);
  favicon.writeUInt32LE(image.length, entryOffset + 8);
  favicon.writeUInt32LE(imageOffset, entryOffset + 12);
  image.copy(favicon, imageOffset);
  imageOffset += image.length;
});

await writeFile(path.join(projectRoot, "src", "app", "favicon.ico"), favicon);

console.log(`Generated ${outputs.length} PNG icons and src/app/favicon.ico.`);
