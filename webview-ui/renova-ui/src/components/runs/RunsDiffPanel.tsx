/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { callHost } from "@/lib/host";
import type { LearningRun } from "@/stores/useRenovaStore";
import { type Artifact, computeDiff, kindAndName } from "./utils";

// Lazy Monaco diff (optional)
let MonacoDiff: React.ComponentType<any> | null = null;
(async () => {
  try {
    const mod = await import("@monaco-editor/react");
    MonacoDiff = (mod as any).DiffEditor || (mod as any).default?.DiffEditor || null;
  } catch { MonacoDiff = null; }
})();

type Props = {
  workspaceId: string;
  runs: LearningRun[];
  selectedRunId: string | null;
};

function hashOf(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? null);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export default function RunsDiffPanel({ workspaceId, runs, selectedRunId }: Props) {
  const [leftRunId, setLeftRunId] = useState<string | null>(null);
  const [rightRunId, setRightRunId] = useState<string | null>(null);

  const [leftArtifacts, setLeftArtifacts] = useState<Record<string, Artifact>>({});
  const [rightArtifacts, setRightArtifacts] = useState<Record<string, Artifact>>({});
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [selectedNk, setSelectedNk] = useState<string | null>(null);

  // defaults for sides
  useEffect(() => {
    if (!runs || runs.length === 0) return;
    const right = selectedRunId || runs[0]?.run_id;
    setRightRunId(right);

    // pick an earlier completed run as left if possible
    const earlierCompleted = runs
      .filter((r) => r.status === "completed" && r.run_id !== right)
      .sort((a, b) => (a.run_summary?.started_at ?? "").localeCompare(b.run_summary?.started_at ?? ""))[0]?.run_id || null;

    setLeftRunId(earlierCompleted);
  }, [runs, selectedRunId]);

  // load artifacts for each side
  const loadSide = async (rid: string | null) => {
    if (!rid) return {} as Record<string, Artifact>;
    const run = await callHost<LearningRun>({ type: "runs:get", payload: { runId: rid } });
    const list: Array<any> = Array.isArray((run as any).run_artifacts) ? (run as any).run_artifacts : [];
    const map: Record<string, Artifact> = {};
    for (const a of list) {
      if (!a || !a.kind || !a.name) continue;
      const nk = (a.natural_key as string) || `${String(a.kind)}:${String(a.name)}`.toLowerCase();
      map[nk] = {
        artifact_id: (a as any).artifact_id || "",
        workspace_id: (a as any).workspace_id || "",
        kind: a.kind,
        name: a.name,
        natural_key: nk,
        fingerprint: (a as any).fingerprint || hashOf({ kind: a.kind, name: a.name, data: a.data }),
        data: a.data,
      };
    }
    return map;
  };

  useEffect(() => {
    (async () => {
      setDiffLoading(true);
      setDiffError(null);
      try {
        const [L, R] = await Promise.all([loadSide(leftRunId), loadSide(rightRunId)]);
        setLeftArtifacts(L); setRightArtifacts(R); setSelectedNk(null);
      } catch (e: any) {
        setDiffError(e?.message ?? "Failed to load runs for diff");
      } finally {
        setDiffLoading(false);
      }
    })();
  }, [leftRunId, rightRunId, workspaceId]);

  const derived = useMemo(() => computeDiff(leftArtifacts, rightArtifacts), [leftArtifacts, rightArtifacts]);
  const leftArt = selectedNk ? leftArtifacts[selectedNk] : undefined;
  const rightArt = selectedNk ? rightArtifacts[selectedNk] : undefined;

  const leftJson = useMemo(() => JSON.stringify(leftArt ? { kind: leftArt.kind, name: leftArt.name, fingerprint: leftArt.fingerprint, data: leftArt.data } : {}, null, 2), [leftArt]);
  const rightJson = useMemo(() => JSON.stringify(rightArt ? { kind: rightArt.kind, name: rightArt.name, fingerprint: rightArt.fingerprint, data: rightArt.data } : {}, null, 2), [rightArt]);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60">
      <div className="border-b border-neutral-800 p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-6">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-neutral-400">Left</div>
            <select className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 p-2 text-sm"
              value={leftRunId ?? ""} onChange={(e) => setLeftRunId(e.target.value || null)}>
              <option value="">(none)</option>
              {runs.map((r) => <option key={r.run_id} value={r.run_id}>{r.title || r.run_id}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-neutral-400">Right</div>
            <select className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 p-2 text-sm"
              value={rightRunId ?? ""} onChange={(e) => setRightRunId(e.target.value || null)}>
              <option value="">(none)</option>
              {runs.map((r) => <option key={r.run_id} value={r.run_id}>{r.title || r.run_id}</option>)}
            </select>
          </div>
          <div className="grow" />
          <div className="text-xs text-neutral-400">{diffLoading ? "Computing diff…" : diffError ? <span className="text-red-400">{diffError}</span> : null}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        <div className="border-r border-neutral-800 p-3 md:p-4">
          <div className="text-sm font-medium text-neutral-200 mb-2">Summary</div>
          <Group title={`New (${derived.counts.new})`} rows={derived.groups.new} onRowClick={setSelectedNk} />
          <Group title={`Updated (${derived.counts.updated})`} rows={derived.groups.updated} onRowClick={setSelectedNk} defaultOpen />
          <Group title={`Retired (${derived.counts.retired})`} rows={derived.groups.retired} onRowClick={setSelectedNk} />
          <Group title={`Unchanged (${derived.counts.unchanged})`} rows={derived.groups.unchanged} onRowClick={setSelectedNk} />
        </div>
        <div className="p-3 md:p-4 min-w-0">
          <div className="text-sm font-medium text-neutral-200">Details</div>
          {!selectedNk ? (
            <div className="mt-3 text-sm text-neutral-400">Select an item to view JSON diff.</div>
          ) : MonacoDiff ? (
            <div className="mt-3 rounded-lg border border-neutral-800 overflow-hidden">
              {/* @ts-ignore */}
              <MonacoDiff
                original={leftJson}
                modified={rightJson}
                language="json"
                theme="vs-dark"
                options={{ readOnly: true, renderSideBySide: true, automaticLayout: true, wordWrap: "on" }}
                height="420px"
              />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                <div className="text-xs text-neutral-400 mb-1">Left (JSON)</div>
                <pre className="text-xs overflow-auto max-h-[420px]">{leftJson}</pre>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                <div className="text-xs text-neutral-400 mb-1">Right (JSON)</div>
                <pre className="text-xs overflow-auto max-h-[420px]">{rightJson}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, rows, onRowClick, defaultOpen = false }: { title: string; rows: string[]; onRowClick: (nk: string) => void; defaultOpen?: boolean; }) {
  return (
    <details className="rounded-md border border-neutral-800 bg-neutral-900/50 mb-2" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm text-neutral-200">{title}</summary>
      <ul className="px-2 py-1">
        {rows.length === 0 ? (
          <li className="px-2 py-1 text-xs text-neutral-500">—</li>
        ) : (
          rows.map((nk) => {
            const { kind, name } = kindAndName(nk);
            return (
              <li key={nk} onClick={() => onRowClick(nk)}
                className="px-2 py-1 text-sm hover:bg-neutral-800/70 rounded cursor-pointer flex items-center gap-2"
                title={nk}>
                <span className="rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-[11px] text-neutral-300">{kind}</span>
                <span className="truncate">{name || nk}</span>
              </li>
            );
          })
        )}
      </ul>
    </details>
  );
}
