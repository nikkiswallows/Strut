import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/photo";
import { listConversations } from "@/lib/server/messages";
import { timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/_app/inbox")({ component: Inbox });

function Inbox() {
  const matches = useMatches();
  const nested = matches.some((m) => m.fullPath.includes("$id"));
  const inbox = useQuery({ queryKey: ["conversations"], queryFn: () => listConversations() });

  return (
    <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
      <div className={nested ? "hidden lg:block" : ""}>
        <div className="px-4 pt-4 lg:px-0 lg:pt-0">
          <h1 className="font-display text-4xl">Inbox</h1>
          <p className="mt-1 text-sm text-muted">Private. They write back. Serve in the DMs.</p>
        </div>
        <div className="mt-5 divide-y divide-border rounded-xl border border-border bg-surface">
          {(inbox.data ?? []).length === 0 && !inbox.isPending ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              No conversations yet. Open a profile and say hi.
            </p>
          ) : null}
          {(inbox.data ?? []).map((c) => (
            <Link
              key={c.id}
              to="/inbox/$id"
              params={{ id: String(c.id) }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-elevated"
            >
              <Avatar src={c.other.photo} name={c.other.displayName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{c.other.displayName}</p>
                  <span className="text-[11px] text-subtle">{timeAgo(c.lastAt)}</span>
                </div>
                <p className="truncate text-sm text-muted">{c.lastBody ?? "Say hello."}</p>
              </div>
              {c.unread > 0 ? (
                <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-fg">
                  {c.unread}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
      <div className={nested ? "block" : "hidden lg:grid lg:place-items-center"}>
        {nested ? <Outlet /> : <p className="text-sm text-subtle">Pick a conversation.</p>}
      </div>
    </div>
  );
}
