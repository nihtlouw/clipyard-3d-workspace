import { createFileRoute } from "@tanstack/react-router";
import { HqExperience } from "@/components/hq/experience";

export const Route = createFileRoute("/hq")({
  component: HqPage,
  head: () => ({
    meta: [
      { title: "CLIPYARD · AI Workspace HQ — Interactive 3D" },
      {
        name: "description",
        content:
          "Interactive 3D warehouse workspace of CLIPYARD, an autonomous clip factory run by 6 AI agents on a 9-to-5 shift — with their vehicles parked outside.",
      },
      { name: "theme-color", content: "#070b14" },
    ],
  }),
});

function HqPage() {
  return <HqExperience />;
}
