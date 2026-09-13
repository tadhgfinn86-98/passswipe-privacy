/**
 * Generates build/icon.ico (and build/icon.png) with no external dependencies.
 *
 * The artwork is a Bloomberg-terminal motif: near-black square, amber border,
 * blocky amber "MB" lettering, a green rising equity line and an amber cursor
 * block. It is drawn once at 1024x1024 and box-downsampled to each icon size so
 * the small entries stay legible.
 *
 * The .ico contains classic 32-bit BMP entries for 16..128px (maximum Windows
 * compatibility) plus a PNG entry for 256px (as the format requires).
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = 1024;
const SIZES = [16, 24, 32, 48, 64, 128, 256];

/* ---------------------------------------------------------------- canvas -- */

function createCanvas(size) {
  return { w: size, h: size, data: new Uint8ClampedArray(size * size * 4) };
}

function blend(c, x, y, [r, g, b], alpha = 1) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h || alpha <= 0) return;
  const i = (y * c.w + x) * 4;
  const a = Math.min(1, alpha);
  c.data[i] = c.data[i] * (1 - a) + r * a;
  c.data[i + 1] = c.data[i + 1] * (1 - a) + g * a;
  c.data[i + 2] = c.data[i + 2] * (1 - a) + b * a;
  c.data[i + 3] = Math.max(c.data[i + 3], 255 * a);
}

function fillRect(c, x, y, w, h, colour, alpha = 1) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx++) {
      blend(c, xx, yy, colour, alpha);
    }
  }
}

function strokeRect(c, x, y, w, h, thickness, colour) {
  fillRect(c, x, y, w, thickness, colour);
  fillRect(c, x, y + h - thickness, w, thickness, colour);
  fillRect(c, x, y, thickness, h, colour);
  fillRect(c, x + w - thickness, y, thickness, h, colour);
}

function drawLine(c, x0, y0, x1, y1, thickness, colour) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  const r = thickness / 2;
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) blend(c, Math.round(cx + dx), Math.round(cy + dy), colour);
      }
    }
  }
}

/* -------------------------------------------------------- bitmap glyphs -- */

// Two-cell-wide strokes so corners overlap instead of touching only diagonally,
// which is what made a thin 5x7 "B" read as four detached blocks.
const GLYPHS = {
  M: ['1100011', '1110111', '1111111', '1101011', '1100011', '1100011', '1100011'],
  B: ['111110', '110011', '110011', '111110', '110011', '110011', '111110'],
};

function glyphWidth(ch, scale) {
  return GLYPHS[ch][0].length * scale;
}

function drawGlyph(c, ch, x, y, scale, colour) {
  GLYPHS[ch].forEach((row, ry) => {
    [...row].forEach((bit, rx) => {
      if (bit === '1') fillRect(c, x + rx * scale, y + ry * scale, scale, scale, colour);
    });
  });
}

/* ------------------------------------------------------------- artwork ---- */

// Matches the app's surface scale and Ice Signal accent.
const VOID = [8, 8, 9];
const CHARCOAL = [27, 29, 31];
const ICE = [131, 195, 255];
const ICE_DIM = [52, 78, 102];
const PAPER = [255, 255, 255];

function drawMaster() {
  const c = createCanvas(MASTER);
  const u = MASTER / 64; // layout unit

  // Void ground with an inset Charcoal card and a hairline Ice Signal ring —
  // the same card treatment the UI uses.
  fillRect(c, 0, 0, MASTER, MASTER, VOID);
  fillRect(c, 3 * u, 3 * u, MASTER - 6 * u, MASTER - 6 * u, CHARCOAL);
  strokeRect(c, 3 * u, 3 * u, MASTER - 6 * u, MASTER - 6 * u, 1.1 * u, ICE);

  // "MB" lettering in paper white.
  const scale = 3.2 * u;
  const gap = 1.1 * scale;
  const totalW = glyphWidth('M', scale) + gap + glyphWidth('B', scale);
  const gx = (MASTER - totalW) / 2;
  const gy = 12.5 * u;
  drawGlyph(c, 'M', gx, gy, scale, PAPER);
  drawGlyph(c, 'B', gx + glyphWidth('M', scale) + gap, gy, scale, PAPER);

  // Hairline divider under the lettering.
  fillRect(c, 9 * u, 40 * u, MASTER - 18 * u, 0.5 * u, ICE_DIM);

  // Rising equity curve in the accent blue.
  const pts = [
    [10, 53],
    [19, 50],
    [27, 51.5],
    [35, 46],
    [44, 47.5],
    [54, 41],
  ].map(([x, y]) => [x * u, y * u]);
  for (let i = 0; i < pts.length - 1; i++) {
    drawLine(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.8 * u, ICE);
  }

  return c;
}

/* ---------------------------------------------------------- downsampling -- */

function downsample(src, size) {
  const out = createCanvas(size);
  const ratio = src.w / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * ratio);
      const x1 = Math.floor((x + 1) * ratio);
      const y0 = Math.floor(y * ratio);
      const y1 = Math.floor((y + 1) * ratio);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.w + sx) * 4;
          r += src.data[i];
          g += src.data[i + 1];
          b += src.data[i + 2];
          a += src.data[i + 3];
          n++;
        }
      }
      const o = (y * size + x) * 4;
      out.data[o] = r / n;
      out.data[o + 1] = g / n;
      out.data[o + 2] = b / n;
      out.data[o + 3] = a / n;
    }
  }
  return out;
}

/* ------------------------------------------------------------ PNG output -- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

function encodePng(c) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(c.h * (c.w * 4 + 1));
  for (let y = 0; y < c.h; y++) {
    const rowStart = y * (c.w * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < c.w * 4; x++) raw[rowStart + 1 + x] = c.data[y * c.w * 4 + x];
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------ ICO output -- */

function encodeBmpEntry(c) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(c.w, 4);
  header.writeInt32LE(c.h * 2, 8); // colour data + AND mask
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const pixels = Buffer.alloc(c.w * c.h * 4);
  for (let y = 0; y < c.h; y++) {
    const srcY = c.h - 1 - y; // BMP rows are bottom-up
    for (let x = 0; x < c.w; x++) {
      const s = (srcY * c.w + x) * 4;
      const d = (y * c.w + x) * 4;
      pixels[d] = c.data[s + 2]; // B
      pixels[d + 1] = c.data[s + 1]; // G
      pixels[d + 2] = c.data[s]; // R
      pixels[d + 3] = c.data[s + 3]; // A
    }
  }
  const maskRow = Math.ceil(c.w / 8 / 4) * 4;
  const mask = Buffer.alloc(maskRow * c.h); // all zero = fully opaque
  return Buffer.concat([header, pixels, mask]);
}

function encodeIco(images) {
  const entries = images.map(({ canvas, png }) =>
    png ? encodePng(canvas) : encodeBmpEntry(canvas),
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ canvas }, i) => {
    const b = i * 16;
    dir[b] = canvas.w >= 256 ? 0 : canvas.w;
    dir[b + 1] = canvas.h >= 256 ? 0 : canvas.h;
    dir[b + 2] = 0;
    dir[b + 3] = 0;
    dir.writeUInt16LE(1, b + 4);
    dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(entries[i].length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += entries[i].length;
  });
  return Buffer.concat([header, dir, ...entries]);
}

/* ----------------------------------------------------------------- main --- */

const master = drawMaster();
const images = SIZES.map((size) => ({
  canvas: size === MASTER ? master : downsample(master, size),
  png: size === 256,
}));

mkdirSync(join(ROOT, 'build'), { recursive: true });
writeFileSync(join(ROOT, 'build', 'icon.ico'), encodeIco(images));
writeFileSync(join(ROOT, 'build', 'icon.png'), encodePng(downsample(master, 512)));
console.log(`icon: wrote build/icon.ico (${SIZES.join(', ')}px) and build/icon.png (512px)`);
