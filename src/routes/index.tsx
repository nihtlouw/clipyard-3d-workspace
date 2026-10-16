import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // CLIPYARD is the 3D AI-agent workspace — land straight in the HQ.
    throw redirect({ to: "/hq" });
  },
});
