import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AgeGate } from "@/components/age-gate";
import { queryClient } from "@/lib/query-client";
import appCss from "../styles.css?url";
import { NAME, DESCRIPTION } from "@/lib/brand";

const APP_NAME = NAME;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { title: `${APP_NAME} — BNWO dating` },
      {
        name: "description",
        content: DESCRIPTION,
      },
      { name: "theme-color", content: "#0a0907" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <QueryClientProvider client={queryClient}>
          <AgeGate />
          <Outlet />
          <Toaster
            theme="dark"
            position="top-center"
            // Standalone PWA: viewport-fit=cover puts the page under the iPhone
            // status bar, so a fixed top toast without a safe-area offset is
            // invisible behind the notch. Both offsets (desktop + mobile) clear it.
            offset={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
            mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
            toastOptions={{
              style: {
                background: "#1c1812",
                color: "#f3ead7",
                border: "1px solid #2c261c",
              },
            }}
          />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
