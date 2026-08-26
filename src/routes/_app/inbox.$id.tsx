import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getConversation, sendMessage } from "@/lib/server/messages";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/inbox/$id")({ component: Thread });

function Thread() {
  const { id } = Route.useParams();
  const convId = Number(id);
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const thread = useQuery({
    queryKey: ["conversation", convId],
    queryFn: () => getConversation({ data: convId }),
    enabled: Number.isFinite(convId),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.data?.messages.length, thread.isFetching]);

  const send = useMutation({
    mutationFn: () => sendMessage({ data: { conversationId: convId, body } }),
    onSuccess: async () => {
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["conversation", convId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const data = thread.data;
  if (thread.isPending) {
    return <div className="h-80 animate-pulse rounded-xl bg-surface" />;
  }
  if (!data) {
    return <p className="px-4 text-muted">Conversation not found.</p>;
  }

  return (
    <div className="flex h-dvh flex-col lg:h-[calc(100dvh-5rem)]">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 lg:px-0 lg:pb-3 lg:pt-0">
        <Link
          to="/inbox"
          className="grid size-11 place-items-center rounded-lg hover:bg-elevated lg:hidden"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <Link to="/u/$handle" params={{ handle: data.other.handle }} className="flex items-center gap-3">
          <Avatar src={data.other.photo} name={data.other.displayName} />
          <div>
            <p className="font-medium leading-tight">{data.other.displayName}</p>
            <p className="text-xs text-subtle">
              @{data.other.handle}
              {data.other.isSeed ? " · Active now" : ""}
            </p>
          </div>
        </Link>
      </div>
      <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-4 lg:px-0">
        {data.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Say hello. That's the whole first move.</p>
        ) : null}
        {data.messages.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                m.mine ? "rounded-br-md bg-fg text-bg" : "rounded-bl-md bg-elevated text-fg",
              )}
            >
              {m.body}
            </p>
          </div>
        ))}
        {send.isPending ? (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-md bg-elevated px-3.5 py-2 text-sm text-subtle">
              {data.other.displayName} is writing…
            </p>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-0"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim() && !send.isPending) send.mutate();
        }}
      >
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message"
          disabled={send.isPending}
        />
        <Button type="submit" disabled={!body.trim() || send.isPending}>
          {send.isPending ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
