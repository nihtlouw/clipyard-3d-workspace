import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import { initFloorFeed } from "@/lib/hq-floor";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#070b14" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  // The floor feed is app-wide (Fase 6): dashboard pages read the same live
  // store as the 3D studio, so the producer keeps running across routes.
  useEffect(() => {
    initFloorFeed();
  }, []);
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}
