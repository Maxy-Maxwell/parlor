import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES = join(ROOT, 'assets', 'images');
const ICON_ASSETS = join(ROOT, 'assets', 'expo.icon', 'Assets');

const FELT = [0x1b, 0x3d, 0x32, 0xff];
const IVORY = [0xf3, 0xed, 0xe3, 0xff];
const PIP = [0xc6, 0x28, 0x28, 0xff];
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

function sdDiamond(px, py, cx, cy, rx, ry) {
  return Math.abs(px - cx) / rx + Math.abs(py - cy) / ry - 1;
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
    pipCx: size / 2 - width / 2 + width * 0.24,
    pipCy: size / 2 - height / 2 + height * 0.2,
    pipRx: width * 0.09,
    pipRy: height * 0.075,
    width,
    height,
  };
}

function drawCard(dst, size, scale, cardColor, pipColor, cutoutPip) {
  const g = cardGeometry(size, scale);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const card = coverage(sdRoundBox(px, py, g.cx, g.cy, g.hw, g.hh, g.radius));
      const pip = coverage(sdDiamond(px, py, g.pipCx, g.pipCy, g.pipRx, g.pipRy) * Math.min(g.pipRx, g.pipRy));
      if (cutoutPip) {
        mix(dst, x, y, size, cardColor, Math.max(0, card - pip));
      } else {
        mix(dst, x, y, size, cardColor, card);
        mix(dst, x, y, size, pipColor, pip);
      }
    }
  }
}

function render({ size, scale, background, cardColor, pipColor, cutoutPip }) {
  const dst = Buffer.alloc(size * size * 4);
  if (background) fill(dst, size, size, background);
  else fill(dst, size, size, CLEAR);
  if (scale > 0) drawCard(dst, size, scale, cardColor, pipColor, cutoutPip);
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

function diamondPath(cx, cy, rx, ry) {
  return `M ${cx} ${cy - ry} L ${cx + rx} ${cy} L ${cx} ${cy + ry} L ${cx - rx} ${cy} Z`;
}

function iosComposerSvg() {
  const width = 400;
  const height = 560;
  const radius = 44;
  const card = roundedRectPath(0, 0, width, height, radius);
  const pip = diamondPath(width * 0.24, height * 0.2, width * 0.09, height * 0.075);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <path fill="white" fill-rule="evenodd" d="${card} ${pip}"/>
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
  render({ size: 1024, scale: 0.62, background: FELT, cardColor: IVORY, pipColor: PIP, cutoutPip: false }),
);
writePng(
  'assets/images/android-icon-foreground.png',
  render({ size: 1024, scale: 0.52, background: null, cardColor: IVORY, pipColor: PIP, cutoutPip: false }),
);
writePng(
  'assets/images/android-icon-background.png',
  render({ size: 1024, scale: 0, background: FELT, cardColor: CLEAR, pipColor: CLEAR, cutoutPip: false }),
);
writePng(
  'assets/images/android-icon-monochrome.png',
  render({ size: 1024, scale: 0.52, background: null, cardColor: WHITE, pipColor: WHITE, cutoutPip: true }),
);
writePng(
  'assets/images/splash-icon.png',
  render({ size: 1024, scale: 0.72, background: null, cardColor: IVORY, pipColor: PIP, cutoutPip: false }),
);
writePng(
  'assets/images/favicon.png',
  render({ size: 48, scale: 0.72, background: FELT, cardColor: IVORY, pipColor: PIP, cutoutPip: false }),
);
writePng(
  'assets/images/logo.png',
  render({ size: 1024, scale: 0.72, background: null, cardColor: IVORY, pipColor: PIP, cutoutPip: false }),
);

writeFileSync(join(ICON_ASSETS, 'card-mark.svg'), iosComposerSvg());
console.log('wrote assets/expo.icon/Assets/card-mark.svg');
