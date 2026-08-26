import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { app } from "@/lib/http";
import type { TagKind } from "@/lib/server/catalog";
import { queryClient } from "@/lib/query-client";
import { cn, unique } from "@/lib/utils";

export function MultiChips({
  label,
  options,
  value,
  onChange,
  kind,
  max = 8,
  hint,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  kind?: TagKind;
  max?: number;
  hint?: string;
}) {
  const shown = unique([...options, ...value]);

  function toggle(opt: string) {
    if (value.some((v) => v.toLowerCase() === opt.toLowerCase())) {
      onChange(value.filter((v) => v.toLowerCase() !== opt.toLowerCase()));
      return;
    }
    if (value.length >= max) {
      toast.error(`Pick up to ${max}.`);
      return;
    }
    onChange(unique([...value, opt]));
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      {hint ? <p className="mb-2 text-xs text-subtle">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {shown.map((opt) => {
          const on = value.some((v) => v.toLowerCase() === opt.toLowerCase());
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                "h-10 rounded-full px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                on ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {kind ? <AddCustom kind={kind} onAdd={(label) => toggle(label)} /> : null}
    </div>
  );
}

export function SingleChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "h-10 rounded-full px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                on ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddCustom({
  kind,
  onAdd,
}: {
  kind: TagKind;
  onAdd: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  async function submit() {
    const label = draft.trim().replace(/\s+/g, " ");
    if (label.length < 2) {
      toast.error("Give it at least two characters.");
      return;
    }
    onAdd(label);
    setDraft("");
    setOpen(false);
    try {
      await app("addTag", { kind, label });
      void queryClient.invalidateQueries({ queryKey: ["tags", kind] });
    } catch {
      // Keep the chip on the profile even if the shared catalog write fails.
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 text-sm text-muted transition-transform duration-150 ease-out hover:text-fg active:scale-[0.96]"
      >
        <Plus className="size-3.5" />
        Custom
      </button>
    );
  }

  return (
    <div className="mt-3 flex gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={kind === "interest" ? "BNWO, Cuckold, BBC…" : "Add your own"}
        autoFocus
        maxLength={28}
        className="h-11 flex-1 rounded-lg border border-border bg-elevated px-3.5 text-base text-fg outline-none placeholder:text-subtle focus:border-accent/70 focus:ring-2 focus:ring-accent/25"
      />
      <button
        type="button"
        onClick={() => void submit()}
        className="h-11 rounded-lg bg-fg px-4 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.96]"
      >
        Add
      </button>
    </div>
  );
}
