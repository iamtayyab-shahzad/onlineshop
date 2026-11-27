"use client";

import { useState, useSyncExternalStore } from "react";
import { CircleCheck, Download, EllipsisVertical, Share, Smartphone, SquarePlus, X } from "lucide-react";
import {
  dismissInstall,
  getInstallMode,
  getServerDismissed,
  getServerInstallMode,
  isDismissed,
  promptInstall,
  subscribe,
} from "@/lib/install-prompt";

type Place = "home" | "order" | "help";

const COPY: Record<Place, { title: string; text: string }> = {
  home: { title: "Install our app", text: "Open the shop in one tap from your home screen. Free." },
  order: { title: "Order faster next time", text: "Install our app on your phone. Free, takes a few seconds." },
  help: { title: "Install our app", text: "Put the shop on your home screen, like any other app. Free." },
};

/**
 * "Install our app" banner.
 * - Android Chrome: one tap opens the browser's own install box.
 * - iPhone: shows the Share → Add to Home Screen steps (Apple allows no install button).
 * - Hidden once installed, and inside the installed app.
 * On the home page it can be closed for two weeks; the Help page always shows it, with the menu steps
 * for Android browsers that do not offer one-tap install.
 */
export function InstallApp({ place }: { place: Place }) {
  const mode = useSyncExternalStore(subscribe, getInstallMode, getServerInstallMode);
  const dismissed = useSyncExternalStore(subscribe, isDismissed, getServerDismissed);
  const [showSteps, setShowSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  if (mode === "hidden") return null;
  if (mode === "manual" && place !== "help") return null;
  if (place === "home" && dismissed && mode !== "installed") return null;

  if (mode === "installed") {
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl bg-secondary p-4">
        <CircleCheck className="size-8 shrink-0 text-primary" aria-hidden />
        <p className="text-base">
          <strong>App installed.</strong> Find <strong>Grocery</strong> on your home screen.
        </p>
      </div>
    );
  }

  const { title, text } = COPY[place];

  async function install() {
    setBusy(true);
    await promptInstall();
    setBusy(false);
  }

  return (
    <section aria-label={title} className="rounded-2xl border-2 border-primary bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Smartphone className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-tight font-bold">{title}</p>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
        {place === "home" && (
          <button
            type="button"
            onClick={dismissInstall}
            aria-label="Not now"
            className="-mt-6 -mr-2 flex size-10 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground active:bg-secondary"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {mode === "prompt" ? (
        <button
          type="button"
          onClick={install}
          disabled={busy}
          className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground active:opacity-80 disabled:opacity-60"
        >
          <Download className="size-5" aria-hidden />
          Install app
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowSteps((s) => !s)}
            aria-expanded={showSteps}
            className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground active:opacity-80"
          >
            <Download className="size-5" aria-hidden />
            {showSteps ? "Hide the steps" : "Show me how"}
          </button>
          {showSteps && (mode === "ios" ? <IosSteps /> : <AndroidSteps />)}
        </>
      )}
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-base">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-primary">
        {n}
      </span>
      <span className="pt-1">{children}</span>
    </li>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-1 inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 align-middle font-semibold">
      {children}
    </span>
  );
}

function IosSteps() {
  return (
    <ol className="mt-4 flex flex-col gap-3">
      <Step n={1}>
        Tap the Share button
        <Key>
          <Share className="size-4 text-[#007aff]" aria-label="Share" />
        </Key>
        at the bottom of Safari (on iPad: at the top).
      </Step>
      <Step n={2}>
        Scroll down and tap
        <Key>
          <SquarePlus className="size-4" aria-hidden /> Add to Home Screen
        </Key>
      </Step>
      <Step n={3}>
        Tap <Key>Add</Key> at the top right. The shop is now on your home screen.
      </Step>
      <li className="rounded-lg bg-notice p-3 text-sm text-notice-foreground">
        Opened this link from WhatsApp? Tap the Safari compass or “Open in Safari” first, then follow the steps.
      </li>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol className="mt-4 flex flex-col gap-3">
      <Step n={1}>Open this page in Chrome.</Step>
      <Step n={2}>
        Tap the menu
        <Key>
          <EllipsisVertical className="size-4" aria-label="three dots" />
        </Key>
        at the top right.
      </Step>
      <Step n={3}>
        Tap <Key>Install app</Key> or <Key>Add to Home screen</Key>, then <Key>Install</Key>.
      </Step>
      <li className="rounded-lg bg-notice p-3 text-sm text-notice-foreground">
        Opened this link from WhatsApp? Tap the three dots there and choose “Open in Chrome” first.
      </li>
    </ol>
  );
}
