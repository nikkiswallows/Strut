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
  signIn,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { captureAuthToken } from "@/lib/session-bearer";
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
      if (join) {
        const { data, error } = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0]!,
          fetchOptions: {
            onSuccess(ctx) {
              captureAuthToken(undefined, ctx.response);
            },
          },
        });
        if (error) throw new Error(error.message ?? "Could not create account.");
        captureAuthToken(data);
      } else {
        const { data, error } = await authClient.signIn.email({
          email,
          password,
          fetchOptions: {
            onSuccess(ctx) {
              captureAuthToken(undefined, ctx.response);
            },
          },
        });
        if (error) throw new Error(error.message ?? "Could not sign in.");
        captureAuthToken(data);
      }
      try {
        await authClient.getSession();
      } catch {
        /* session store recovers on next fetch */
      }
      window.location.href = join ? "/onboarding" : "/discover";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
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
            <p className="font-display text-5xl leading-tight">The night already knows your name.</p>
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
                    ? "Email and a password. Then we dress the profile."
                    : "Sign in to keep matching, posting, and talking."}
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
                    {busy ? "One moment…" : join ? "Join Strut" : "Sign in"}
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
                    onClick={() => signIn(p.providerId, { callbackURL: "/discover" })}
                  >
                    Continue with {p.label}
                  </Button>
                ))}
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
              {join ? "Already on Strut?" : "New here?"}{" "}
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
          <p className="mt-8 text-center text-xs text-subtle">18+ only. Be decent.</p>
        </div>
      </div>
    </div>
  );
}
