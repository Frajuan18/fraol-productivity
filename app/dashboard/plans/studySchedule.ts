export interface StudySession {
  index: number;
  title: string;
  pageRange: string;
  minutes: number;
  done: boolean;
}

const HEADER_PREFIX = 'Sessions:';

export function buildStudyPlanText(sessions: StudySession[]): string {
  const totalMinutes = sessions.reduce((acc, s) => acc + s.minutes, 0);
  const lines = [`${HEADER_PREFIX} ${sessions.length} · ${totalMinutes} min total`];
  sessions.forEach((s) => {
    lines.push(`${s.index}. [${s.done ? 'x' : ' '}] ${s.title} — ${s.pageRange} — ${s.minutes} min`);
  });
  return lines.join('\n');
}

export function parseStudyPlanText(description: string): StudySession[] | null {
  const lines = description.split('\n');
  const headerIndex = lines.findIndex((line) => line.startsWith(HEADER_PREFIX));
  if (headerIndex === -1) return null;

  const sessions: StudySession[] = [];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const match = /^(\d+)\.\s+\[(x| )\]\s+(.+?)\s+—\s+(.+?)\s+—\s+(\d+)\s+min$/.exec(lines[i].trim());
    if (!match) continue;
    sessions.push({
      index: parseInt(match[1], 10),
      done: match[2] === 'x',
      title: match[3],
      pageRange: match[4],
      minutes: parseInt(match[5], 10),
    });
  }
  return sessions.length > 0 ? sessions : null;
}

export function replaceStudyPlanText(description: string, sessions: StudySession[]): string {
  const headerIndex = description.split('\n').findIndex((line) => line.startsWith(HEADER_PREFIX));
  const block = buildStudyPlanText(sessions);
  if (headerIndex === -1) {
    return description ? `${description}\n\n${block}` : block;
  }
  const lines = description.split('\n');
  let end = headerIndex + 1;
  while (end < lines.length && /^\d+\.\s+\[[x ]\]/.test(lines[end].trim())) end += 1;
  const before = lines.slice(0, headerIndex).join('\n').trimEnd();
  const after = lines.slice(end).join('\n').trimStart();
  const joined = [before, block, after].filter(Boolean).join('\n\n');
  return joined;
}

export function partitionPages(totalPages: number, sessionCount: number): string[] {
  if (totalPages <= 0) {
    return Array.from({ length: sessionCount }, () => 'full');
  }
  const perSession = Math.ceil(totalPages / sessionCount);
  const ranges: string[] = [];
  for (let i = 0; i < sessionCount; i += 1) {
    const start = i * perSession + 1;
    const end = Math.min((i + 1) * perSession, totalPages);
    ranges.push(`pp. ${start}–${end}`);
  }
  return ranges;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
