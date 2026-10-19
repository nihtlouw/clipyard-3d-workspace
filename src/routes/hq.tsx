import { createFileRoute } from "@tanstack/react-router";
import { HqExperience } from "@/components/hq/experience";

export const Route = createFileRoute("/hq")({
  component: HqPage,
  head: () => ({
    meta: [
      { title: "CLIPYARD · AI Studio — Isometric 3D Workspace" },
      {
        name: "description",
        content:
          "Glass-box isometric 3D diorama of CLIPYARD, an autonomous clip factory run by 6 white robot AI agents on a 9-to-5 shift — desk pods, glass meeting room, and a diecast crew garage.",
      },
      { name: "theme-color", content: "#0d1120" },
    ],
  }),
});

function HqPage() {
  return (
    <>
      <div className="fixed inset-0 z-0 bg-[#0d1120]" />
      <HqExperience />
    </>
  );
}
