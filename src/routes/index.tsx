import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { HERO_PHOTO, HERO_STREET, STARTER_LOOKS } from "@/lib/seed-data";
import { listFeatured } from "@/lib/server/profiles";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const featured = useQuery({ queryKey: ["featured"], queryFn: () => listFeatured() });

  if (!isPending && user) return <Navigate to="/discover" />;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 lg:px-10">
        <Logo />
        <Link to="/login" className="text-sm text-muted transition-colors hover:text-fg">
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
        <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-end px-6 pb-16 pt-28">
          <p className="text-xs tracking-[0.28em] text-accent uppercase">
            Dating, on your terms
          </p>
          <h1 className="mt-3 font-display text-6xl leading-[0.9] text-fg sm:text-7xl lg:text-8xl">
            Walk in.
            <br />
            Be seen.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            Strut is where tgirls, sissies, and trans women meet — for dates,
            nights out, and the kind of attention that actually lands.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/login" search={{ mode: "join" }}>
              <Button size="lg" className="h-14 w-full text-base sm:w-auto">
                Continue with phone
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
            <p className="text-xs tracking-[0.22em] text-subtle uppercase">Nearby tonight</p>
            <h2 className="mt-1 font-display text-4xl">The room is already full.</h2>
          </div>
          <div className="hide-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
            {(featured.data ?? []).map((p) => (
              <Link
                key={p.userId}
                to="/login"
                search={{ mode: "join" }}
                className="w-40 shrink-0 overflow-hidden rounded-xl bg-surface sm:w-48"
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
                      {p.age} · {p.location?.split(",")[0]}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs tracking-[0.22em] text-subtle uppercase">How it works</p>
            <h2 className="mt-2 font-display text-4xl leading-tight">
              Grid like Grindr.
              <br />
              Feed like a diary.
            </h2>
            <ul className="mt-8 space-y-6">
              {[
                {
                  title: "Discover",
                  body: "A photo grid of people near you. Like who you like. Match when it is mutual.",
                },
                {
                  title: "Post",
                  body: "Share a look, a night, a thought. Follow the people whose taste you trust.",
                },
                {
                  title: "Talk",
                  body: "Matches open a private chat. No paywalls. No boosts. Just the conversation.",
                },
              ].map((item) => (
                <li key={item.title}>
                  <p className="text-sm font-medium tracking-wide text-accent uppercase">
                    {item.title}
                  </p>
                  <p className="mt-1 text-muted">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <img
              src={HERO_STREET}
              alt=""
              className="h-72 w-full rounded-xl object-cover sm:h-96"
            />
            <img
              src={STARTER_LOOKS[2]}
              alt=""
              className="mt-10 h-72 w-full rounded-xl object-cover sm:h-96"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <Logo />
          <p className="text-xs text-subtle">
            18+ only. Dating, not a marketplace. Be kind in the DMs.
          </p>
        </div>
      </footer>
    </div>
  );
}
