import { useState, type ReactNode } from 'react';
import { useApp } from '../state';
import { AboutContent, Button, Modal } from './ui';

/** Page frame for every non-pattern screen: title, quiet save indicator, About and Help. */
export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { store, openHelp } = useApp();
  const [about, setAbout] = useState(false);
  return (
    <div className="min-h-full flex flex-col">
      <header className="no-print flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-800">
        <div className="font-bold text-lg tracking-tight">MonitorTest</div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-sm text-slate-400" aria-live="polite" data-testid="save-indicator">
            {store.persistent ? (
              <>
                {'\u2713 '}
                <span className="hidden sm:inline">Your progress is saved</span>
                <span className="sm:hidden">Saved</span>
              </>
            ) : (
              'Progress can\u2019t be saved in this browser. Keep this tab open.'
            )}
          </span>
          <Button variant="ghost" onClick={() => setAbout(true)}>About</Button>
          <Button variant="ghost" onClick={openHelp} aria-label="Help">Help</Button>
        </div>
      </header>
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 py-8 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>{children}</main>
      {about && (
        <Modal title="About MonitorTest and your privacy" onClose={() => setAbout(false)}>
          <AboutContent />
        </Modal>
      )}
    </div>
  );
}
