import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Kicker, Logo, Wordmark } from "@/components/logo";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { HERO_LOCKER, HERO_PHOTO, HERO_STREET } from "@/lib/seed-data";
import { listFeatured } from "@/lib/server/profiles";
import { shownAge } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

const PILLARS = [
  {
    title: "Black kings",
    body: "Tops. Bulls. The Set. You walk in first. Sissies kneel. Wives open. Husbands watch.",
  },
  {
    title: "Sissies & whitebois",
    body: "Feminize. Serve. Look for a real man. Dress for it. You are not the king in this room.",
  },
  {
    title: "Wives & cucks",
    body: "She takes Black. He stays in the chair. Breeding, QOS, hotwife — said out loud.",
  },
];

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
          className="text-sm tracking-wide text-muted uppercase transition-colors duration-150 hover:text-accent"
        >
          Enter
        </Link>
      </header>

      <section className="relative min-h-[100dvh] overflow-hidden">
        <img
          src={HERO_PHOTO}
          alt=""
          className="absolute inset-0 size-full object-cover object-[center_18%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/25" />
        <div className="spade-veil pointer-events-none absolute inset-0" />
        <Wordmark className="pointer-events-none absolute inset-x-0 top-[16%] text-center text-[20vw] leading-none text-accent/15 sm:text-[16vw]" />
        <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-end px-6 pb-16 pt-28">
          <Kicker>BNWO · 18+ · QOS</Kicker>
          <h1 className="mt-3 font-display text-5xl leading-[0.92] text-fg sm:text-7xl lg:text-8xl">
            Black first.
            <br />
            Kneel second.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
            Strut is BNWO dating. Black superiority. Whiteboi feminization. Cuckold.
            Breeding white wives. Sissies and T-girls who know their place. If you have
            to ask what this room is for, you don't belong in it.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["QOS", "BBC", "Cuck", "Sissy", "Whiteboi", "Breeding"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-accent/40 px-3 py-1 text-[11px] tracking-[0.18em] text-accent uppercase"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/login" search={{ mode: "join" }}>
              <Button size="lg" className="h-14 w-full text-base sm:w-auto">
                Enter the order
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

      <section className="border-t border-border py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 lg:grid-cols-3">
          {PILLARS.map((item) => (
            <div key={item.title} className="border-t border-accent/40 pt-5">
              <p className="font-display text-2xl tracking-wide text-accent uppercase">{item.title}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border py-14">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-6">
            <Kicker>Already serving</Kicker>
            <h2 className="mt-1 font-display text-4xl sm:text-5xl">Kings, sissies, wives, bulls.</h2>
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
                        {[p.identities[0], age, p.role].filter(Boolean).join(" · ")}
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
            <Kicker>How it works</Kicker>
            <h2 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">
              A private club.
              <br />
              A public kink.
            </h2>
            <ul className="mt-8 space-y-6">
              {[
                {
                  title: "Discover",
                  body: "Kings, sissies, whitebois, wives, cuck couples, T-girls — with top, bottom, or switch on the card.",
                },
                {
                  title: "Like & match",
                  body: "Likes save. Mutual likes are a match. Then you talk like you mean the profile.",
                },
                {
                  title: "Serve in the DMs",
                  body: "Private chat. No paywalls. Seed profiles write back in character. Black first. Always.",
                },
              ].map((item) => (
                <li key={item.title}>
                  <p className="text-sm font-medium tracking-[0.22em] text-accent uppercase">{item.title}</p>
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

      <section className="relative overflow-hidden border-t border-border">
        <div className="spade-veil pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center">
          <Kicker>The manifesto</Kicker>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-5xl">
            Black superiority. Whiteboi feminization. Cucking. Breeding.
          </h2>
          <p className="mt-5 text-muted">
            This is not a general dating app. T-girls, sissies, trans women, men who lead,
            women who take it, couples who watch. Queen of spades on the table. Nobody
            here is confused.
          </p>
          <Link to="/login" search={{ mode: "join" }} className="mt-8 inline-block">
            <Button size="lg" className="h-14 px-8 text-base">
              Join Strut
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <Logo markClassName="size-9" wordClassName="text-3xl" />
          <p className="text-xs tracking-wide text-subtle uppercase">
            18+ only · BNWO · QOS · BBC · Cuck · Not a marketplace
          </p>
        </div>
      </footer>
    </div>
  );
}
