"use client";

import { ReactNode, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

type AiSmeOverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AiSmeOverlay({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: AiSmeOverlayProps) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-teal-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-200">
                <Sparkles className="h-3.5 w-3.5" />
                AI SME Advisory
              </p>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 p-2 text-slate-200 transition hover:bg-white/10"
              aria-label="Close AI overlay"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-slate-200 bg-white px-6 py-4">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
