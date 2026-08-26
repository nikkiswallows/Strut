import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient, getBearerToken } from "@/lib/auth/client";
import {
  COUNTRIES,
  countryByIso,
  filterCountries,
  formatE164,
  formatNational,
  guessCountryIso,
  isValidNational,
  type Country,
} from "@/lib/phone";
import { sendPhoneCode } from "@/lib/server/phone";
import { captureAuthToken } from "@/lib/session-bearer";
import { writeLocalSession } from "@/lib/local-session";
import { cn } from "@/lib/utils";

const BEARER_KEY = "grok-auth.bearer-token";

type Phase = "number" | "code";

type SendResult = {
  e164: string;
  delivery: "sms" | "preview";
  expiresIn: number;
  resendIn: number;
  previewCode: string | null;
};

function attachSession(token: string) {
  try {
    sessionStorage.setItem(BEARER_KEY, token);
    localStorage.setItem(BEARER_KEY, token);
  } catch {
    /* storage blocked */
  }
}

export function PhoneAuth({
  join,
  onPhase,
}: {
  join: boolean;
  onPhase?: (phase: Phase) => void;
}) {
  const [phase, setPhase] = useState<Phase>("number");
  const [iso, setIso] = useState("US");
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [sent, setSent] = useState<SendResult | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  function go(next: Phase) {
    setPhase(next);
    onPhase?.(next);
  }

  useEffect(() => {
    setIso(guessCountryIso());
  }, []);

  useEffect(() => {
    if (phase === "number") phoneRef.current?.focus();
    if (phase === "code") codeRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (phase !== "code") return;
    const input = codeRef.current;
    if (!input) return;

    type OtpCredential = Credential & { code?: string };
    const creds = navigator.credentials as CredentialsContainer & {
      get: (opts: unknown) => Promise<OtpCredential | null>;
    };
    if (!("OTPCredential" in window)) return;

    const ac = new AbortController();
    void creds
      .get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then((otp) => {
        const value = otp?.code?.replace(/\D/g, "").slice(0, 6);
        if (value) setCode(value);
      })
      .catch(() => {
        /* WebOTP unsupported or aborted */
      });
    return () => ac.abort();
  }, [phase, sent?.e164]);

  const country = countryByIso(iso) ?? COUNTRIES[0]!;
  const valid = isValidNational(iso, national);

  async function requestCode(nextIso = iso, nextNational = national) {
    if (!valid && nextNational === national) {
      toast.error("Enter a valid mobile number.");
      return;
    }
    setBusy(true);
    try {
      const result = await sendPhoneCode({
        data: { iso: nextIso, national: nextNational },
      });
      setSent(result);
      setIso(nextIso);
      setNational(nextNational);
      setCode("");
      setResendIn(result.resendIn);
      setPhase("code");
      onPhase?.("code");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send a code.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    if (digits.length !== 6 || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/phone/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ iso, national, code: digits, sessionToken: getBearerToken() }),
      });
      const payload = (await res.json().catch(() => null)) as {
        token?: string;
        userId?: string;
        isNew?: boolean;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(payload?.error || "Could not verify that code.");
      }
      captureAuthToken(payload, res);
      if (payload?.token && payload.userId) {
        writeLocalSession({ token: payload.token, userId: payload.userId, name: null });
      }
      if (payload?.token) attachSession(payload.token);
      try {
        await authClient.getSession();
      } catch {
        /* session store recovers on next fetch */
      }
      window.location.replace(payload?.isNew ? "/onboarding" : "/discover");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify that code.");
      setBusy(false);
      setCode("");
      codeRef.current?.focus();
    }
  }

  function onCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) void confirmCode(digits);
  }

  return (
    <div>
      {phase === "number" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void requestCode();
          }}
        >
          <div>
            <h1 className="font-display text-4xl leading-[0.95] sm:text-5xl">
              {join ? "Your number." : "Welcome back."}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {join
                ? "We’ll text a code. Then you say if you’re a king, a sissy, a wife, or a cuck."
                : "Sign in with the number on your account. We’ll text a code."}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPicker(true)}
              className="flex h-14 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-elevated px-3 text-base text-fg transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent/60"
              aria-label={`Country, ${country.name}, plus ${country.dial}`}
            >
              <span className="font-medium tracking-wide">{country.iso}</span>
              <span className="text-muted">+{country.dial}</span>
              <ChevronDown className="size-4 text-subtle" />
            </button>
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Mobile number</span>
              <input
                ref={phoneRef}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="done"
                placeholder={iso === "US" || iso === "CA" ? "(555) 123-4567" : "Mobile number"}
                value={formatNational(iso, national)}
                onChange={(e) =>
                  setNational(
                    e.target.value.replace(/\D/g, "").slice(0, country.max + (country.dial === "1" ? 1 : 0)),
                  )
                }
                className="h-14 w-full rounded-lg border border-border bg-elevated px-3.5 text-base text-fg placeholder:text-subtle outline-none transition-colors duration-150 focus:border-accent/70 focus:ring-2 focus:ring-accent/25"
              />
            </label>
          </div>

          <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={busy || !valid}>
            {busy ? "Sending…" : "Text me a code"}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void confirmCode(code);
          }}
        >
          <div>
            <h1 className="font-display text-4xl leading-[0.95] sm:text-5xl">Enter the code.</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Sent to{" "}
              <span className="text-fg">{sent ? formatE164(sent.e164) : formatE164(`+${country.dial}${national}`)}</span>
              .{" "}
              <button
                type="button"
                className="text-fg underline-offset-4 hover:underline"
                onClick={() => {
                  go("number");
                  setCode("");
                }}
              >
                Change
              </button>
            </p>
          </div>

          {sent?.delivery === "preview" && sent.previewCode ? (
            <div className="rounded-lg border border-border bg-elevated px-4 py-3">
              <p className="text-[11px] tracking-[0.18em] text-subtle uppercase">Preview code</p>
              <p
                id="preview-otp"
                className="mt-1 font-display text-3xl tracking-[0.28em] text-fg tabular-nums"
              >
                {sent.previewCode}
              </p>
              <p className="mt-1 text-xs text-muted">
                Texts aren’t connected yet, so the code is shown here.
              </p>
            </div>
          ) : (
            <p className="text-xs text-subtle">It expires in five minutes. iPhone will offer to fill it from Messages.</p>
          )}

          <div className="relative">
            <div className="pointer-events-none flex gap-2" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "grid h-14 flex-1 place-items-center rounded-lg border bg-elevated text-2xl font-medium tabular-nums",
                    code[i]
                      ? "border-accent/70 text-fg"
                      : i === code.length
                        ? "border-accent/70 ring-2 ring-accent/25 text-subtle"
                        : "border-border text-subtle",
                  )}
                >
                  {code[i] ?? ""}
                </div>
              ))}
            </div>
            <input
              ref={codeRef}
              type="text"
              name="one-time-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              pattern="[0-9]*"
              maxLength={6}
              enterKeyHint="done"
              aria-label="6-digit code"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              className="absolute inset-0 z-10 h-full w-full cursor-text opacity-[0.02]"
            />
          </div>

          <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : "Continue"}
          </Button>

          <p className="text-center text-sm text-muted">
            {resendIn > 0 ? (
              <span>Resend in {resendIn}s</span>
            ) : (
              <button
                type="button"
                className="text-fg underline-offset-4 hover:underline"
                disabled={busy}
                onClick={() => void requestCode()}
              >
                Resend code
              </button>
            )}
          </p>
        </form>
      )}

      {picker ? (
        <CountrySheet
          current={iso}
          onClose={() => setPicker(false)}
          onPick={(next) => {
            setIso(next.iso);
            setNational("");
            setPicker(false);
            window.setTimeout(() => phoneRef.current?.focus(), 50);
          }}
        />
      ) : null}
    </div>
  );
}

function CountrySheet({
  current,
  onClose,
  onPick,
}: {
  current: string;
  onClose: () => void;
  onPick: (country: Country) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const list = useMemo(() => filterCountries(query), [query]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close country list"
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
      />
      <div className="relative flex max-h-[86dvh] flex-col rounded-t-2xl border border-border bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-soft">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border" />
        <div className="px-5 pt-4 pb-3">
          <p className="font-display text-2xl">Country</p>
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Name or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-elevated pr-3 pl-10 text-base text-fg placeholder:text-subtle outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/25"
            />
          </label>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {list.map((c) => {
            const active = c.iso === current;
            return (
              <li key={`${c.iso}-${c.dial}`}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className={cn(
                    "flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors duration-150",
                    active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg",
                  )}
                >
                  <span className="grid w-9 place-items-center rounded-md bg-bg text-xs font-medium tracking-wide text-fg">
                    {c.iso}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-subtle">+{c.dial}</span>
                </button>
              </li>
            );
          })}
          {list.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-subtle">No match.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
