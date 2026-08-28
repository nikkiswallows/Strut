import { Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Heart, MessageCircle, Newspaper, Trophy, UserRound } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useMembership } from "@/lib/auth/use-membership";
import { fetchConversations } from "@/lib/messages-api";
import { cn } from "@/lib/utils";
import { Logo, Mark } from "./logo";
import { Avatar } from "./photo";

const NAV = [
  { to: "/discover", label: "Deck", icon: Compass },
  { to: "/feed", label: "Room", icon: Newspaper },
  { to: "/likes", label: "Claimed", icon: Heart },
  { to: "/glory", label: "Glory", icon: Trophy },
  { to: "/inbox", label: "DMs", icon: MessageCircle },
  { to: "/me", label: "Me", icon: UserRound },
] as const;

export function AppShell() {
  const { phase, user, profile } = useMembership();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inThread = /^\/inbox\/[^/]+$/.test(pathname);

  const inbox = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await fetchConversations()).conversations,
    enabled: phase === "member",
  });

  if (phase === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Mark className="size-14 animate-pulse" />
      </div>
    );
  }
  if (phase === "guest") return <RedirectToSignIn />;
  if (phase === "needs-profile") return <Navigate to="/onboarding" />;

  const unread = (inbox.data ?? []).reduce((n, c) => n + c.unread, 0);
  const displayName = profile?.displayName || user?.displayName || "";

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-0.5 bg-accent" />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border px-4 py-7 lg:flex">
        <Link
          to="/discover"
          className="mb-10 px-2 transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          <Logo markClassName="size-10" wordClassName="text-3xl" />
          <p className="mt-2 px-1 text-[10px] tracking-[0.22em] text-accent uppercase">
            Black first · Kneel
          </p>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-lg px-3 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                  active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-5", active && "text-accent")} />
                  {item.to === "/inbox" && unread > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-accent text-[9px] font-semibold text-accent-fg">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          to="/me"
          className="mt-auto flex items-center gap-3 rounded-lg px-2 py-2 transition-[transform,background-color] duration-150 ease-out hover:bg-elevated active:scale-[0.96]"
        >
          <Avatar src={profile?.photos[0]} name={displayName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName || `@${profile?.handle}`}</p>
            <p className="truncate text-xs text-subtle">{profile ? `@${profile.handle}` : "Complete profile"}</p>
          </div>
        </Link>
      </aside>

      <div className="lg:pl-64">
        <header
          className={cn(
            "sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur-md lg:hidden",
            inThread && "hidden",
          )}
        >
          <Link to="/discover" className="transition-transform duration-150 ease-out active:scale-[0.96]">
            <Logo markClassName="size-8" wordClassName="text-[1.65rem]" />
          </Link>
          <Link to="/me" className="transition-transform duration-150 ease-out active:scale-[0.96]">
            <Avatar src={profile?.photos[0]} name={displayName} size="sm" />
          </Link>
        </header>
        <main
          className={cn(
            "mx-auto w-full max-w-5xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 lg:min-h-dvh lg:px-8 lg:pb-10 lg:pt-8",
            !inThread && "min-h-[calc(100dvh-3.5rem)]",
            inThread && "min-h-dvh px-0 pb-0 pt-0 lg:min-h-dvh lg:px-8 lg:pt-8",
          )}
        >
          <Outlet />
        </main>
      </div>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-bg/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md lg:hidden",
          inThread && "hidden",
        )}
      >
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] tracking-wide uppercase transition-[transform,color] duration-150 ease-out active:scale-[0.96]",
                active ? "text-fg" : "text-subtle",
              )}
            >
              <span className="relative">
                <Icon className={cn("size-5", active && "text-accent")} />
                {item.to === "/inbox" && unread > 0 ? (
                  <span className="absolute -top-1 -right-2 grid size-3.5 place-items-center rounded-full bg-accent text-[8px] font-semibold text-accent-fg">
                    {unread > 9 ? "9" : unread}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
