/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// webview-ui/renova-ui/src/components/workspace-detail/WorkspaceDetail.tsx
import React, { useEffect, useState } from "react";
import { useRenovaStore } from "@/stores/useRenovaStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArtifactView from "./ArtifactView";
import StartLearningDrawer from "./forms/StartLearningDrawer";
import { Search } from "lucide-react";
import ViewToggle from "@/components/workspace/ViewToggle";
import RunsTab from "@/components/runs/RunsTab";

type TabKey = "overview" | "artifacts" | "conversations" | "runs" | "timeline";

export default function WorkspaceDetail({
  workspaceId,
  onBack,
}: {
  workspaceId: string;
  onBack: () => void;
}) {
  const {
    switchWorkspace,
    wsDoc,
    loading,
    q,
    setQuery,
    view,
    setView,
    filteredArtifacts,
    selectArtifact,
    refreshArtifact,
    selectedArtifactId,
    counts,
  } = useRenovaStore();

  const [learnOpen, setLearnOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("artifacts");

  // Default artifacts view = "list", persisted like WorkspaceLanding's toggle.
  const [viewHydrated, setViewHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("renova:artifacts:view");
      const preferred =
        saved === "list" || saved === "list" ? (saved as "grid" | "list") : "list";
      if (view !== preferred) setView(preferred);
    } catch {
      if (view !== "list") setView("list");
    } finally {
      setViewHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!viewHydrated) return;
    try {
      localStorage.setItem("renova:artifacts:view", view);
    } catch {
      /* ignore */
    }
  }, [view, viewHydrated]);

  const effectiveView = viewHydrated ? view : "list";

  useEffect(() => {
    switchWorkspace(workspaceId);
  }, [workspaceId, switchWorkspace]);

  const list = filteredArtifacts();
  const c = counts();

  const colsClass =
    effectiveView === "grid"
      ? "lg:[grid-template-columns:minmax(0,1fr)_520px]"
      : "lg:[grid-template-columns:420px_minmax(0,1fr)]";

  return (
    <div className="w-screen h-screen flex flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur shrink-0">
        <div className="relative max-w-[1400px] mx-auto px-4 py-1.5 flex items-center">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" onClick={onBack}>
              ← Back
            </Button>
            <div className="text-2xl font-semibold truncate max-w-[40vw]">
              {loading ? "Loading…" : wsDoc?.workspace?.name ?? "Workspace"}
            </div>
          </div>

          {/* Tabs */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList className="mx-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
                <TabsTrigger value="conversations">Conversations</TabsTrigger>
                <TabsTrigger value="runs">Runs</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="ml-auto shrink-0">
            <div className="flex items-center rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden shadow-sm">
              <Button
                variant="ghost"
                className="rounded-none px-4"
                onClick={() => setLearnOpen(true)}
              >
                Learn
              </Button>
            </div>
          </div>
        </div>

        {/* Filters row (Artifacts only) */}
        {tab === "artifacts" && (
          <div className="border-t border-neutral-800">
            <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-3">
              <div className="text-xs text-neutral-400 shrink-0 whitespace-nowrap">
                Artifacts: <span className="text-neutral-200">{c.total}</span>
              </div>
              <div className="flex-1" />
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-500" />
                <Input
                  className="pl-8 w-64"
                  placeholder="Search…"
                  value={q}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {/* Use the same ViewToggle component/look as WorkspaceLanding */}
              <ViewToggle view={effectiveView} onChange={setView} />
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden min-h-0">
        {tab === "runs" ? (
          <div className="flex-1 min-h-0">
            <RunsTab workspaceId={workspaceId} />
          </div>
        ) : tab === "artifacts" ? (
          <div
            className={[
              "max-w-[1400px] mx-auto w-full h-full px-4 py-4 grid grid-cols-1 gap-4 min-h-0",
              colsClass,
            ].join(" ")}
          >
            {/* Left column: artifacts */}
            <div className="h-full overflow-y-auto pr-2 min-h-0">
              {loading && list.length === 0 ? (
                <div className="text-neutral-400 text-sm">Loading artifacts…</div>
              ) : list.length === 0 ? (
                <div className="text-neutral-400 text-sm">
                  No artifacts yet. Start a learning run to generate insights.
                </div>
              ) : effectiveView === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
                  {list.map((a) => {
                    const isSelected = selectedArtifactId === a.artifact_id;
                    return (
                      <div
                        key={a.artifact_id}
                        role="button"
                        tabIndex={0}
                        aria-selected={isSelected}
                        className={[
                          "rounded-2xl border p-4 transition outline-none cursor-pointer",
                          "bg-neutral-900/50 hover:bg-neutral-900",
                          isSelected
                            ? "border-neutral-700 ring-1 ring-neutral-600"
                            : "border-neutral-800",
                        ].join(" ")}
                        onClick={async () => {
                          selectArtifact(a.artifact_id);
                          await refreshArtifact(a.artifact_id);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectArtifact(a.artifact_id);
                            await refreshArtifact(a.artifact_id);
                          }
                        }}
                      >
                        <div className="text-xs uppercase tracking-wide text-neutral-400 truncate">
                          {a.kind}
                        </div>
                        <div className="font-medium truncate mt-0.5">{a.name}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {list.map((a) => {
                    const isSelected = selectedArtifactId === a.artifact_id;
                    return (
                      <div
                        key={a.artifact_id}
                        role="button"
                        tabIndex={0}
                        aria-selected={isSelected}
                        className={[
                          "rounded-xl border px-3 py-2 transition outline-none cursor-pointer",
                          "bg-neutral-900/50 hover:bg-neutral-900",
                          isSelected
                            ? "border-neutral-700 ring-1 ring-neutral-600"
                            : "border-neutral-800",
                        ].join(" ")}
                        onClick={async () => {
                          selectArtifact(a.artifact_id);
                          await refreshArtifact(a.artifact_id);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectArtifact(a.artifact_id);
                            await refreshArtifact(a.artifact_id);
                          }
                        }}
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-400 truncate">
                            {a.kind}
                          </div>
                          <div className="font-medium truncate">{a.name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right column: artifact view */}
            <div className="h-full overflow-auto min-h-0">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 h-full min-h-0">
                <ArtifactView />
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-[1400px] mx-auto w-full h-full px-4 py-4">
            <div className="h-full rounded-2xl border border-neutral-800 bg-neutral-900/50 flex items-center justify-center">
              <div className="text-sm text-neutral-400">
                {tab === "overview" && "Overview is coming soon."}
                {tab === "conversations" && "Conversations will land here."}
                {tab === "timeline" && "Timeline will visualize learning over time."}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      <StartLearningDrawer
        open={learnOpen}
        onOpenChange={setLearnOpen}
        workspaceId={workspaceId}
      />
    </div>
  );
}
