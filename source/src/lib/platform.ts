/** Small, dependency-free platform hints for wording instructions. */
export function isMac(): boolean {
  try {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const p = nav.userAgentData?.platform || navigator.platform || navigator.userAgent;
    return /mac/i.test(p) && !isTouchOnly();
  } catch {
    return false;
  }
}

/** A phone or tablet with no mouse or trackpad. */
export function isTouchOnly(): boolean {
  try {
    return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  } catch {
    return false;
  }
}

export const zoomKeys = () => (isMac() ? 'Cmd (⌘) and 0' : 'Ctrl and 0');
