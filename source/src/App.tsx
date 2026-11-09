import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Ctx, type AppCtx, type Patch } from './state';
import { ARCHIVE_KEY, migrate, newSession, type Session } from './lib/session';
import type { Store } from './lib/storage';
import { Button, HelpContent, Modal } from './components/ui';
import Home from './screens/Home';
import { BeforeYouStart, Preparation } from './screens/Intro';
import Details from './screens/Details';
import DisplayCheckScreen from './screens/DisplayCheck';
import TestScreen from './screens/TestScreen';
import Report from './screens/Report';
import Review from './screens/Review';
import SelfCheck from './screens/SelfCheck';

const IMPORTED_KEY = 'monitortest.imported.v1';

function readImported(): Session | null {
  try {
    const raw = sessionStorage.getItem(IMPORTED_KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function setQuery(selftest: boolean) {
  try {
    const url = new URL(location.href);
    if (selftest) url.searchParams.set('selftest', '1');
    else url.searchParams.delete('selftest');
    history.replaceState(null, '', url.toString());
  } catch {
    /* ignore */
  }
}

export default function App({ store }: { store: Store }) {
  const [initial] = useState(() => store.load());
  const [s, setS] = useState<Session>(() => initial.session ?? newSession());
  const [notice, setNotice] = useState<string | null>(initial.message);
  const [help, setHelp] = useState(false);
  const [selfCheck, setSelfCheck] = useState(() => new URLSearchParams(location.search).get('selftest') === '1');
  const [imported, setImported] = useState<Session | null>(readImported);

  useEffect(() => store.save(s), [s, store]);

  const update = useCallback((p: Patch) => {
    setS((prev) => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p), updatedAt: Date.now() }));
  }, []);

  const startOver = useCallback(() => {
    setS((prev) => {
      const hasData = Object.keys(prev.answers).length > 0 || prev.displayCheck !== null || prev.details.model !== '';
      if (hasData) {
        try {
          const list: unknown = JSON.parse(store.kv.getItem(ARCHIVE_KEY) || '[]');
          const arr = Array.isArray(list) ? list : [];
          arr.unshift(prev);
          store.kv.setItem(ARCHIVE_KEY, JSON.stringify(arr.slice(0, 5)));
        } catch {
          /* archive is best effort; the Home screen offers a download first */
        }
      }
      return newSession(prev.purpose);
    });
  }, [store]);

  const ctx: AppCtx = useMemo(
    () => ({
      s,
      update,
      store,
      openHelp: () => setHelp(true),
      openSelfCheck: () => {
        setHelp(false);
        setSelfCheck(true);
        setQuery(true);
      },
      startOver,
      showImported: (imp: Session) => {
        try {
          sessionStorage.setItem(IMPORTED_KEY, JSON.stringify(imp));
        } catch {
          /* ignore */
        }
        setImported(imp);
      },
    }),
    [s, update, store, startOver]
  );

  let body: ReactNode;
  if (selfCheck) {
    body = (
      <SelfCheck
        onClose={() => {
          setSelfCheck(false);
          setQuery(false);
        }}
      />
    );
  } else if (imported) {
    body = (
      <Report
        session={imported}
        readOnly
        onClose={() => {
          try {
            sessionStorage.removeItem(IMPORTED_KEY);
          } catch {
            /* ignore */
          }
          setImported(null);
        }}
      />
    );
  } else {
    switch (s.screen) {
      case 'before': body = <BeforeYouStart />; break;
      case 'prep': body = <Preparation />; break;
      case 'details': body = <Details />; break;
      case 'display': body = <DisplayCheckScreen />; break;
      case 'test': body = <TestScreen />; break;
      case 'report': body = <Report session={s} />; break;
      case 'review': body = <Review />; break;
      default: body = <Home />;
    }
  }

  return (
    <Ctx.Provider value={ctx}>
      {notice && (
        <div className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] max-w-lg w-[calc(100%-2rem)] rounded-xl bg-amber-300 text-slate-950 p-4 shadow-xl flex gap-4 items-center">
          <span className="flex-1">{notice}</span>
          <Button variant="secondary" onClick={() => setNotice(null)}>OK</Button>
        </div>
      )}
      {body}
      {help && (
        <Modal title="Help: getting a fair result" onClose={() => setHelp(false)}>
          <HelpContent onSelfCheck={ctx.openSelfCheck} />
        </Modal>
      )}
    </Ctx.Provider>
  );
}
