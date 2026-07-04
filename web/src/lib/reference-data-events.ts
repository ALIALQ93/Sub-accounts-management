export const ACCOUNTS_CHANGED_EVENT = "app:accounts-changed";

export function notifyAccountsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACCOUNTS_CHANGED_EVENT));
}
