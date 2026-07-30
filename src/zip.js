/**
 * A minimal ZIP writer, store-only (no compression), no dependencies.
 *
 * Purpose: path A (the press in the browser) hands the pressed site back as
 * one downloadable archive. Editions are small; compression belongs to
 * whoever archives them later. Store-only keeps this readable and testable.
 *
 * Follows the ZIP APPNOTE: local file headers, central directory, end record.
 * UTF-8 names are declared with the language encoding flag (bit 11).
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function encodeUTF8(s) {
  return new TextEncoder().encode(s);
}

function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

// A fixed DOS date/time (1980-01-01): deterministic archives, same input
// same bytes, in line with the deterministic ids of the model (D1).
const DOS_TIME = 0;
const DOS_DATE = 0x21;

/**
 * Build a ZIP archive from { "name.html": string | Uint8Array, ... }.
 * Entry order follows the object's key order. Returns a Uint8Array.
 */
export function buildZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encodeUTF8(name);
    const data = typeof content === 'string' ? encodeUTF8(content) : content;
    const crc = crc32(data);
    const flags = 0x0800; // UTF-8 names

    const local = new Uint8Array([
      ...u32(0x04034B50), ...u16(20), ...u16(flags), ...u16(0), // store
      ...u16(DOS_TIME), ...u16(DOS_DATE), ...u32(crc),
      ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ]);
    chunks.push(local, nameBytes, data);

    central.push(new Uint8Array([
      ...u32(0x02014B50), ...u16(20), ...u16(20), ...u16(flags), ...u16(0),
      ...u16(DOS_TIME), ...u16(DOS_DATE), ...u32(crc),
      ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
    ]), nameBytes);

    offset += local.length + nameBytes.length + data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const count = Object.keys(files).length;
  const end = new Uint8Array([
    ...u32(0x06054B50), ...u16(0), ...u16(0), ...u16(count), ...u16(count),
    ...u32(centralSize), ...u32(centralStart), ...u16(0),
  ]);

  let total = centralStart + centralSize + end.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of [...chunks, ...central, end]) { out.set(c, pos); pos += c.length; }
  return out;
}
