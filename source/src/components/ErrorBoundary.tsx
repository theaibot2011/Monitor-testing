import { Component, type ReactNode } from 'react';
import { STORAGE_KEY } from '../lib/session';
import type { Store } from '../lib/storage';
import { downloadText } from '../lib/hooks';

interface Props {
  store: Store;
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  download = () => {
    let raw: string | null = null;
    try {
      raw = this.props.store.kv.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    downloadText(`monitortest-saved-answers-${Date.now()}.json`, raw ?? '{}');
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="max-w-xl rounded-2xl bg-slate-800 border border-slate-600 p-8 text-center">
          <h1 className="text-3xl font-bold mb-3">Sorry, something went wrong</h1>
          <p className="text-lg text-slate-300 mb-6">
            Your answers are still saved on this computer. Press Reload to carry on where you left off. You can also download your saved answers first, to be safe.
          </p>
          <div className="flex flex-col gap-3">
            <button className="rounded-xl bg-sky-500 text-slate-950 font-semibold text-xl px-6 py-4" onClick={() => location.reload()}>
              Reload
            </button>
            <button className="rounded-xl bg-slate-700 text-white font-semibold text-xl px-6 py-4" onClick={this.download}>
              Download my saved answers (a file)
            </button>
          </div>
          <p className="text-sm text-slate-500 mt-6 break-words">Technical detail: {String(this.state.error.message || this.state.error)}</p>
        </div>
      </div>
    );
  }
}
