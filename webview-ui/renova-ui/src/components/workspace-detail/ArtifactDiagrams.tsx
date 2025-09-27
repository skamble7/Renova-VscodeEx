/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import Mermaid from "@/components/diagrams/Mermaid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DiagramInstance } from "@/stores/useRenovaStore";
import { ZoomIn, ZoomOut, RefreshCw, ExternalLink } from "lucide-react";
import { callHost } from "@/lib/host";

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

    if (!views.includes(activeView) && views.length) {
        setActiveView(views[0]);
    }

    const arr = byView.get(activeView) ?? [];

    const handleOpenInNewTab = async () => {
        try {
            const svgs = await renderMermaidSvgs(arr);
            const title = `Diagram: ${activeView}${svgs.length > 1 ? ` (${svgs.length})` : ""}`;
            await callHost<{ ok: boolean }>({
                type: "diagram:openSvg",
                payload: { title, svgs },
            } as any);
        } catch (e) {
            console.error("Failed to open diagram in new tab:", e);
        }
    };

    return (
        <div className="flex flex-col gap-2 h-full">
            {/* Compact header: badges + toolbar in one row */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                    {views.map((v) => {
                        const active = v === activeView;
                        return (
                            <button
                                key={v}
                                onClick={() => setActiveView(v)}
                                className="focus:outline-none"
                                title={`Show ${v} diagram`}
                            >
                                <Badge
                                    variant={active ? "default" : "outline"}
                                    className="cursor-pointer capitalize h-6 px-2"
                                >
                                    {v}
                                </Badge>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => zoom("out")} title="Zoom out">
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => zoom("in")} title="Zoom in">
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => zoom("reset")} title="Reset zoom">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    {/* NEW: open in VS Code tab (replaces duplicate refresh) */}
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={handleOpenInNewTab}
                        title="Open in new tab"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-3">
                {arr.map((d, i) => {
                    const id = keyOf(d, i);
                    const hints = d.renderer_hints ?? {};
                    const fontSize = typeof hints.fontSize === "number" ? hints.fontSize : 14;
                    const theme = (hints.theme as any) ?? "dark";
                    return (
                        <div
                            key={id}
                            className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-2 overflow-auto"
                        >
                            <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">
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

/** Client-side renderer for exporting one or many Mermaid diagrams to SVG strings. */
async function renderMermaidSvgs(diagrams: DiagramInstance[]): Promise<string[]> {
    const mermaid = (await import("mermaid")).default;
    const svgs: string[] = [];
    let i = 0;
    for (const d of diagrams) {
        const hints = d.renderer_hints ?? {};
        const fontSize = typeof hints.fontSize === "number" ? hints.fontSize : 14;
        const theme = (hints.theme as any) ?? "dark";
        const code = normalizeDiagramText(d.instructions);

        mermaid.initialize({
            startOnLoad: false,
            theme,
            securityLevel: "strict",
            fontSize,
            flowchart: { useMaxWidth: true, htmlLabels: false },
            wrap: hints.wrap === true,
            sequence: { mirrorActors: false },
        });

        const { svg } = await mermaid.render(`mmd_export_${Date.now()}_${i++}`, code);
        svgs.push(svg);
    }
    return svgs;
}
