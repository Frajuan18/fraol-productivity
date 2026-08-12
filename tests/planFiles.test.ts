import { describe, it, expect } from 'vitest';
import {
  MAX_FILE_SIZE,
  isAllowedFileType,
  isWithinSizeLimit,
  detectMimeType,
  countPdfPages,
  parsePlanId,
} from '@/lib/plans/files';

describe('plan files utils', () => {
  describe('isAllowedFileType', () => {
    it('accepts pdf, docx, doc and txt', () => {
      expect(isAllowedFileType('application/pdf')).toBe(true);
      expect(isAllowedFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
      expect(isAllowedFileType('application/msword')).toBe(true);
      expect(isAllowedFileType('text/plain')).toBe(true);
    });

    it('rejects unknown types', () => {
      expect(isAllowedFileType('image/png')).toBe(false);
      expect(isAllowedFileType('')).toBe(false);
    });
  });

  describe('isWithinSizeLimit', () => {
    it('allows sizes within the limit', () => {
      expect(isWithinSizeLimit(1)).toBe(true);
      expect(isWithinSizeLimit(MAX_FILE_SIZE)).toBe(true);
    });

    it('rejects empty and oversized files', () => {
      expect(isWithinSizeLimit(0)).toBe(false);
      expect(isWithinSizeLimit(MAX_FILE_SIZE + 1)).toBe(false);
    });
  });

  describe('detectMimeType', () => {
    it('detects a PDF by magic bytes', () => {
      expect(detectMimeType(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    });

    it('returns octet-stream otherwise', () => {
      expect(detectMimeType(Buffer.from('plain text'))).toBe('application/octet-stream');
    });
  });

  describe('countPdfPages', () => {
    it('extracts the page count from a simple PDF', () => {
      const pdf = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 42 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
      );
      expect(countPdfPages(pdf)).toBe(42);
    });

    it('returns null for non-PDF buffers', () => {
      expect(countPdfPages(Buffer.from('hello world'))).toBeNull();
    });

    it('returns null when the count cannot be found', () => {
      const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n%%EOF');
      expect(countPdfPages(pdf)).toBeNull();
    });
  });

  describe('parsePlanId', () => {
    it('parses positive integers', () => {
      expect(parsePlanId('123')).toBe(123);
    });

    it('rejects invalid ids', () => {
      expect(parsePlanId('0')).toBeNull();
      expect(parsePlanId('-5')).toBeNull();
      expect(parsePlanId('abc')).toBeNull();
      expect(parsePlanId('1.5')).toBeNull();
    });
  });
});
