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

/* ---- reading a zip: the review sheet comes back as .xlsx (a zip) ---- */

/** Raw DEFLATE decompression (RFC 1951), no dependencies. Enough to read the
 *  parts of an .xlsx an editor saved: the engine already writes zips, this
 *  lets it read one back. */
export function inflateRaw(data) {
  let bitPos = 0;
  const bit = () => { const b = (data[bitPos >> 3] >> (bitPos & 7)) & 1; bitPos++; return b; };
  const bits = (n) => { let v = 0; for (let i = 0; i < n; i++) v |= bit() << i; return v; };
  const out = [];
  const build = (lengths) => {
    const max = Math.max(...lengths);
    const count = new Array(max + 1).fill(0);
    for (const l of lengths) if (l) count[l]++;
    const next = new Array(max + 1).fill(0);
    let code = 0;
    for (let i = 1; i <= max; i++) { code = (code + count[i - 1]) << 1; next[i] = code; }
    const codes = new Map();
    for (let i = 0; i < lengths.length; i++) {
      const l = lengths[i];
      if (l) { codes.set(l + ':' + next[l], i); next[l]++; }
    }
    return { codes, max };
  };
  const decode = (tree) => {
    let code = 0;
    for (let len = 1; len <= tree.max; len++) {
      code = (code << 1) | bit();
      const sym = tree.codes.get(len + ':' + code);
      if (sym !== undefined) return sym;
    }
    throw new Error('bad code');
  };
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  for (;;) {
    const last = bit();
    const type = bits(2);
    if (type === 0) {
      bitPos = (bitPos + 7) & ~7;
      const len = data[bitPos >> 3] | (data[(bitPos >> 3) + 1] << 8);
      bitPos += 32;
      for (let i = 0; i < len; i++) { out.push(data[bitPos >> 3]); bitPos += 8; }
    } else {
      let litTree, distTree;
      if (type === 1) {
        const ll = []; for (let i = 0; i < 288; i++) ll.push(i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8);
        litTree = build(ll); distTree = build(new Array(30).fill(5));
      } else {
        const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
        const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        const cll = new Array(19).fill(0);
        for (let i = 0; i < hclen; i++) cll[order[i]] = bits(3);
        const clTree = build(cll);
        const lengths = [];
        while (lengths.length < hlit + hdist) {
          const sym = decode(clTree);
          if (sym < 16) lengths.push(sym);
          else if (sym === 16) { const r = bits(2) + 3; const p = lengths[lengths.length - 1]; for (let i = 0; i < r; i++) lengths.push(p); }
          else if (sym === 17) { const r = bits(3) + 3; for (let i = 0; i < r; i++) lengths.push(0); }
          else { const r = bits(7) + 11; for (let i = 0; i < r; i++) lengths.push(0); }
        }
        litTree = build(lengths.slice(0, hlit)); distTree = build(lengths.slice(hlit));
      }
      for (;;) {
        const sym = decode(litTree);
        if (sym === 256) break;
        if (sym < 256) out.push(sym);
        else {
          const len = LBASE[sym - 257] + bits(LEXT[sym - 257]);
          const d = decode(distTree);
          const dist = DBASE[d] + bits(DEXT[d]);
          const start = out.length - dist;
          for (let i = 0; i < len; i++) out.push(out[start + i]);
        }
      }
    }
    if (last) break;
  }
  return new Uint8Array(out);
}

/** Read the named parts of a zip (stored or deflated). Returns a Map of
 *  path -> string. */
export function readZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map();
  let i = 0;
  const dec = new TextDecoder();
  while (i + 4 <= bytes.length && dv.getUint32(i, true) === 0x04034b50) {
    const method = dv.getUint16(i + 8, true);
    const compSize = dv.getUint32(i + 18, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const name = dec.decode(bytes.subarray(i + 30, i + 30 + nameLen));
    const dataStart = i + 30 + nameLen + extraLen;
    const comp = bytes.subarray(dataStart, dataStart + compSize);
    const raw = method === 0 ? comp : inflateRaw(comp);
    files.set(name, dec.decode(raw));
    i = dataStart + compSize;
  }
  return files;
}
