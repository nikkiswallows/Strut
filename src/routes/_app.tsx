import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_app")({
  component: AppShell,
  // Everything behind the door is members-only: keep it out of the index.
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});
