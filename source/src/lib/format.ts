/** Unambiguous date and time in the reader's own format, e.g. "9 Nov 2026, 11:56" or "Nov 9, 2026, 11:56 AM". */
export function fmtDateTime(ms: number) {
  try {
    return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function fmtTime(ms: number) {
  try {
    return new Date(ms).toLocaleTimeString(undefined, { timeStyle: 'short' });
  } catch {
    return new Date(ms).toISOString().slice(11, 16);
  }
}
