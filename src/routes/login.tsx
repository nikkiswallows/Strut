import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { PhoneAuth } from "@/components/phone-auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import {
  SOCIAL_PROVIDERS,
  signInSocial,
  signInWithEmail,
} from "@/lib/auth/client";
import { fetchRuntimeConfig } from "@/lib/auth/runtime-config";
import type { PublicRuntimeConfig } from "@/lib/auth/runtime-config.server";
import { useMembership } from "@/lib/auth/use-membership";
import { HERO_STREET } from "@/lib/seed-data";

type Search = { mode?: "join" | "in" };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "join" ? "join" : s.mode === "in" ? "in" : undefined,
  }),
  component: Login,
});

function Login() {
  const { mode } = Route.useSearch();
  const { phase } = useMembership();
  const [join, setJoin] = useState(mode === "join");
  const [method, setMethod] = useState<"phone" | "email">("email");
  const [phonePhase, setPhonePhase] = useState<"number" | "code">("number");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<PublicRuntimeConfig | null>(null);

  useEffect(() => {
    void fetchRuntimeConfig().then(setConfig);
  }, []);

  /** Social providers that actually have credentials wired in this deploy. */
  const socials = SOCIAL_PROVIDERS.filter((p) =>
    p.id === "google" ? config?.providers.google : config?.providers.x,
  );

  if (phase === "loading") return <div className="min-h-dvh bg-bg" />;
  if (phase === "member") return <Navigate to="/discover" />;
  if (phase === "needs-profile") return <Navigate to="/onboarding" />;

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithEmail({
        email: email.trim(),
        password,
        name: name.trim() || email.split("@")[0],
        join,
      });
      // Session cookie is set by the response; hard-navigate to bootstrap it.
      window.location.replace("/auth/complete");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Something went wrong.";
      // Better Auth reports an existing-email signup as USER_ALREADY_EXISTS /
      // user already exists — nudge the visitor toward sign-in.
      if (/(already exists|already registered|user already)/i.test(raw) && join) {
        setJoin(false);
        toast.error("An account with that email exists. Sign in instead.");
      } else {
        toast.error(raw);
      }
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
                    ? "Email and a password. Then you tell the order if you kneel, watch, or walk in first."
                    : "Sign in. Kings first. Sissies, wives, and cucks already on the floor."}
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
                  <Button type="submit" size="lg" className="mt-2 h-14 w-full text-base" disabled={busy}>
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

            <div className="space-y-2">
                {socials.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    className="h-12 w-full"
                    onClick={() => {
                      void signInSocial(p.id, "/auth/complete").catch((err) => {
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
                {config && socials.length === 0 ? (
                  <p className="px-2 pt-1 text-center text-[11px] leading-relaxed text-subtle">
                    Social sign-in isn’t wired on this deployment yet — use email
                    or phone.
                  </p>
                ) : null}
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
            18+ only · BNWO · QOS · BBC · Cleanup · Chastity
          </p>
        </div>
      </div>
    </div>
  );
}
