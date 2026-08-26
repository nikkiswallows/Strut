import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { PhoneAuth } from "@/components/phone-auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  getBearerToken,
  signIn,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { captureAuthToken } from "@/lib/session-bearer";
import { writeLocalSession } from "@/lib/local-session";
import { HERO_STREET } from "@/lib/seed-data";

type Search = { mode?: "join" | "in" };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "join" ? "join" : "in",
  }),
  component: Login,
});

function Login() {
  const { mode } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [join, setJoin] = useState(mode === "join");
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phonePhase, setPhonePhase] = useState<"number" | "code">("number");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isPending && user) return <Navigate to="/discover" />;

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authEnabled) return;
    setBusy(true);
    try {
      const res = await fetch("/api/email/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim() || email.split("@")[0],
          join,
          sessionToken: getBearerToken(),
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        token?: string;
        userId?: string;
        isNew?: boolean;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(payload?.error || "Could not sign in.");
      }
      captureAuthToken(payload, res);
      if (payload?.token && payload.userId) {
        writeLocalSession({
          token: payload.token,
          userId: payload.userId,
          name: name.trim() || email.split("@")[0] || null,
        });
      }
      try {
        await authClient.getSession();
      } catch {
        /* session store recovers on next fetch */
      }
      window.location.replace(payload?.isNew || join ? "/onboarding" : "/discover");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(
        /invalid origin/i.test(raw)
          ? "This page couldn't verify the sign-in. Refresh and try again."
          : raw,
      );
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-dvh bg-bg text-fg">
      <img
        src={HERO_STREET}
        alt=""
        className="absolute inset-0 size-full object-cover object-[center_20%] lg:hidden"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/35 lg:hidden" />

      <div className="relative grid min-h-dvh lg:grid-cols-2">
        <div className="relative hidden overflow-hidden lg:block">
          <img src={HERO_STREET} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-10">
            <p className="font-display text-5xl leading-tight">BBC first. Then you talk.</p>
          </div>
        </div>

        <div className="flex flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-12">
          <Link to="/" className="mb-10 w-fit lg:mb-12">
            <Logo markClassName="size-11" wordClassName="text-4xl" />
          </Link>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
            {method === "phone" ? (
              <PhoneAuth join={join} onPhase={setPhonePhase} />
            ) : (
              <>
                <h1 className="font-display text-4xl leading-[0.95] sm:text-5xl">
                  {join ? "Create your profile." : "Welcome back."}
                </h1>
                <p className="mt-2 text-sm text-muted">
                  {join
                    ? "Email and a password. Then you say what you are to the order."
                    : "Sign in. Kings, sissies, wives, and cucks are already here."}
                </p>
                <form onSubmit={onEmailSubmit} className="mt-8 space-y-3.5">
                  {join ? (
                    <Field label="Name">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        placeholder="What should we call you?"
                        className="h-12 text-base"
                      />
                    </Field>
                  ) : null}
                  <Field label="Email">
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@email.com"
                      className="h-12 text-base"
                    />
                  </Field>
                  <Field label="Password" hint={join ? "At least 8 characters." : undefined}>
                    <Input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={join ? "new-password" : "current-password"}
                      placeholder="••••••••"
                      className="h-12 text-base"
                    />
                  </Field>
                  <Button type="submit" size="lg" className="mt-2 h-14 w-full text-base" disabled={busy || !authEnabled}>
                    {busy ? "One moment…" : join ? "Enter the order" : "Sign in"}
                  </Button>
                </form>
              </>
            )}

            {phonePhase === "code" && method === "phone" ? null : (
              <>
                <div className="my-6 flex items-center gap-3 text-xs text-subtle">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>

            {authEnabled ? (
              <div className="space-y-2">
                {GROK_PROVIDERS.map((p) => (
                  <Button
                    key={p.providerId}
                    variant="outline"
                    className="h-12 w-full"
                    onClick={() => {
                      void signIn(p.providerId, { callbackURL: "/discover" }).catch((err) => {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Could not start that sign-in. Use email or phone.",
                        );
                      });
                    }}
                  >
                    Continue with {p.label}
                  </Button>
                ))}
                <p className="pt-1 text-center text-[11px] leading-relaxed text-subtle">
                  If Google or X show "invalid redirect", stay here and use email or
                  phone. That session stays on this site.
                </p>
                <Button
                  variant="ghost"
                  className="h-12 w-full"
                  onClick={() => {
                    setMethod(method === "phone" ? "email" : "phone");
                    setPhonePhase("number");
                  }}
                >
                  {method === "phone" ? "Use email instead" : "Use phone instead"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted">Sign-in is disabled.</p>
            )}

            <p className="mt-8 text-center text-sm text-muted">
              {join ? "Already in the order?" : "New here?"}{" "}
              <button
                type="button"
                className="text-fg underline-offset-4 hover:underline"
                onClick={() => setJoin(!join)}
              >
                {join ? "Sign in" : "Create a profile"}
              </button>
            </p>
              </>
            )}
          </div>
          <p className="mt-8 text-center text-xs tracking-wide text-subtle uppercase">
            18+ only · BNWO · QOS · Serve in the DMs
          </p>
        </div>
      </div>
    </div>
  );
}
