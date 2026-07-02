"use client";

import { useEffect } from "react";

type ModalSize = "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  size?: ModalSize;
  onClose: () => void;
  children: React.ReactNode;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export function Modal({
  open,
  title,
  description,
  size = "md",
  onClose,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        aria-label="إغلاق"
        onClick={onClose}
      />
      <div
        className={`relative z-10 max-h-[92vh] w-full ${SIZE_CLASS[size]} overflow-y-auto rounded-xl bg-white p-6 shadow-2xl md:p-8`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-xl font-bold text-slate-900">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
