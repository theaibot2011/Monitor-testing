import { migrate, type Session } from './session';

export const FILE_FORMAT = 'monitortest-results';
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function exportResults(session: Session): string {
  return JSON.stringify({ format: FILE_FORMAT, exportedAt: new Date().toISOString(), session }, null, 2);
}

export function exportFilename(session: Session) {
  const safe = (session.details.model || 'monitor').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'monitor';
  const d = new Date(session.updatedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `monitortest-${safe}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/** Strictly parse a results file. Returns the session or a plain error message. Content is only ever rendered as text. */
export function parseResults(text: string): { session: Session } | { error: string } {
  if (text.length > MAX_FILE_BYTES) return { error: 'This file is too large to be a MonitorTest results file.' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'This file could not be read. It is not a MonitorTest results file.' };
  }
  if (typeof data !== 'object' || data === null || (data as { format?: unknown }).format !== FILE_FORMAT) {
    return { error: 'This is not a MonitorTest results file.' };
  }
  const session = migrate((data as { session?: unknown }).session);
  if (!session) return { error: 'This results file is damaged or from an unknown version.' };
  return { session };
}
