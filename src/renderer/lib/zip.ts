// A minimal STORED (uncompressed) ZIP writer — exactly enough to package an
// .xlsx, and deliberately dependency-free.
//
// Ported unchanged from the pre-refactor bundle: the output is byte-for-byte
// identical, which is what `tests/unit/xlsx.test.ts` checks against the hash
// recorded by the characterization suite. Nothing here should be "improved"
// without that test being re-run, because those bytes are the contract.

export type ZipEntry = [name: string, data: Uint8Array];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const u16 = (n: number): number[] => [n & 0xFF, (n >>> 8) & 0xFF];
const u32 = (n: number): number[] =>
  [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

/**
 * Pack entries into a ZIP archive with no compression.
 *
 * The return type names `ArrayBuffer` rather than the looser `ArrayBufferLike`
 * so the result can go straight into a `Blob`: a Uint8Array over a
 * SharedArrayBuffer is not a valid BlobPart, and this one never is.
 */
export function zipStore(files: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const nameEnc = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [name, data] of files) {
    const nb = nameEnc.encode(name);
    const crc = crc32(data);

    const localHeader = ([] as number[]).concat(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0)
    );
    local.push(new Uint8Array(localHeader), nb, data);

    const centralHeader = ([] as number[]).concat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)
    );
    central.push(new Uint8Array(centralHeader), nb);

    offset += localHeader.length + nb.length + data.length;
  }

  let centralSize = 0;
  for (const c of central) centralSize += c.length;

  const eocd = new Uint8Array(([] as number[]).concat(
    u32(0x06054b50), u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(centralSize), u32(offset), u16(0)
  ));

  const parts = [...local, ...central, eocd];
  let total = 0;
  for (const p of parts) total += p.length;

  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
