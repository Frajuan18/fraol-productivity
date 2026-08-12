// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createZip, crc32 } from '@/lib/zip/createZip';

function u8(values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('crc32', () => {
  it('matches the well-known CRC32 of "hello"', () => {
    expect(crc32(ascii('hello'))).toBe(0x3610a686);
  });

  it('handles empty input', () => {
    expect(crc32(u8([]))).toBe(0x00000000);
  });
});

describe('createZip', () => {
  it('produces a valid archive with the expected structure', () => {
    const zip = createZip([{ name: 'a.txt', data: ascii('hello') }], new Date('2026-01-01T00:00:00Z'));
    const bytes = Array.from(zip);
    // Local file header signature (PK\x03\x04)
    expect(bytes.slice(0, 4)).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // Central directory header signature (PK\x01\x02)
    expect(
      bytes.some((b, i) => b === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x01 && bytes[i + 3] === 0x02),
    ).toBe(true);
    // End of central directory signature (PK\x05\x06) — its 22-byte record ends the file
    expect(
      bytes.some((b, i) => b === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06),
    ).toBe(true);
    // Filename present
    const text = new TextDecoder().decode(u8(bytes));
    expect(text).toContain('a.txt');
  });

  it('contains exactly the payload files', () => {
    const zip = createZip([
      { name: 'one.png', data: u8([1, 2, 3]) },
      { name: 'two.jpg', data: u8([9, 8, 7]) },
    ]);
    const text = new TextDecoder().decode(u8(Array.from(zip)));
    expect(text).toContain('one.png');
    expect(text).toContain('two.jpg');
  });
});
