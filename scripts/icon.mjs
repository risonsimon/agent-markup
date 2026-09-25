// Generates the toolbar icon as a PNG without any image dependencies:
// a graphite rounded square with a white cursor arrow and an orange marker dot.
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

// Cursor arrow polygon in unit coordinates.
const arrow = [[0.3, 0.22], [0.3, 0.78], [0.44, 0.64], [0.54, 0.84], [0.62, 0.8], [0.52, 0.6], [0.72, 0.6]];
const inPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export function makeIcon(size) {
  const ss = 4; // supersampling for anti-aliasing
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = 0.22;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let bg = 0, fg = 0, dotc = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const u = (x + (sx + 0.5) / ss) / size, v = (y + (sy + 0.5) / ss) / size;
        const dx = Math.max(r - u, 0, u - (1 - r)), dy = Math.max(r - v, 0, v - (1 - r));
        if (dx * dx + dy * dy <= r * r) {
          bg++;
          const dot = (u - 0.74) ** 2 + (v - 0.3) ** 2 <= 0.075 ** 2;
          if (dot) dotc++;
          else if (inPoly(u, v, arrow)) fg++;
        }
      }
      const n = ss * ss, a = bg / n, f = bg ? fg / bg : 0, d = bg ? dotc / bg : 0, b = 1 - f - d;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      // graphite #1d1d20, cursor #f2f2f2, dot #ff6a1f
      raw[o] = Math.round(29 * b + 242 * f + 255 * d);
      raw[o + 1] = Math.round(29 * b + 242 * f + 106 * d);
      raw[o + 2] = Math.round(32 * b + 242 * f + 31 * d);
      raw[o + 3] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
