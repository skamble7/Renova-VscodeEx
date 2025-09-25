/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { useRenovaStore } from "@/stores/useRenovaStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import RunListItem from "./RunListItem";
import RunsDiffPanel from "./RunsDiffPanel";
import StepTracker from "./StepTracker";

type Props = { workspaceId: string };

export default function RunsTab({ workspaceId }: Props) {
  const { runs, loadRuns, deleteRun, refreshRun, startRun, selectedRunId, selectRun, applyStepEvent } = useRenovaStore();

  const [q, setQ] = useState("");
  const [showStart, setShowStart] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [startJson, setStartJson] = useState<string>(() =>
    JSON.stringify(
      {
        playbook_id: "pb.micro.plus",
        inputs: {
          avc: { vision: [], problem_statements: [], goals: [] },
          fss: { stories: [] },
          pss: { paradigm: "", style: [], tech_stack: [] },
        },
        options: { model: "openai:gpt-4o-mini", dry_run: false },
        title: "New learning run",
        description: "Triggered from Renova",
      },
      null,
      2
    )
  );

  useEffect(() => { loadRuns(); }, [loadRuns]);

  useEffect(() => {
    if (!selectedRunId && runs.length > 0) selectRun(runs[0].run_id);
  }, [runs, selectedRunId, selectRun]);

  // Sync with notifications: refresh runs on lifecycle and pipe step events into store
  useEffect(() => {
    const onMsg = (e: MessageEvent<any>) => {
      const { type, payload } = e.data ?? {};
      if (!payload) return;

      if (type === "runs:step") {
        // payload is evt.data already; store handles shapes
        applyStepEvent(payload);
        return;
      }

      if (type === "runs:event") {
        const rid: string | undefined = payload?.data?.run_id || payload?.run_id;
        const ev: string | undefined = payload?.data?.event || payload?.event || payload?.type;
        if (!rid || !ev) return;

        if (
          ev === "learning.run.started" ||
          ev === "learning.run.completed" ||
          ev === "learning.run.completed.interim" ||
          ev === "learning.run.failed"
        ) {
          refreshRun(rid);
        }
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [applyStepEvent, refreshRun]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return runs;
    return runs.filter((r) => {
      const title = (r.title || r.run_id).toLowerCase();
      const desc = (r.description || "").toLowerCase();
      const hay = `${title} ${desc} ${r.playbook_id} ${r.status}`;
      return hay.includes(needle);
    });
  }, [q, runs]);

  return (
    <div className="h-full w-full relative">
      <div className="grid h-full" style={{ gridTemplateColumns: collapsed ? "0px minmax(0,1fr)" : "360px minmax(0,1fr)" }}>
        {/* LEFT: runs list */}
        <div className={["bg-neutral-950/60", collapsed ? "" : "border-r border-neutral-800"].join(" ")}>
          {!collapsed && (
            <>
              <div className="p-3 flex items-center gap-2">
                <Input placeholder="Search runs…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full" />
                <Button onClick={() => loadRuns()}>Refresh</Button>
                <Button variant="secondary" onClick={() => setShowStart((s) => !s)}>Start</Button>
                <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} title="Collapse runs">
                  <ChevronLeft size={18} />
                </Button>
              </div>

              {showStart && (
                <div className="mx-3 mb-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-neutral-200">Start a new learning run</div>
                    <Button size="sm" variant="ghost" onClick={() => setShowStart(false)}>Close</Button>
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">
                    This JSON is sent to the learning service (<code className="font-mono">workspace_id</code> will be filled in automatically).
                  </p>
                  <textarea
                    className="mt-2 w-full min-h-40 rounded-md border border-neutral-700 bg-neutral-900 p-2 font-mono text-sm"
                    value={startJson}
                    onChange={(e) => setStartJson(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      onClick={async () => {
                        try {
                          const body = JSON.parse(startJson);
                          if (body && "workspace_id" in body) delete body.workspace_id;
                          const runId = await startRun(body);
                          if (runId) {
                            await refreshRun(runId);
                            setShowStart(false);
                            selectRun(runId);
                          }
                        } catch {
                          // optional toast
                        }
                      }}
                    >
                      Start
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-auto pb-3">
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-neutral-400 text-sm">
                    {q ? "No runs match your search." : "No runs yet. Start one to see it here."}
                  </div>
                ) : (
                  <ul className="px-2">
                    {filtered.map((r) => (
                      <RunListItem
                        key={r.run_id}
                        run={r}
                        selected={r.run_id === selectedRunId}
                        onSelect={(id) => { selectRun(id); refreshRun(id); }}
                        onRefresh={refreshRun}
                        onDelete={deleteRun}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: step tracker + diff panel */}
        <div className={`relative min-w-0 overflow-auto p-4 ${collapsed ? "pl-12" : ""}`}>
          {collapsed && (
            <div className="absolute left-2 top-2 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(false)}
                title="Expand runs"
                className="rounded-full border border-neutral-700 bg-neutral-900/70 hover:bg-neutral-900"
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          )}

          <StepTracker runId={selectedRunId ?? null} className="mb-4" />

          <RunsDiffPanel workspaceId={workspaceId} runs={runs} selectedRunId={selectedRunId ?? null} />
        </div>
      </div>
    </div>
  );
}
