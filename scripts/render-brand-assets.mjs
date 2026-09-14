import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES = join(ROOT, 'assets', 'images');
const ICON_ASSETS = join(ROOT, 'assets', 'expo.icon', 'Assets');

const FELT = [0x1c, 0x36, 0x34, 0xff];
const CARD_BLUE = [0x5e, 0x82, 0x9c, 0xff];
const IVORY = [0xf3, 0xed, 0xe3, 0xff];
const WHITE = [0xff, 0xff, 0xff, 0xff];
const CLEAR = [0, 0, 0, 0];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function mix(dst, x, y, width, color, alpha) {
  if (alpha <= 0) return;
  const i = (y * width + x) * 4;
  const a = Math.min(1, alpha);
  const inv = 1 - a;
  const srcA = (color[3] / 255) * a;
  const outA = srcA + (dst[i + 3] / 255) * inv;
  if (outA <= 0) {
    dst[i] = dst[i + 1] = dst[i + 2] = dst[i + 3] = 0;
    return;
  }
  dst[i] = Math.round((color[0] * srcA + dst[i] * (dst[i + 3] / 255) * inv) / outA);
  dst[i + 1] = Math.round((color[1] * srcA + dst[i + 1] * (dst[i + 3] / 255) * inv) / outA);
  dst[i + 2] = Math.round((color[2] * srcA + dst[i + 2] * (dst[i + 3] / 255) * inv) / outA);
  dst[i + 3] = Math.round(outA * 255);
}

function fill(dst, width, height, color) {
  for (let i = 0; i < width * height; i += 1) {
    dst[i * 4] = color[0];
    dst[i * 4 + 1] = color[1];
    dst[i * 4 + 2] = color[2];
    dst[i * 4 + 3] = color[3];
  }
}

function sdRoundBox(px, py, cx, cy, hw, hh, radius) {
  const dx = Math.abs(px - cx) - (hw - radius);
  const dy = Math.abs(py - cy) - (hh - radius);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - radius;
}

function sdAnnulus(px, py, cx, cy, rOuter, rInner) {
  const d = Math.hypot(px - cx, py - cy);
  return Math.max(d - rOuter, rInner - d);
}

function coverage(distance) {
  return Math.max(0, Math.min(1, 0.5 - distance));
}

function cardGeometry(size, scale) {
  const height = size * scale;
  const width = height * (5 / 7);
  return {
    cx: size / 2,
    cy: size / 2,
    hw: width / 2,
    hh: height / 2,
    radius: width * 0.1,
    width,
    height,
  };
}

function monogramGeometry(width, height) {
  const sw = width * 0.155;
  const rOuter = width * 0.215;
  const h = height * 0.455;
  const rInner = Math.max(width * 0.04, rOuter - sw * 0.92);
  const left = (width - (sw + rOuter)) / 2 + width * 0.02;
  const top = (height - h) / 2;
  return {
    sw,
    r: sw / 2,
    rOuter,
    rInner,
    h,
    left,
    top,
    stemRight: left + sw,
    bowlCx: left + sw,
    bowlCy: top + rOuter,
    bottom: top + h,
  };
}

function sdLetterP(px, py, originX, originY, m) {
  const x0 = originX + m.left;
  const y0 = originY + m.top;
  const dStem = sdRoundBox(px, py, x0 + m.sw / 2, y0 + m.h / 2, m.sw / 2, m.h / 2, m.r);
  const dBowl = Math.max(
    sdAnnulus(px, py, originX + m.bowlCx, originY + m.bowlCy, m.rOuter, m.rInner),
    x0 - px,
  );
  return Math.min(dStem, dBowl);
}

function drawCardBack(dst, size, scale, cardColor, inkColor, cutoutMark) {
  const g = cardGeometry(size, scale);
  const originX = g.cx - g.hw;
  const originY = g.cy - g.hh;
  const m = monogramGeometry(g.width, g.height);
  const inset = g.width * 0.11;
  const thickness = Math.max(1.15, g.width * 0.038);
  const frameHw = g.hw - inset;
  const frameHh = g.hh - inset;
  const frameRadius = Math.max(1, g.radius - inset * 0.4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const card = coverage(sdRoundBox(px, py, g.cx, g.cy, g.hw, g.hh, g.radius));
      const mark = coverage(sdLetterP(px, py, originX, originY, m));
      if (cutoutMark) {
        mix(dst, x, y, size, cardColor, Math.max(0, card - mark));
      } else {
        const frame = coverage(Math.abs(sdRoundBox(px, py, g.cx, g.cy, frameHw, frameHh, frameRadius)) - thickness / 2);
        mix(dst, x, y, size, cardColor, card);
        mix(dst, x, y, size, inkColor, frame * card);
        mix(dst, x, y, size, inkColor, mark * card);
      }
    }
  }
}

function render({ size, scale, background, cardColor, inkColor, cutoutMark }) {
  const dst = Buffer.alloc(size * size * 4);
  if (background) fill(dst, size, size, background);
  else fill(dst, size, size, CLEAR);
  if (scale > 0) drawCardBack(dst, size, scale, cardColor, inkColor, cutoutMark);
  return encodePng(size, size, dst);
}

function roundedRectPath(x, y, w, h, r) {
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

function letterPPath(width, height) {
  const m = monogramGeometry(width, height);
  const x0 = m.left;
  const y0 = m.top;
  const x1 = m.stemRight;
  const y1 = m.bottom;
  const outer = [
    `M ${x0} ${y0 + m.r}`,
    `A ${m.r} ${m.r} 0 0 1 ${x0 + m.r} ${y0}`,
    `H ${x1}`,
    `A ${m.rOuter} ${m.rOuter} 0 0 1 ${x1} ${y0 + 2 * m.rOuter}`,
    `V ${y1 - m.r}`,
    `A ${m.r} ${m.r} 0 0 1 ${x1 - m.r} ${y1}`,
    `H ${x0 + m.r}`,
    `A ${m.r} ${m.r} 0 0 1 ${x0} ${y1 - m.r}`,
    'Z',
  ].join(' ');
  const hole = [
    `M ${m.bowlCx - m.rInner} ${m.bowlCy}`,
    `A ${m.rInner} ${m.rInner} 0 1 0 ${m.bowlCx + m.rInner} ${m.bowlCy}`,
    `A ${m.rInner} ${m.rInner} 0 1 0 ${m.bowlCx - m.rInner} ${m.bowlCy}`,
    'Z',
  ].join(' ');
  return `${outer} ${hole}`;
}

function iosComposerSvg() {
  const width = 400;
  const height = 560;
  const radius = 44;
  const card = roundedRectPath(0, 0, width, height, radius);
  const mark = letterPPath(width, height);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <path fill="white" fill-rule="evenodd" d="${card} ${mark}"/>
</svg>
`;
}

function writePng(relativePath, png) {
  const out = join(ROOT, relativePath);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png);
  console.log(`wrote ${relativePath} (${png.length} bytes, ${createHash('sha1').update(png).digest('hex').slice(0, 8)})`);
}

mkdirSync(IMAGES, { recursive: true });
mkdirSync(ICON_ASSETS, { recursive: true });

writePng(
  'assets/images/icon.png',
  render({ size: 1024, scale: 0.62, background: FELT, cardColor: CARD_BLUE, inkColor: IVORY, cutoutMark: false }),
);
writePng(
  'assets/images/android-icon-foreground.png',
  render({ size: 1024, scale: 0.52, background: null, cardColor: CARD_BLUE, inkColor: IVORY, cutoutMark: false }),
);
writePng(
  'assets/images/android-icon-background.png',
  render({ size: 1024, scale: 0, background: FELT, cardColor: CLEAR, inkColor: CLEAR, cutoutMark: false }),
);
writePng(
  'assets/images/android-icon-monochrome.png',
  render({ size: 1024, scale: 0.52, background: null, cardColor: WHITE, inkColor: WHITE, cutoutMark: true }),
);
writePng(
  'assets/images/splash-icon.png',
  render({ size: 1024, scale: 0.72, background: null, cardColor: CARD_BLUE, inkColor: IVORY, cutoutMark: false }),
);
writePng(
  'assets/images/favicon.png',
  render({ size: 48, scale: 0.72, background: FELT, cardColor: CARD_BLUE, inkColor: IVORY, cutoutMark: false }),
);
writePng(
  'assets/images/logo.png',
  render({ size: 1024, scale: 0.72, background: null, cardColor: CARD_BLUE, inkColor: IVORY, cutoutMark: false }),
);

writeFileSync(join(ICON_ASSETS, 'card-mark.svg'), iosComposerSvg());
console.log('wrote assets/expo.icon/Assets/card-mark.svg');
