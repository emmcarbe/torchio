/**
 * Read a TEI file in the encoding it declares, not the one we hope for.
 *
 * A TEI edition is not always UTF-8. An Arabic, Chinese or Japanese text
 * digitised before Unicode was universal is often Shift-JIS, GB18030, Big5,
 * or ISO-8859-6, and the XML declaration says so:
 *
 *   <?xml version="1.0" encoding="Shift_JIS"?>
 *
 * Reading those bytes as UTF-8 turns every character into U+FFFD, silently,
 * and the press reports success. That is the worst loss there is, because it
 * leaves no trace. So: sniff the declared encoding from the first bytes,
 * decode with it, and if the platform has no decoder for it, REFUSE the file
 * with a message that names the encoding, never a page of replacement marks.
 */
import { readFile } from 'node:fs/promises';

/** The BOM and the encoding= of the XML declaration, read from raw bytes.
 *  The declaration is ASCII by construction, so a byte-wise read is safe. */
function declaredEncoding(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'utf-8';
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return 'utf-16le';
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return 'utf-16be';
  // the declaration, if any, is in the first few hundred ASCII bytes
  const head = Buffer.from(bytes.subarray(0, 256)).toString('latin1');
  const m = head.match(/<\?xml[^>]*\bencoding\s*=\s*["']([^"']+)["']/i);
  return m ? m[1].toLowerCase() : 'utf-8';
}

/** Read a file as text, honouring its declared encoding. Throws with the
 *  encoding named if the platform cannot decode it. */
export async function readText(path) {
  const bytes = await readFile(path);
  const enc = declaredEncoding(bytes);
  const label = enc.replace(/^utf-?8$/, 'utf-8').replace(/[_\s]/g, '-');
  // ASCII-superset UTF-8 is the common case: keep the fast path
  if (label === 'utf-8') {
    const text = bytes.toString('utf-8');
    // a lone U+FFFD in a file that claims UTF-8 means the bytes are not UTF-8:
    // do not publish mojibake, say it
    if (text.includes('�') && !bytes.includes(0xEF)) {
      throw new Error(`declared UTF-8 but the bytes are not valid UTF-8 (${path}): `
        + `save the file as UTF-8, or declare its real encoding in the XML declaration`);
    }
    return text;
  }
  try {
    // TextDecoder in Node covers the WHATWG encodings: the Japanese, Chinese,
    // Korean, Cyrillic and Arabic legacy encodings a historical TEI file uses
    const dec = new TextDecoder(label, { fatal: true, ignoreBOM: false });
    return dec.decode(bytes);
  } catch (err) {
    if (err instanceof RangeError || /encoding/i.test(err.message)) {
      throw new Error(`the file declares encoding "${enc}", which this platform `
        + `cannot decode (${path}): re-save it as UTF-8`);
    }
    throw new Error(`"${enc}" declared, but the bytes do not decode as ${enc} (${path}): `
      + `the declaration and the file disagree`);
  }
}
