"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  APP_RELEASE,
  dismissReleaseBanner,
  formatDisplayVersion,
  getReleaseId,
  shouldShowReleaseBanner,
} from "@/config/app-release";

export function AppUpdateModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(shouldShowReleaseBanner());
  }, []);

  if (!open) return null;

  const onDismiss = () => {
    dismissReleaseBanner();
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label="إغلاق"
        onClick={onDismiss}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-2xl">
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-lg font-bold text-amber-700"
            aria-hidden
          >
            ★
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="app-update-title" className="text-lg font-bold">
              {APP_RELEASE.headlineAr}
            </h2>
            <p className="mt-1 font-mono text-xs text-amber-800">
              {formatDisplayVersion()} · {getReleaseId()}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-amber-900/95">
              {APP_RELEASE.summaryAr}
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-amber-900/90">
              {APP_RELEASE.highlights.slice(0, 3).map((item) => (
                <li key={item.title}>{item.title}</li>
              ))}
            </ul>
            <Link
              href="/settings/about"
              className="mt-3 inline-block text-sm font-medium text-[var(--brand-navy)] hover:underline"
            >
              تفاصيل الإصدار والتحديثات ←
            </Link>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            فهمت، ابدأ التجربة
          </button>
        </div>
      </div>
    </div>
  );
}
