/**
 * "Install our app" state, shared by every install banner.
 *
 * Chrome / Samsung Internet on Android fire `beforeinstallprompt` once per page load, often before
 * React has drawn anything. This module listens from the moment it loads (it is imported by the shop
 * layout), keeps the event, and lets a banner show the real install box later with one tap.
 * iPhone has no such event: there the banner shows a short Share → Add to Home Screen guide instead.
 */

type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** What a banner can offer on this device right now. */
export type InstallMode =
  | "hidden" // already installed, running as the app, or not on the client yet
  | "prompt" // one-tap install (Android Chrome, Samsung Internet, desktop Chrome/Edge)
  | "ios" // iPhone / iPad: show the Share → Add to Home Screen steps
  | "manual" // Android without the event (in-app browser, or Chrome decided not to offer it)
  | "installed"; // just installed from this page

const DISMISS_KEY = "install-banner-dismissed-until";
const DISMISS_DAYS = 14;

let deferred: InstallEvent | null = null;
let justInstalled = false;
let dismissedUntil = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const isBrowser = typeof window !== "undefined";

const ua = isBrowser ? navigator.userAgent : "";
const isIos = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && isBrowser && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);

function isStandalone(): boolean {
  if (!isBrowser) return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

if (isBrowser) {
  try {
    dismissedUntil = Number(localStorage.getItem(DISMISS_KEY)) || 0;
  } catch {
    // Private mode or blocked storage: the banner simply shows again.
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for our own button instead of the browser's mini bar
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    justInstalled = true;
    emit();
  });
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallMode(): InstallMode {
  if (justInstalled) return "installed";
  if (isStandalone()) return "hidden";
  if (deferred) return "prompt";
  if (isIos) return "ios";
  if (isAndroid) return "manual";
  return "hidden";
}

export const getServerInstallMode = (): InstallMode => "hidden";

export const isDismissed = () => dismissedUntil > Date.now();
export const getServerDismissed = () => true;

/** "Not now": hide the home-page banner for two weeks. */
export function dismissInstall() {
  dismissedUntil = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
  try {
    localStorage.setItem(DISMISS_KEY, String(dismissedUntil));
  } catch {
    // ignore: hidden for this visit only
  }
  emit();
}

/** Shows the browser's own install box. Returns true if the customer accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null; // the event can only be used once
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === "accepted") justInstalled = true;
    return outcome === "accepted";
  } catch {
    return false;
  } finally {
    emit();
  }
}
