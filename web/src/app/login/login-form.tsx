"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { settingsApi } from "@/modules/settings/services/settings-api";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await settingsApi.signIn(email, password);
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تسجيل الدخول.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="grid gap-4">
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium text-slate-700">البريد الإلكتروني</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          placeholder="name@company.com"
          className="rounded-lg border border-slate-300 px-3 py-2.5 transition focus:border-[var(--brand-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-gold)]/20"
          dir="ltr"
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="font-medium text-slate-700">كلمة المرور</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="rounded-lg border border-slate-300 px-3 py-2.5 transition focus:border-[var(--brand-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-gold)]/20"
          dir="ltr"
        />
      </label>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-1 rounded-lg bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-navy-light)] disabled:opacity-60"
      >
        {isLoading ? "جاري الدخول..." : "دخول"}
      </button>
    </form>
  );
}
