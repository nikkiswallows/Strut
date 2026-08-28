import { useEffect, useState } from "react";
import { Mark } from "./logo";

const STORAGE_KEY = "strut-age-ok";

/**
 * The 18+ gate — the first thing anyone sees, before any brand copy, photos
 * or member content. Renders on the server (so the very first paint is the
 * gate, no content flash) and dismisses only after the visitor affirms; the
 * choice is remembered in localStorage so members aren't re-carded on every
 * visit.
 *
 * This is a self-attestation gate, not third-party age assurance — the
 * compliance spine for AV states layers on top of it (see AUDIT.md).
 */
export function AgeGate() {
  const [status, setStatus] = useState<"unknown" | "blocked" | "ok">("unknown");

  useEffect(() => {
    try {
      setStatus(window.localStorage.getItem(STORAGE_KEY) === "1" ? "ok" : "blocked");
    } catch {
      setStatus("blocked");
    }
  }, []);

  if (status === "ok") return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-bg/95 px-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Adults only"
    >
      <div className="w-full max-w-md rounded-3xl border border-accent/30 bg-surface p-8 text-center shadow-gold">
        <Mark className="mx-auto size-14" />
        <p className="mt-5 text-[11px] tracking-[0.32em] text-accent uppercase">Adults only</p>
        <h1 className="mt-2 font-display text-5xl leading-none text-fg">18+</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Strut is an adult community with sexually explicit themes. By entering you
          confirm you are at least 18 years old — or the age of majority where you
          live — and that you consent to viewing adult material.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.setItem(STORAGE_KEY, "1");
              } catch {
                /* private mode — gate simply reappears next visit */
              }
              setStatus("ok");
            }}
            className="btn-gold h-13 rounded-full px-8 text-base"
          >
            I'm 18 or older — Enter
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "https://www.google.com";
            }}
            className="h-12 rounded-full border border-border bg-elevated/70 px-8 text-sm text-muted transition-colors duration-150 hover:text-fg"
          >
            I'm under 18 — Leave
          </button>
        </div>
      </div>
    </div>
  );
}
