import { Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Heart, MessageCircle, Newspaper, UserRound } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readLocalSession } from "@/lib/local-session";
import { fetchMyProfile } from "@/lib/profile-api";
import { fetchConversations } from "@/lib/messages-api";
import { cn } from "@/lib/utils";
import { Logo, Mark } from "./logo";
import { Avatar } from "./photo";

const NAV = [
  { to: "/discover", label: "Order", icon: Compass },
  { to: "/feed", label: "Room", icon: Newspaper },
  { to: "/likes", label: "Claimed", icon: Heart },
  { to: "/inbox", label: "DMs", icon: MessageCircle },
  { to: "/me", label: "Me", icon: UserRound },
] as const;

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inThread = /^\/inbox\/[^/]+$/.test(pathname);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMyProfile(),
    enabled: Boolean(user),
    retry: 1,
  });
  const inbox = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await fetchConversations()).conversations,
    enabled: Boolean(user) && Boolean(me.data?.onboarded || readLocalSession()?.onboarded),
  });

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Mark className="size-14 animate-pulse" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  const locallyOnboarded = Boolean(readLocalSession()?.onboarded);
  if (me.isPending && !locallyOnboarded && !me.data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Mark className="size-14 animate-pulse" />
      </div>
    );
  }
  if (!locallyOnboarded && !me.data?.onboarded) {
    return <Navigate to="/onboarding" />;
  }

  const unread = (inbox.data ?? []).reduce((n, c) => n + c.unread, 0);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-0.5 bg-accent" />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border px-4 py-7 lg:flex">
        <Link
          to="/discover"
          className="mb-10 px-2 transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          <Logo markClassName="size-10" wordClassName="text-3xl" />
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
          <Avatar src={me.data?.photos[0]} name={me.data?.displayName ?? user.displayName ?? "You"} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{me.data?.displayName ?? "You"}</p>
            <p className="truncate text-xs text-subtle">{me.data ? `@${me.data.handle}` : "Complete profile"}</p>
          </div>
        </Link>
      </aside>

      <div className="lg:pl-64">
        <header
          className={cn(
            "sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-md lg:hidden",
            inThread && "hidden",
          )}
        >
          <Link to="/discover" className="transition-transform duration-150 ease-out active:scale-[0.96]">
            <Logo markClassName="size-8" wordClassName="text-[1.65rem]" />
          </Link>
          <Link to="/me" className="transition-transform duration-150 ease-out active:scale-[0.96]">
            <Avatar src={me.data?.photos[0]} name={me.data?.displayName ?? "You"} size="sm" />
          </Link>
        </header>
        <main
          className={cn(
            "mx-auto min-h-[calc(100dvh-7.5rem)] w-full max-w-5xl px-4 pb-24 pt-4 lg:min-h-dvh lg:px-8 lg:pb-10 lg:pt-8",
            inThread && "min-h-dvh px-0 pb-0 pt-0 lg:px-8 lg:pt-8",
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
