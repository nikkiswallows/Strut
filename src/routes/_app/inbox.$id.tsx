import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { botStatus, fetchThread, openConversationStream, postBotReply, postSendChat } from "@/lib/messages-api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/inbox/$id")({ component: Thread });

function Thread() {
  const { id } = Route.useParams();
  const convId = Number(id);
  const [body, setBody] = useState("");
  const [waitingBot, setWaitingBot] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const thread = useQuery({
    queryKey: ["conversation", convId],
    queryFn: async () => (await fetchThread(convId)).thread,
    enabled: Number.isFinite(convId),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.data?.messages.length, thread.isFetching, waitingBot]);

  useEffect(() => {
    if (!Number.isFinite(convId)) return;
    const stream = openConversationStream(convId, () => {
      void queryClient.invalidateQueries({ queryKey: ["conversation", convId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
    return () => stream.close();
  }, [convId]);

  useEffect(() => {
    if (!waitingBot) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const r = await botStatus(convId);
        if (cancelled) return;
        if (r.status === "ready") {
          setWaitingBot(false);
          await queryClient.invalidateQueries({ queryKey: ["conversation", convId] });
          await queryClient.invalidateQueries({ queryKey: ["conversations"] });
          return;
        }
      } catch {
        // transient
      }
      if (cancelled) return;
      if (tries >= 24) {
        setWaitingBot(false);
        return;
      }
      timer = setTimeout(tick, 5000);
    };
    let timer = setTimeout(tick, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [waitingBot, convId]);

  const isSeedThread = thread.data?.other.isSeed === true;
  useEffect(() => {
    if (!isSeedThread) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await botStatus(convId);
        if (!cancelled && r.status === "pending") setWaitingBot(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convId, isSeedThread]);

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      setBody("");
      const sent = await postSendChat(convId, text);
      await queryClient.invalidateQueries({ queryKey: ["conversation", convId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (sent.seed) {
        setWaitingBot(true);
        try {
          const r = await postBotReply(convId);
          if (r.status === "replied") {
            await queryClient.invalidateQueries({ queryKey: ["conversation", convId] });
            await queryClient.invalidateQueries({ queryKey: ["conversations"] });
            setWaitingBot(false);
          }
        } catch {
          setWaitingBot(false);
        }
      }
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
    <div className="flex h-[100dvh] flex-col bg-bg lg:h-[calc(100dvh-5rem)] lg:rounded-2xl lg:border lg:border-border">
      <div className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-3 border-b border-border bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:h-14 lg:pt-0 lg:px-4">
        <Link
          to="/inbox"
          className="grid size-10 place-items-center rounded-full bg-elevated text-muted transition-transform duration-150 active:scale-95 lg:hidden"
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

      <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4 lg:px-4">
        {data.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            On your knees in the DMs. Beg, offer cleanup, say the cage size.
          </p>
        ) : null}
        {data.messages.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed",
                m.mine ? "rounded-br-md bg-accent text-accent-fg" : "rounded-bl-md bg-elevated text-fg",
              )}
            >
              {m.body}
            </p>
          </div>
        ))}
        {waitingBot ? (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-md bg-elevated px-3.5 py-2.5 text-[15px] text-subtle">
              {data.other.displayName} is writing…
            </p>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 flex shrink-0 gap-2 border-t border-border bg-bg px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:rounded-b-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim() && !send.isPending) send.mutate();
        }}
      >
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Serve. Beg. Confess."
          disabled={send.isPending}
          className="text-[16px]"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={!body.trim() || send.isPending} className="h-11 shrink-0 rounded-full px-5">
          {send.isPending ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
