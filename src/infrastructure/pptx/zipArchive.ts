/**
 * A ZIP writer for the PPTX package. PowerPoint documents are OPC packages —
 * ordinary ZIP archives of XML parts — so the browser needs a writer. Entries
 * are stored (method 0), which every OPC consumer accepts and which keeps this
 * file to headers and a CRC32 table instead of a compressor.
 */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
})();

/** Fixed DOS timestamp (1 January 2024, 12:00) keeps exports byte-identical. */
const DOS_TIME = 12 << 11;
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;

const UTF8_ENCODER = new TextEncoder();

export interface ZipEntry {
  /** Package path, always with forward slashes and no leading slash. */
  path: string;
  bytes: Uint8Array;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export function utf8Bytes(text: string): Uint8Array {
  return UTF8_ENCODER.encode(text);
}

function concatenate(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function localFileHeader(nameBytes: Uint8Array, bytes: Uint8Array, checksum: number): Uint8Array {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);

  writeUint32(view, 0, 0x04034b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, DOS_TIME);
  writeUint16(view, 12, DOS_DATE);
  writeUint32(view, 14, checksum);
  writeUint32(view, 18, bytes.length);
  writeUint32(view, 22, bytes.length);
  writeUint16(view, 26, nameBytes.length);
  writeUint16(view, 28, 0);
  header.set(nameBytes, 30);

  return header;
}

function centralDirectoryHeader(
  nameBytes: Uint8Array,
  bytes: Uint8Array,
  checksum: number,
  localHeaderOffset: number,
): Uint8Array {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);

  writeUint32(view, 0, 0x02014b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 20);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, DOS_TIME);
  writeUint16(view, 14, DOS_DATE);
  writeUint32(view, 16, checksum);
  writeUint32(view, 20, bytes.length);
  writeUint32(view, 24, bytes.length);
  writeUint16(view, 28, nameBytes.length);
  writeUint16(view, 30, 0);
  writeUint16(view, 32, 0);
  writeUint16(view, 34, 0);
  writeUint16(view, 36, 0);
  writeUint32(view, 38, 0);
  writeUint32(view, 42, localHeaderOffset);
  header.set(nameBytes, 46);

  return header;
}

function endOfCentralDirectory(entryCount: number, directorySize: number, directoryOffset: number): Uint8Array {
  const footer = new Uint8Array(22);
  const view = new DataView(footer.buffer);

  writeUint32(view, 0, 0x06054b50);
  writeUint16(view, 4, 0);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, entryCount);
  writeUint16(view, 10, entryCount);
  writeUint32(view, 12, directorySize);
  writeUint32(view, 16, directoryOffset);
  writeUint16(view, 20, 0);

  return footer;
}

/** Builds a complete ZIP archive holding every entry, in the order given. */
export function createStoredZip(entries: ZipEntry[]): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const directoryChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = utf8Bytes(entry.path);
    const checksum = crc32(entry.bytes);
    const header = localFileHeader(nameBytes, entry.bytes, checksum);

    localChunks.push(header, entry.bytes);
    directoryChunks.push(centralDirectoryHeader(nameBytes, entry.bytes, checksum, offset));
    offset += header.length + entry.bytes.length;
  }

  const directory = concatenate(directoryChunks);
  const directoryOffset = offset;

  return concatenate([
    ...localChunks,
    directory,
    endOfCentralDirectory(entries.length, directory.length, directoryOffset),
  ]);
}
