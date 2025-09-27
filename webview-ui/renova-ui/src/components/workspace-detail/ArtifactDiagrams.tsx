/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import Mermaid from "@/components/diagrams/Mermaid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DiagramInstance } from "@/stores/useRenovaStore";
import { ZoomIn, ZoomOut, RefreshCw } from "lucide-react";

function keyOf(d: DiagramInstance, idx: number) {
  return `${d.language}:${d.view ?? "default"}:${idx}`;
}

export default function ArtifactDiagrams({
  diagrams,
  onRefresh,
}: {
  diagrams: DiagramInstance[] | undefined;
  onRefresh?: () => void;
}) {
  const all = Array.isArray(diagrams) ? diagrams : [];
  const mermaidDiagrams = all.filter((d) => (d.language ?? "mermaid").toLowerCase() === "mermaid");

  const initial = useMemo(() => {
    const preferredOrder = ["sequence", "flowchart", "mindmap"];
    const firstPreferred = mermaidDiagrams.find((d) => d.view && preferredOrder.includes(d.view));
    return (firstPreferred?.view ?? mermaidDiagrams[0]?.view ?? "diagram") as string;
  }, [mermaidDiagrams]);

  const [activeView, setActiveView] = useState<string>(initial);
  const [scale, setScale] = useState<number>(1);

  const zoom = (dir: "in" | "out" | "reset") => {
    if (dir === "reset") return setScale(1);
    setScale((s) => {
      const next = dir === "in" ? s + 0.1 : s - 0.1;
      return Math.min(3, Math.max(0.25, Number(next.toFixed(2))));
    });
  };

  if (all.length === 0) {
    return <div className="text-sm text-neutral-400">No diagrams for this artifact yet.</div>;
  }

  if (mermaidDiagrams.length === 0) {
    return (
      <div className="text-sm text-neutral-400">
        This artifact has diagrams, but none in Mermaid language (renderer currently supports Mermaid).
      </div>
    );
  }

  const byView = new Map<string, DiagramInstance[]>();
  for (const d of mermaidDiagrams) {
    const v = (d.view ?? "diagram").toLowerCase();
    const arr = byView.get(v) ?? [];
    arr.push(d);
    byView.set(v, arr);
  }
  const views = Array.from(byView.keys());

  // Ensure activeView is valid even if list changed
  if (!views.includes(activeView) && views.length) {
    setActiveView(views[0]);
  }

  const arr = byView.get(activeView) ?? [];

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-neutral-400">
          Diagrams ({mermaidDiagrams.length})
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => zoom("out")} title="Zoom out (−)">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="px-2 text-xs tabular-nums w-[52px] text-center">{Math.round(scale * 100)}%</div>
          <Button size="icon" variant="outline" onClick={() => zoom("in")} title="Zoom in (+)">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => zoom("reset")} title="Reset zoom">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onRefresh && (
            <Button size="sm" variant="outline" className="ml-2" onClick={onRefresh}>
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* View badges (compact) */}
      <div className="flex items-center gap-2 flex-wrap">
        {views.map((v) => {
          const active = v === activeView;
          return (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className="focus:outline-none"
            >
              <Badge variant={active ? "default" : "outline"} className="cursor-pointer capitalize">
                {v}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {arr.map((d, i) => {
          const id = keyOf(d, i);
          const hints = d.renderer_hints ?? {};
          const fontSize = typeof hints.fontSize === "number" ? hints.fontSize : 14;
          const theme = (hints.theme as any) ?? "dark";
          return (
            <div
              key={id}
              className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3 overflow-auto"
            >
              <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">
                {d.view ?? "diagram"} • {d.language}
              </div>
              <Mermaid
                code={normalizeDiagramText(d.instructions)}
                theme={theme}
                fontSize={fontSize}
                scale={scale}
                config={{
                  wrap: hints.wrap === true,
                  sequence: { mirrorActors: false },
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Strip ``` fences if present; return pure Mermaid text. */
function normalizeDiagramText(src: string) {
  const t = (src ?? "").trim();
  if (t.startsWith("```")) {
    const m = t.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
    return (m?.[1] ?? t).trim();
  }
  return t;
}
