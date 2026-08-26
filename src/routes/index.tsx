import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Logo, Wordmark } from "@/components/logo";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { HERO_LOCKER, HERO_PHOTO, HERO_STREET } from "@/lib/seed-data";
import { listFeatured } from "@/lib/server/profiles";
import { shownAge } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const featured = useQuery({ queryKey: ["featured"], queryFn: () => listFeatured() });

  if (!isPending && user) return <Navigate to="/discover" />;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 lg:px-10">
        <Logo markClassName="size-10" wordClassName="text-3xl" />
        <Link
          to="/login"
          className="text-sm text-muted transition-colors duration-150 hover:text-fg active:scale-[0.96]"
        >
          Sign in
        </Link>
      </header>

      <section className="relative min-h-[100dvh] overflow-hidden">
        <img
          src={HERO_PHOTO}
          alt=""
          className="absolute inset-0 size-full object-cover object-[center_18%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/20" />
        <Wordmark className="pointer-events-none absolute inset-x-0 top-[18%] text-center text-[22vw] leading-none text-fg/10 sm:text-[18vw]" />
        <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-end px-6 pb-16 pt-28">
          <p className="text-xs tracking-[0.32em] text-accent uppercase">18+ dating</p>
          <h1 className="mt-3 font-display text-6xl leading-[0.88] text-fg sm:text-7xl lg:text-8xl">
            Walk in.
            <br />
            Be seen.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            Strut is dating for BNWO, cuckold, T-girls, sissies, trans women — and
            the men, women, couples, and groups who actually want them.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/login" search={{ mode: "join" }}>
              <Button size="lg" className="h-14 w-full text-base sm:w-auto">
                Join Strut
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/login" search={{ mode: "in" }}>
              <Button variant="outline" size="lg" className="h-14 w-full text-base sm:w-auto">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-14">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-6">
            <p className="text-xs tracking-[0.28em] text-subtle uppercase">Already in the room</p>
            <h2 className="mt-1 font-display text-5xl">Bulls, sissies, wives, cucks, T-girls.</h2>
          </div>
          <div className="hide-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
            {(featured.data ?? []).map((p) => {
              const age = shownAge(p);
              return (
                <Link
                  key={p.userId}
                  to="/login"
                  search={{ mode: "join" }}
                  className="w-40 shrink-0 overflow-hidden rounded-xl bg-surface transition-transform duration-150 ease-out active:scale-[0.96] sm:w-48"
                >
                  <div className="relative aspect-[3/4]">
                    <Photo
                      src={p.photos[0]}
                      alt={p.displayName}
                      name={p.displayName}
                      className="absolute inset-0 size-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg/90 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="font-display text-lg leading-tight">{p.displayName}</p>
                      <p className="text-[11px] text-muted">
                        {[p.identities[0], p.ethnicity, age, p.role].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs tracking-[0.28em] text-subtle uppercase">How it works</p>
            <h2 className="mt-2 font-display text-5xl leading-tight">
              Nearby like a grid.
              <br />
              Honest like a profile.
            </h2>
            <ul className="mt-8 space-y-6">
              {[
                {
                  title: "Discover",
                  body: "People near you — sissies, T-girls, bulls, wives, cucks, couples, groups — with top, bottom, or switch on the card.",
                },
                {
                  title: "Like & match",
                  body: "Likes and matches save to your account. Mutual likes light up. Then you talk.",
                },
                {
                  title: "Talk",
                  body: "Private chat, no paywalls. Seed profiles write back in character. Be decent in the DMs.",
                },
              ].map((item) => (
                <li key={item.title}>
                  <p className="text-sm font-medium tracking-wide text-accent uppercase">{item.title}</p>
                  <p className="mt-1 text-muted">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <img src={HERO_STREET} alt="" className="h-72 w-full rounded-xl object-cover sm:h-96" />
            <img
              src={HERO_LOCKER}
              alt=""
              className="mt-10 h-72 w-full rounded-xl object-cover sm:h-96"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <Logo markClassName="size-9" wordClassName="text-3xl" />
          <p className="text-xs text-subtle">18+ only. Dating, not a marketplace. Be kind in the DMs.</p>
        </div>
      </footer>
    </div>
  );
}
