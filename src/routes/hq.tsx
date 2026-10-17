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
          "Cozy isometric 3D studio of CLIPYARD, an autonomous clip factory run by 6 hoodie AI agents on a 9-to-5 shift — with their diecast fleet on the garage shelf.",
      },
      { name: "theme-color", content: "#eef0fb" },
    ],
  }),
});

function HqPage() {
  return (
    <>
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#eef0fb] via-[#e9ebfa] to-[#e4e7f8]" />
      <HqExperience />
    </>
  );
}
