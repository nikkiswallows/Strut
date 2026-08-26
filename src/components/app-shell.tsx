import { Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  Heart,
  MessageCircle,
  Newspaper,
  UserRound,
} from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile } from "@/lib/server/profiles";
import { listConversations } from "@/lib/server/messages";
import { cn } from "@/lib/utils";
import { Logo, Mark } from "./logo";
import { Avatar } from "./photo";

const NAV = [
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/feed", label: "Feed", icon: Newspaper },
  { to: "/likes", label: "Likes", icon: Heart },
  { to: "/inbox", label: "Inbox", icon: MessageCircle },
  { to: "/me", label: "Me", icon: UserRound },
] as const;

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });
  const inbox = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
    enabled: Boolean(user) && Boolean(me.data?.onboarded),
  });

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Mark className="size-10 animate-pulse" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (me.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Mark className="size-10 animate-pulse" />
      </div>
    );
  }
  if (!me.data?.onboarded) {
    return <Navigate to="/onboarding" />;
  }

  const unread = (inbox.data ?? []).reduce((n, c) => n + c.unread, 0);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-border px-4 py-6 lg:flex">
        <Link to="/discover" className="mb-8 px-2">
          <Logo />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
                  active
                    ? "bg-elevated text-fg"
                    : "text-muted hover:bg-elevated/60 hover:text-fg",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" />
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
          className="mt-auto flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-elevated"
        >
          <Avatar
            src={me.data?.photos[0]}
            name={me.data?.displayName ?? user.displayName ?? "You"}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {me.data?.displayName ?? "You"}
            </p>
            <p className="truncate text-xs text-subtle">
              {me.data ? `@${me.data.handle}` : "Complete profile"}
            </p>
          </div>
        </Link>
      </aside>

      <div className="lg:pl-56">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <Link to="/discover">
            <Logo markClassName="size-6" className="text-[1.15rem]" />
          </Link>
          <Link to="/me">
            <Avatar
              src={me.data?.photos[0]}
              name={me.data?.displayName ?? "You"}
              size="sm"
            />
          </Link>
        </header>
        <main className="mx-auto min-h-[calc(100dvh-7.5rem)] w-full max-w-5xl px-4 pb-24 pt-4 lg:min-h-dvh lg:px-8 lg:pb-10 lg:pt-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-bg/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md lg:hidden">
        {NAV.map((item) => {
          const active =
            pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] tracking-wide uppercase",
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
