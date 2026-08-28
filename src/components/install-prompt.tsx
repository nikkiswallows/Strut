import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "strut.install.dismissed.v1";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // iOS < 13 quirk
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const webkit = /AppleWebKit/.test(ua);
  // iOS Chrome/Firefox are WebKit; the Share-sheet flow still applies.
  return ios && webkit;
}

/**
 * "Add to Home Screen" flow. Opens an overlay on mobile (the app's first page)
 * that walks the user through saving Strut so it opens full-screen, offline,
 * like a native app. Automatically hides on a device already running the
 * installed/web-app version, and respects a one-time dismissal.
 *
 *  - iOS Safari: animated arrow pointing at the Share button (the save cue).
 *  - Android/desktop (Chrome): a real "Install Strut" button via
 *    `beforeinstallprompt`.
 */
export function InstallPrompt({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [deferred, setDeferred] = useState<unknown>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY)) return;

    const ios = isIosSafari();
    if (ios) {
      setPlatform("ios");
      // Show after a beat so the first paint is the product, then the hint.
      const t = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setPlatform("android");
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    const evt = deferred as
      | { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }
      | null;
    if (!evt) return;
    await evt.prompt();
    dismiss();
  };

  return (
    <div className={cn("fixed inset-0 z-[60] flex items-end justify-center", className)}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-overlay"
        onClick={dismiss}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border-t border-border bg-surface px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-sheet-up">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-elevated text-muted transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          <X className="size-4" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Download className="size-6" />
          </div>
          <div>
            <p className="font-display text-2xl leading-tight">Add Strut to your Home Screen</p>
            <p className="text-sm text-muted">Open it full-screen. Swipe it like a native app.</p>
          </div>
        </div>

        {platform === "ios" ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-elevated p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Step 1</p>
                  <p className="text-sm text-muted">Tap the Share button in your browser</p>
                </div>
                <div className="relative grid size-12 place-items-center rounded-xl bg-fg text-bg">
                  <ShareGlyph />
                  {/* animated arrow pointing up at the Share button */}
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce text-accent">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="inline">
                      <path d="M12 3l7 7h-4v8H9v-8H5l7-7z" fill="currentColor" />
                    </svg>
                  </span>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-border bg-bg p-3.5">
                <p className="mb-2 text-sm font-medium text-muted">Then tap</p>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-[#f7a600] px-2 py-1 text-xs font-bold text-black">
                    Add to Home Screen
                  </span>
                  <span className="text-xs text-subtle">on the share sheet</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-subtle">
                Strut installs as an app icon on your Home Screen — no App Store needed.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Strut installs directly from the browser as a web app — it opens full-screen and
              works like a native app, no store required.
            </p>
            <button
              type="button"
              onClick={() => void install()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-fg text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              <Download className="size-4" />
              Install Strut
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-bg">
      <path
        d="M18 8a3 3 0 1 0-2.83-4M18 8a3 3 0 1 1-2.83 4M18 8l-8 4M10 15.5a3 3 0 1 1-4-2.83M10 15.5a3 3 0 1 0 4 2.83"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
