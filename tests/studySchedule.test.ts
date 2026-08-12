import { describe, it, expect } from 'vitest';
import {
  buildStudyPlanText,
  parseStudyPlanText,
  replaceStudyPlanText,
  partitionPages,
  formatFileSize,
} from '@/app/dashboard/plans/studySchedule';

describe('studySchedule', () => {
  describe('buildStudyPlanText', () => {
    it('writes a header plus one line per session', () => {
      const text = buildStudyPlanText([
        { index: 1, title: 'Session 1', pageRange: 'pp. 1–5', minutes: 45, done: false },
        { index: 2, title: 'Session 2', pageRange: 'pp. 6–10', minutes: 45, done: true },
      ]);
      expect(text).toContain('Sessions: 2 · 90 min total');
      expect(text).toContain('1. [ ] Session 1 — pp. 1–5 — 45 min');
      expect(text).toContain('2. [x] Session 2 — pp. 6–10 — 45 min');
    });
  });

  describe('parseStudyPlanText', () => {
    it('returns null when no study block exists', () => {
      expect(parseStudyPlanText('Just a plain plan')).toBeNull();
    });

    it('parses sessions from generated text', () => {
      const text = buildStudyPlanText([
        { index: 1, title: 'Session 1', pageRange: 'pp. 1–5', minutes: 45, done: false },
        { index: 2, title: 'Session 2', pageRange: 'pp. 6–10', minutes: 45, done: true },
      ]);
      const sessions = parseStudyPlanText(`Notes about the plan.\n\n${text}`);
      expect(sessions).not.toBeNull();
      expect(sessions).toHaveLength(2);
      expect(sessions![0].done).toBe(false);
      expect(sessions![1].done).toBe(true);
      expect(sessions![1].pageRange).toBe('pp. 6–10');
    });
  });

  describe('replaceStudyPlanText', () => {
    it('appends a block when none exists', () => {
      const result = replaceStudyPlanText('Notes', [
        { index: 1, title: 'Session 1', pageRange: 'full', minutes: 30, done: false },
      ]);
      expect(result).toContain('Notes');
      expect(result).toContain('Sessions: 1 · 30 min total');
    });

    it('replaces an existing block while preserving surrounding text', () => {
      const original = buildStudyPlanText([
        { index: 1, title: 'Session 1', pageRange: 'pp. 1–5', minutes: 45, done: false },
      ]);
      const result = replaceStudyPlanText(`Intro\n\n${original}`, [
        { index: 1, title: 'Session 1', pageRange: 'pp. 1–5', minutes: 45, done: true },
      ]);
      expect(result).toContain('Intro');
      expect(result).toContain('1. [x] Session 1');
      expect(result.split('\n').filter((l) => l.startsWith('Sessions:')).length).toBe(1);
    });
  });

  describe('partitionPages', () => {
    it('divides pages into equal ranges', () => {
      expect(partitionPages(10, 2)).toEqual(['pp. 1–5', 'pp. 6–10']);
    });

    it('rounds uneven divisions up', () => {
      expect(partitionPages(7, 3)).toEqual(['pp. 1–3', 'pp. 4–6', 'pp. 7–7']);
    });

    it('returns full when page count is unknown', () => {
      expect(partitionPages(0, 3)).toEqual(['full', 'full', 'full']);
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes, KB and MB', () => {
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });
});
