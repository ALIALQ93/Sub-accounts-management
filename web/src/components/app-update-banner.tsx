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

export function AppUpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(shouldShowReleaseBanner());
  }, []);

  if (!visible) return null;

  const onDismiss = () => {
    dismissReleaseBanner();
    setVisible(false);
  };

  return (
    <div
      role="status"
      className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {APP_RELEASE.headlineAr}{" "}
            <span className="font-mono text-xs font-normal text-amber-800">
              ({formatDisplayVersion()} · {getReleaseId()})
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
            {APP_RELEASE.summaryAr}
          </p>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-amber-900/85">
            {APP_RELEASE.highlights.slice(0, 3).map((item) => (
              <li key={item.title}>{item.title}</li>
            ))}
          </ul>
          <Link
            href="/settings/about"
            className="mt-2 inline-block text-xs font-medium text-[var(--brand-navy)] hover:underline"
          >
            تفاصيل الإصدار والتحديثات ←
          </Link>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          فهمت
        </button>
      </div>
    </div>
  );
}
