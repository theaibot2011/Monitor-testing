import { createContext, useContext } from 'react';
import type { Session } from './lib/session';
import type { Store } from './lib/storage';

export type Patch = Partial<Session> | ((s: Session) => Partial<Session>);

export interface AppCtx {
  s: Session;
  update: (p: Patch) => void;
  store: Store;
  openHelp: () => void;
  openSelfCheck: () => void;
  startOver: () => void;
  showImported: (s: Session) => void;
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('App context missing');
  return c;
}
