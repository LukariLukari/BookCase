'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function FinanceDialog({ title, close, busy = false, alert = false, fullScreen = false, children }: {
  title: string;
  close: () => void;
  busy?: boolean;
  alert?: boolean;
  fullScreen?: boolean;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const contentId = useId();

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    if (element) {
      element.scrollLeft = 0;
      element.scrollTop = 0;
    }
    const targetFocus = element?.querySelector<HTMLElement>('[data-dialog-initial-focus]');
    if (targetFocus) {
      targetFocus.focus({ preventScroll: true });
    } else {
      element?.focus({ preventScroll: true });
    }
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      role={alert ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={alert ? contentId : undefined}
      aria-busy={busy}
      tabIndex={-1}
      onCancel={event => { event.preventDefault(); if (!busy) close(); }}
      className={fullScreen ? 'finance-fullscreen-dialog' : 'finance-dialog m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl overflow-x-hidden overflow-y-auto border-2 border-[#302d28] bg-[#f7f3ea] p-5 text-[#1b1916] shadow-[8px_8px_0_#403d38] backdrop:bg-black/50 md:p-7'}
    >
      <div className={fullScreen ? 'finance-fullscreen-header' : 'mb-6 flex w-full min-w-0 items-start justify-between gap-4 border-b-2 border-[#302d28] pb-4'}>
        <h2 id={titleId} className={fullScreen ? 'sr-only' : 'finance-dialog-title min-w-0 flex-1 break-words font-black uppercase [overflow-wrap:anywhere]'}>{title}</h2>
        <button type="button" onClick={close} disabled={busy} aria-label="Đóng" className="btn-push flex h-10 w-10 shrink-0 items-center justify-center disabled:opacity-50"><X size={18} /></button>
      </div>
      <div id={contentId} className={fullScreen ? 'finance-fullscreen-content' : 'w-full min-w-0'}>{children}</div>
    </dialog>
  );
}
