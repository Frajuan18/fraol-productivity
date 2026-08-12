/**
 * Minimal, dependency-free ZIP writer (STORE method, no compression). Produces a valid ZIP
 * archive containing exactly the given files — used for snapshot export so the feature needs
 * no third-party compression dependency and stays deterministic for tests.
 */

export interface ZipFileInput {
  name: string;
  data: Uint8Array;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; dateValue: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dateValue = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, dateValue };
}

function pushU16(bytes: number[], value: number): void {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushU32(bytes: number[], value: number): void {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function pushBytes(bytes: number[], value: Uint8Array): void {
  for (let i = 0; i < value.length; i++) bytes.push(value[i]);
}

export function createZip(files: ZipFileInput[], modifiedAt = new Date()): Uint8Array {
  const { time, dateValue } = dosDateTime(modifiedAt);
  const bytes: number[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);

    const localHeaderOffset = offset;
    const localHeader: number[] = [];
    pushU32(localHeader, 0x04034b50);
    pushU16(localHeader, 0x14);
    pushU16(localHeader, 0x0000);
    pushU16(localHeader, 0x0000);
    pushU16(localHeader, time);
    pushU16(localHeader, dateValue);
    pushU32(localHeader, crc);
    pushU32(localHeader, file.data.length);
    pushU32(localHeader, file.data.length);
    pushU16(localHeader, name.length);
    pushU16(localHeader, 0);
    pushBytes(localHeader, name);
    pushBytes(bytes, Uint8Array.from(localHeader));
    pushBytes(bytes, file.data);
    offset += localHeader.length + file.data.length;

    const centralHeader: number[] = [];
    pushU32(centralHeader, 0x02014b50);
    pushU16(centralHeader, 0x0014);
    pushU16(centralHeader, 0x14);
    pushU16(centralHeader, 0x0000);
    pushU16(centralHeader, 0x0000);
    pushU16(centralHeader, time);
    pushU16(centralHeader, dateValue);
    pushU32(centralHeader, crc);
    pushU32(centralHeader, file.data.length);
    pushU32(centralHeader, file.data.length);
    pushU16(centralHeader, name.length);
    pushU16(centralHeader, 0);
    pushU16(centralHeader, 0);
    pushU16(centralHeader, 0);
    pushU16(centralHeader, 0);
    pushU32(centralHeader, 0);
    pushU32(centralHeader, localHeaderOffset);
    pushBytes(centralHeader, name);
    pushBytes(central, Uint8Array.from(centralHeader));
  }

  const centralOffset = offset;
  pushBytes(bytes, Uint8Array.from(central));
  offset += central.length;

  const eocd: number[] = [];
  pushU32(eocd, 0x06054b50);
  pushU16(eocd, 0);
  pushU16(eocd, 0);
  pushU16(eocd, files.length);
  pushU16(eocd, files.length);
  pushU32(eocd, central.length);
  pushU32(eocd, centralOffset);
  pushU16(eocd, 0);
  pushBytes(bytes, Uint8Array.from(eocd));

  return Uint8Array.from(bytes);
}
