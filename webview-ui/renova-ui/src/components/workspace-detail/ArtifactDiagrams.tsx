/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import Mermaid from "@/components/diagrams/Mermaid";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { DiagramInstance } from "@/stores/useRenovaStore";

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

  if (all.length === 0) {
    return (
      <div className="text-sm text-neutral-400">
        No diagrams for this artifact yet.
      </div>
    );
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

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-neutral-400">
          Diagrams ({mermaidDiagrams.length})
        </div>
        {onRefresh && (
          <Button size="sm" variant="outline" onClick={onRefresh}>
            Refresh
          </Button>
        )}
      </div>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v)} className="w-full">
        <TabsList>
          {views.map((v) => (
            <TabsTrigger key={v} value={v}>
              {v}
            </TabsTrigger>
          ))}
        </TabsList>

        {views.map((v) => {
          const arr = byView.get(v) ?? [];
          return (
            <TabsContent key={v} value={v} className="mt-3">
              <div className="space-y-4">
                {arr.map((d, i) => {
                  const id = keyOf(d, i);
                  const hints = d.renderer_hints ?? {};
                  const fontSize =
                    typeof hints.fontSize === "number" ? hints.fontSize : 14;
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
                        code={normalizeMindmap(d.instructions)}
                        theme={theme}
                        fontSize={fontSize}
                        config={{
                          // pass-through helpful toggles
                          wrap: hints.wrap === true,
                          sequence: { mirrorActors: false },
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

/**
 * Safety: the sample uses mindmap with identifiers like MAIN_PARA without code fences.
 * Mermaid expects *just* the diagram text. We ensure it’s trimmed and unchanged.
 */
function normalizeMindmap(src: string) {
  // If user pasted ```mermaid fences, strip them.
  const t = (src ?? "").trim();
  if (t.startsWith("```")) {
    const m = t.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
    return (m?.[1] ?? t).trim();
  }
  return t;
}
