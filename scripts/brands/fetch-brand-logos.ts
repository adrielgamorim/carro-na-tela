// Downloads the brands' color logos the cards show (public/brands/logos/<key>.png):
// most from the car-logos-dataset on GitHub (emblems collected from
// carlogos.org), a few from Wikimedia Commons. Each one is cropped to its
// drawing and shrunk to 96 px (twice the size the cards show), then src/components/brandLogoKeys.ts is
// rewritten. Run after changing the list; the files are committed.
//
//   npm run fetch:brand-logos
//
// Brands without one keep the Simple Icons mask or the vehicle type icon.

import { mkdir, rm, writeFile } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";

const dataset = (slug: string) =>
  `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/thumb/${slug}.png`;
const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=256`;

/** Normalized brand name (see brandIcons.ts) → logo URL. */
const sources: Record<string, string> = {
  agrale: commons("Agrale.svg"),
  astonmartin: dataset("aston-martin"),
  audi: dataset("audi"),
  bmw: dataset("bmw"),
  byd: dataset("byd"),
  changan: dataset("changan"),
  chery: dataset("chery"),
  chevrolet: dataset("chevrolet"),
  chrysler: dataset("chrysler"),
  citroen: dataset("citroen"),
  // DFSK is Dongfeng Sokon, and its cars wear the Dongfeng emblem.
  dfsk: dataset("dongfeng"),
  dodge: dataset("dodge"),
  ferrari: dataset("ferrari"),
  fiat: dataset("fiat"),
  ford: dataset("ford"),
  foton: dataset("foton"),
  gac: dataset("gac-group"),
  geely: dataset("geely"),
  gwm: dataset("great-wall"),
  hafei: dataset("hafei"),
  honda: dataset("honda"),
  hyundai: dataset("hyundai"),
  iveco: dataset("iveco"),
  jac: dataset("jac"),
  jaecoo: commons("Jaecoo wordmark.svg"),
  jaguar: dataset("jaguar"),
  jeep: dataset("jeep"),
  jetour: dataset("jetour"),
  jinbei: commons("Jinbei.png"),
  kia: dataset("kia"),
  lamborghini: dataset("lamborghini"),
  landrover: dataset("land-rover"),
  leapmotor: dataset("leapmotor"),
  lexus: dataset("lexus"),
  lifan: dataset("lifan"),
  mahindra: dataset("mahindra"),
  maserati: dataset("maserati"),
  mclaren: dataset("mclaren"),
  mercedesbenz: dataset("mercedes-benz"),
  mg: dataset("mg"),
  mini: dataset("mini"),
  mitsubishi: dataset("mitsubishi"),
  nissan: dataset("nissan"),
  omoda: dataset("omoda"),
  peugeot: dataset("peugeot"),
  porsche: dataset("porsche"),
  ram: dataset("ram"),
  renault: dataset("renault"),
  rollsroyce: dataset("rolls-royce"),
  seres: commons("Logo Seres Group.svg"),
  smart: dataset("smart"),
  ssangyong: dataset("ssangyong"),
  subaru: dataset("subaru"),
  suzuki: dataset("suzuki"),
  toyota: dataset("toyota"),
  troller: dataset("troller"),
  volkswagen: dataset("volkswagen"),
  volvo: dataset("volvo"),
  zeekr: dataset("zeekr"),
};

const maxSide = 96;
// Logos whose empty bands are inside the emblem, not between it and a wordmark.
const keepWhole = new Set(["nissan"]);

interface Image {
  width: number;
  height: number;
  /** RGBA, 8 bits per channel. */
  pixels: Uint8Array;
}

/** Decodes a non-interlaced 8-bit PNG of any color type into RGBA. */
function decodePng(file: Buffer): Image {
  let offset = 8;
  let header: Buffer | undefined;
  let palette: Buffer | undefined;
  let transparency: Buffer | undefined;
  const data: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const chunk = file.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") header = chunk;
    else if (type === "PLTE") palette = chunk;
    else if (type === "tRNS") transparency = chunk;
    else if (type === "IDAT") data.push(chunk);
    offset += 12 + length;
  }
  if (!header) throw new Error("PNG sem IHDR");
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const [depth, colorType, , , interlace] = header.subarray(8);
  if (depth !== 8 || interlace) throw new Error(`PNG não suportado (bits ${depth}, entrelaçado ${interlace})`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType as 0 | 2 | 3 | 4 | 6];
  if (!channels) throw new Error(`tipo de cor ${colorType}`);

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? (rows[y * stride + x - channels] ?? 0) : 0;
      const up = y ? (rows[(y - 1) * stride + x] ?? 0) : 0;
      const upLeft = y && x >= channels ? (rows[(y - 1) * stride + x - channels] ?? 0) : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      rows[y * stride + x] = ((line[x] ?? 0) + predictor) & 0xff;
    }
  }

  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const byte = (offset: number) => rows[i * channels + offset] ?? 0;
    let rgba: number[];
    if (colorType === 6) rgba = [byte(0), byte(1), byte(2), byte(3)];
    else if (colorType === 2) rgba = [byte(0), byte(1), byte(2), 255];
    else if (colorType === 4) rgba = [byte(0), byte(0), byte(0), byte(1)];
    else if (colorType === 0) rgba = [byte(0), byte(0), byte(0), 255];
    else {
      const index = byte(0);
      const color = (channel: number) => palette?.[index * 3 + channel] ?? 0;
      rgba = [color(0), color(1), color(2), transparency?.[index] ?? 255];
    }
    pixels.set(rgba, i * 4);
  }
  return { width, height, pixels };
}

/** Whether the pixel starting at byte i is a logo's background: transparent or plain white. */
const isBackground = (pixels: Uint8Array, i: number) =>
  (pixels[i + 3] ?? 0) < 16 || [0, 1, 2].every((channel) => (pixels[i + channel] ?? 0) > 245);

/** Crops the margins that are transparent or plain white. */
function crop(image: Image): Image {
  const { width, height, pixels } = image;
  const empty = (x: number, y: number) => isBackground(pixels, (y * width + x) * 4);
  let [top, bottom, left, right] = [0, height - 1, 0, width - 1];
  const rowEmpty = (y: number) => Array.from({ length: width }, (_, x) => x).every((x) => empty(x, y));
  const columnEmpty = (x: number) => Array.from({ length: height }, (_, y) => y).every((y) => empty(x, y));
  while (top < bottom && rowEmpty(top)) top++;
  while (bottom > top && rowEmpty(bottom)) bottom--;
  while (left < right && columnEmpty(left)) left++;
  while (right > left && columnEmpty(right)) right--;
  const out = { width: right - left + 1, height: bottom - top + 1, pixels: new Uint8Array(0) };
  out.pixels = new Uint8Array(out.width * out.height * 4);
  for (let y = 0; y < out.height; y++)
    out.pixels.set(pixels.subarray(((top + y) * width + left) * 4, ((top + y) * width + right + 1) * 4), y * out.width * 4);
  return out;
}

/**
 * Keeps only the emblem of a logo drawn as an emblem over a wordmark (the
 * card shows the brand's name anyway): the part above the widest empty band of
 * rows, when it is most of the height.
 */
function emblem(image: Image): Image {
  const { width, height, pixels } = image;
  const inked = (y: number) =>
    Array.from({ length: width }, (_, x) => (y * width + x) * 4).some((i) => !isBackground(pixels, i));
  let [gapStart, gapLength, best, bestStart] = [-1, 0, 0, -1];
  for (let y = 0; y < height; y++) {
    if (inked(y)) {
      if (gapStart >= 0 && gapLength > best) [best, bestStart] = [gapLength, gapStart];
      [gapStart, gapLength] = [-1, 0];
    } else {
      if (gapStart < 0) gapStart = y;
      gapLength++;
    }
  }
  if (bestStart < 0 || best < height * 0.03 || bestStart < height * 0.55) return image;
  return crop({ width, height: bestStart, pixels: pixels.subarray(0, bestStart * width * 4) });
}

/** Shrinks so the longer side is at most maxSide, averaging each source box. */
function shrink(image: Image): Image {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  if (scale === 1) return image;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [x0, x1] = [Math.floor(x / scale), Math.min(image.width, Math.ceil((x + 1) / scale))];
      const [y0, y1] = [Math.floor(y / scale), Math.min(image.height, Math.ceil((y + 1) / scale))];
      let [r, g, b, a] = [0, 0, 0, 0];
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * image.width + sx) * 4;
          const alpha = image.pixels[i + 3] ?? 0;
          r += (image.pixels[i] ?? 0) * alpha;
          g += (image.pixels[i + 1] ?? 0) * alpha;
          b += (image.pixels[i + 2] ?? 0) * alpha;
          a += alpha;
        }
      const count = (x1 - x0) * (y1 - y0);
      pixels.set(a ? [r / a, g / a, b / a, a / count].map(Math.round) : [0, 0, 0, 0], (y * width + x) * 4);
    }
  return { width, height, pixels };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Buffer) {
  let c = 0xffffffff;
  for (const byte of bytes) c = (crcTable[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, body: Buffer) {
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const out = Buffer.alloc(typed.length + 8);
  out.writeUInt32BE(body.length, 0);
  typed.copy(out, 4);
  out.writeUInt32BE(crc32(typed), typed.length + 4);
  return out;
}
function encodePng({ width, height, pixels }: Image): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  // Each row gets the filter (none, sub, up, Paeth) with the smallest output, as PNG encoders do.
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const at = (x: number, dy: number) => (x < 0 || y + dy < 0 ? 0 : (pixels[(y + dy) * stride + x] ?? 0));
    const candidates = [0, 1, 2, 4].map((filter) => {
      const line = Buffer.alloc(stride + 1);
      line[0] = filter;
      for (let x = 0; x < stride; x++) {
        const [left, up, upLeft] = [at(x - 4, 0), at(x, -1), at(x - 4, -1)];
        const p = left + up - upLeft;
        const paeth =
          Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - upLeft)
            ? left
            : Math.abs(p - up) <= Math.abs(p - upLeft)
              ? up
              : upLeft;
        const predictor = filter === 1 ? left : filter === 2 ? up : filter === 4 ? paeth : 0;
        line[x + 1] = (at(x, 0) - predictor) & 0xff;
      }
      return line;
    });
    const cost = (line: Buffer) => line.subarray(1).reduce((sum, byte) => sum + (byte < 128 ? byte : 256 - byte), 0);
    const [best] = candidates.sort((a, b) => cost(a) - cost(b));
    best!.copy(raw, y * (stride + 1));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = "public/brands/logos";
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
const keys = Object.keys(sources).sort();
for (const [key, url] of Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))) {
  const response = await fetch(url, {
    headers: { "user-agent": "carro-na-tela/1.0 (github.com/adrielgamorim/carro-na-tela)" },
  });
  if (!response.ok) throw new Error(`${key}: ${response.status} em ${url}`);
  const whole = crop(decodePng(Buffer.from(await response.arrayBuffer())));
  const logo = shrink(keepWhole.has(key) ? whole : emblem(whole));
  await writeFile(`${dir}/${key}.png`, encodePng(logo));
  console.log(`${key}: ${logo.width}x${logo.height}`);
  await new Promise((resolve) => setTimeout(resolve, 300));
}
await writeFile(
  "src/components/brandLogoKeys.ts",
  `// Brands with a color logo in public/brands/logos, written by
// scripts/brands/fetch-brand-logos.ts (so no Vite-only APIs here).

/** Normalized brand names that have a color logo. */
export const brandLogoKeys = [
${keys.map((key) => `  "${key}",`).join("\n")}
];
`,
);
console.log(`${keys.length} logos em ${dir}`);
