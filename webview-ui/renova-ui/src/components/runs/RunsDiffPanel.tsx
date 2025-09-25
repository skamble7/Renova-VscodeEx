/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { callHost } from "@/lib/host";
import type { LearningRun } from "@/stores/useRenovaStore";
import type { DiffsByKind, DiffArtifact, ChangedEntry } from "./utils";
import { displayNameFor, normalizeForView } from "./utils";

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

/** Selection model for the right-side diff viewer */
type Selection =
  | { kind_id: string; group: "added" | "removed" | "unchanged"; item: DiffArtifact }
  | { kind_id: string; group: "changed"; item: ChangedEntry };

export default function RunsDiffPanel({ workspaceId, runs, selectedRunId }: Props) {
  const [run, setRun] = useState<LearningRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selection, setSelection] = useState<Selection | null>(null);

  // Load the full run (so we get diffs_by_kind payload reliably)
  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      try {
        if (!selectedRunId) { setRun(null); setSelection(null); return; }
        const full = await callHost<LearningRun>({ type: "runs:get", payload: { runId: selectedRunId } });
        setRun(full || null);
        setSelection(null);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load run");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedRunId, workspaceId]);

  const diffsByKind: DiffsByKind = useMemo(() => (run?.diffs_by_kind ?? {}) as DiffsByKind, [run?.diffs_by_kind]);

  const kinds = useMemo(() => Object.keys(diffsByKind).sort(), [diffsByKind]);

  // derive viewer JSON
  const { leftJson, rightJson } = useMemo(() => {
    if (!selection) return { leftJson: "{}", rightJson: "{}" };

    const kind_id = selection.kind_id;
    if (selection.group === "changed") {
      const before = normalizeForView(kind_id, selection.item.before || null);
      const after  = normalizeForView(kind_id, selection.item.after  || null);
      return {
        leftJson: JSON.stringify(before, null, 2),
        rightJson: JSON.stringify(after,  null, 2),
      };
    }

    if (selection.group === "added") {
      const after = normalizeForView(kind_id, selection.item);
      return { leftJson: "{}", rightJson: JSON.stringify(after, null, 2) };
    }

    if (selection.group === "removed") {
      const before = normalizeForView(kind_id, selection.item);
      return { leftJson: JSON.stringify(before, null, 2), rightJson: "{}" };
    }

    // unchanged: mirror on both sides
    const both = normalizeForView(kind_id, selection.item);
    const s = JSON.stringify(both, null, 2);
    return { leftJson: s, rightJson: s };
  }, [selection]);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60">
      <div className="border-b border-neutral-800 p-3 md:p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-neutral-200">Run Diffs</div>
            <div className="text-xs text-neutral-400">{run?.title || selectedRunId || "—"}</div>
          </div>
          <div className="text-xs text-neutral-400">
            {loading ? "Loading…" : err ? <span className="text-red-400">{err}</span> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* LEFT: Kind → Grouped lists */}
        <div className="border-r border-neutral-800 p-3 md:p-4">
          {kinds.length === 0 ? (
            <div className="text-sm text-neutral-400">No diffs available for this run.</div>
          ) : (
            kinds.map((kind_id) => {
              const g = diffsByKind[kind_id] || {};
              const added = Array.isArray(g.added) ? g.added : [];
              const changed = Array.isArray(g.changed) ? g.changed : [];
              const removed = Array.isArray(g.removed) ? g.removed : [];
              const unchanged = Array.isArray(g.unchanged) ? g.unchanged : [];
              return (
                <KindGroup
                  key={kind_id}
                  kind_id={kind_id}
                  counts={{ added: added.length, changed: changed.length, removed: removed.length, unchanged: unchanged.length }}
                  groups={{ added, changed, removed, unchanged }}
                  onSelect={setSelection}
                />
              );
            })
          )}
        </div>

        {/* RIGHT: JSON Diff Viewer */}
        <div className="p-3 md:p-4 min-w-0">
          <div className="text-sm font-medium text-neutral-200">Details</div>
          {!selection ? (
            <div className="mt-3 text-sm text-neutral-400">Select an item to view the JSON diff.</div>
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

function KindGroup({
  kind_id,
  counts,
  groups,
  onSelect,
}: {
  kind_id: string;
  counts: { added: number; changed: number; removed: number; unchanged: number };
  groups: {
    added: DiffArtifact[];
    changed: ChangedEntry[];
    removed: DiffArtifact[];
    unchanged: DiffArtifact[];
  };
  onSelect: (s: Selection) => void;
}) {
  return (
    <details className="rounded-md border border-neutral-800 bg-neutral-900/50 mb-2" open>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm text-neutral-200 flex items-center justify-between">
        <span className="truncate">{kind_id}</span>
        <span className="text-[11px] text-neutral-400 ml-2">
          +{counts.added} · ~{counts.changed} · −{counts.removed} · ={counts.unchanged}
        </span>
      </summary>

      <div className="px-2 py-2">
        <MiniGroup
          title={`Added (${counts.added})`}
          emptyLabel="—"
          rows={groups.added}
          render={(it) => displayNameFor(kind_id, it)}
          onClick={(it) => onSelect({ kind_id, group: "added", item: it })}
        />

        <MiniGroup
          title={`Changed (${counts.changed})`}
          emptyLabel="—"
          rows={groups.changed}
          render={(pair) => {
            const name = displayNameFor(kind_id, pair.after || pair.before);
            return name || "(changed)";
          }}
          onClick={(pair) => onSelect({ kind_id, group: "changed", item: pair })}
        />

        <MiniGroup
          title={`Removed (${counts.removed})`}
          emptyLabel="—"
          rows={groups.removed}
          render={(it) => displayNameFor(kind_id, it)}
          onClick={(it) => onSelect({ kind_id, group: "removed", item: it })}
        />

        <MiniGroup
          title={`Unchanged (${counts.unchanged})`}
          emptyLabel="—"
          rows={groups.unchanged}
          render={(it) => displayNameFor(kind_id, it)}
          onClick={(it) => onSelect({ kind_id, group: "unchanged", item: it })}
        />
      </div>
    </details>
  );
}

function MiniGroup<T>({
  title,
  emptyLabel,
  rows,
  render,
  onClick,
}: {
  title: string;
  emptyLabel: string;
  rows: T[];
  render: (row: T) => string;
  onClick: (row: T) => void;
}) {
  return (
    <details className="rounded border border-neutral-800 bg-neutral-900/40 mb-2">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-[13px] text-neutral-200">{title}</summary>
      <ul className="px-2 py-1">
        {rows.length === 0 ? (
          <li className="px-2 py-1 text-xs text-neutral-500">{emptyLabel}</li>
        ) : (
          rows.map((row, i) => (
            <li
              key={i}
              onClick={() => onClick(row)}
              className="px-2 py-1 text-sm hover:bg-neutral-800/70 rounded cursor-pointer truncate"
              title={render(row)}
            >
              {render(row)}
            </li>
          ))
        )}
      </ul>
    </details>
  );
}
