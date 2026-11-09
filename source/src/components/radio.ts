import type { KeyboardEvent } from 'react';

/**
 * Arrow-key support for a group of role="radio" buttons (the standard radio-group pattern):
 * arrows move the selection and focus; only the selected option is in the Tab order.
 */
export function radioKeys<T extends string>(values: readonly T[], current: T, select: (v: T) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = values[(values.indexOf(current) + dir + values.length) % values.length];
    select(next);
    const group = e.currentTarget;
    requestAnimationFrame(() => group.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus());
  };
}
