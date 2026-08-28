import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query-client";
import appCss from "../styles.css?url";

const APP_NAME = "Strut";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Strut — BNWO dating. Black superiority, sissies, whitebois, cuckold, breeding white wives. 18+.",
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
          <Outlet />
          <Toaster
            theme="dark"
            position="top-center"
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
