/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { useRenovaStore } from "@/stores/useRenovaStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArtifactDiagrams from "./ArtifactDiagrams";

/**
 * Artifact viewer: now has Data + Diagrams tabs.
 */
export default function ArtifactView() {
  const { artifacts, selectedArtifactId, getKindSchema, refreshArtifact, wsDoc } = useRenovaStore();
  const artifact = useMemo(
    () => artifacts.find((a) => a.artifact_id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  const [schema, setSchema] = useState<any | null>(null);
  const [tab, setTab] = useState<"data" | "diagrams">("data");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setSchema(null);
      if (!artifact?.kind) return;
      const reg = await getKindSchema(artifact.kind);
      if (cancelled) return;
      const latest =
        reg?.schema_versions?.find((v: any) => v.version === reg.latest_schema_version) ??
        reg?.schema_versions?.[0];
      setSchema(latest?.json_schema ?? null);
    }
    run();
    return () => { cancelled = true; };
  }, [artifact?.kind, getKindSchema]);

  useEffect(() => {
    // If diagrams exist, remember last chosen tab per artifact; default to "diagrams" when present?
    if (!artifact) return;
    const key = `renova:artifact:${artifact.artifact_id}:tab`;
    const saved = localStorage.getItem(key) as "data" | "diagrams" | null;
    if (saved) setTab(saved);
    else if (Array.isArray(artifact.diagrams) && artifact.diagrams.length > 0) setTab("diagrams");
    else setTab("data");
  }, [artifact?.artifact_id]);

  useEffect(() => {
    if (!artifact) return;
    const key = `renova:artifact:${artifact.artifact_id}:tab`;
    try { localStorage.setItem(key, tab); } catch { /* ignore */ }
  }, [artifact?.artifact_id, tab]);

  if (!artifact) {
    return <div className="p-4 text-sm text-neutral-400">Select an artifact to view.</div>;
  }

  const handleRefresh = () => refreshArtifact(artifact.artifact_id);
  const hasDiagrams = Array.isArray(artifact.diagrams) && artifact.diagrams.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-neutral-400 truncate">
            {artifact.kind}
          </div>
          <div className="font-medium truncate">{artifact.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRefresh}>Refresh</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="diagrams" disabled={!hasDiagrams}>
              Diagrams{hasDiagrams ? "" : " (none)"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="mt-3">
            <SchemaDrivenRenderer data={artifact.data} schema={schema} />
          </TabsContent>

          <TabsContent value="diagrams" className="mt-3">
            <ArtifactDiagrams diagrams={artifact.diagrams} onRefresh={handleRefresh} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="px-4 py-2 border-t border-neutral-800 text-xs text-neutral-500">
        Workspace: {wsDoc?.workspace?.name ?? "—"}
        {" • "}Version: {String(artifact.version ?? "1")}
        {artifact.diagram_fingerprint ? (
          <>
            {" • "}Diagram fp: <span className="text-neutral-400">{artifact.diagram_fingerprint.substring(0, 10)}…</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Schema-driven fallback (trimmed from Raina) ---------- */

function SchemaDrivenRenderer({ data, schema }: { data: any; schema: any | null }) {
  if (!schema) return <PreFallback title="Preview" data={data} />;
  const type = schema.type ?? inferType(data);
  if (type === "array") return <RenderArray data={Array.isArray(data) ? data : []} />;
  if (type === "object") return <RenderObject data={isPlainObject(data) ? data : {}} />;
  return <PreFallback title="Preview" data={data} />;
}

function RenderArray({ data }: { data: any[] }) {
  const rows = data;
  const first = rows[0];
  const firstProps = isPlainObject(first) ? Object.keys(first) : [];
  const uniform =
    rows.length > 0 &&
    isPlainObject(first) &&
    rows.every((r) => isPlainObject(r) && shallowSameKeys(Object.keys(r), firstProps));

  if (uniform && firstProps.length > 0) {
    return (
      <table className="w-full text-sm">
        <thead className="bg-neutral-950 text-neutral-400">
          <tr>{firstProps.map((h) => (<th key={h} className="text-left p-2">{h}</th>))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-neutral-800">
              {firstProps.map((h) => (<td key={h} className="p-2 align-top">{renderCell(r[h])}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {rows.map((r, i) => (
        <div key={i} className="rounded-xl border border-neutral-800 p-3 bg-neutral-950/50">
          {isPlainObject(r) ? <RenderObject data={r} /> : <code className="text-xs">{String(r)}</code>}
        </div>
      ))}
    </div>
  );
}

function RenderObject({ data }: { data: Record<string, any> }) {
  const order = Object.keys(data);
  const arrayKeys = order.filter((k) => Array.isArray(data[k]));
  const primary = arrayKeys[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {order.filter((k) => !Array.isArray(data[k]) && !isPlainObject(data[k]))
          .map((k) => (<KeyValue key={k} k={k} v={data[k]} />))}
      </div>

      {order.filter((k) => isPlainObject(data[k]))
        .map((k) => (
          <div key={k} className="rounded-xl border border-neutral-800 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-400 mb-2">{k}</div>
            <RenderObject data={data[k]} />
          </div>
        ))}

      {primary && Array.isArray(data[primary]) && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-neutral-400">{primary}</div>
          <div className="rounded-xl border border-neutral-800 overflow-auto">
            <RenderArray data={data[primary]} />
          </div>
        </div>
      )}

      {arrayKeys.filter((k) => k !== primary).map((k) => (
        <div key={k} className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-neutral-400">{k}</div>
          <div className="rounded-xl border border-neutral-800 overflow-auto">
            <RenderArray data={data[k]} />
          </div>
        </div>
      ))}
    </div>
  );
}

function KeyValue({ k, v }: { k: string; v: any }) {
  return (
    <div className="rounded-xl border border-neutral-800 p-3 bg-neutral-950/40">
      <div className="text-xs uppercase tracking-wide text-neutral-400">{k}</div>
      <div className="text-sm mt-0.5">{renderInline(v)}</div>
    </div>
  );
}

/* helpers */
function isPlainObject(v: any) { return v && typeof v === "object" && !Array.isArray(v); }
function shallowSameKeys(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = new Set(a), sb = new Set(b);
  for (const k of sa) if (!sb.has(k)) return false;
  return true;
}
function inferType(v: any): "object" | "array" | "primitive" {
  if (Array.isArray(v)) return "array";
  if (isPlainObject(v)) return "object";
  return "primitive";
}
function safeJSON(data: unknown) { try { return JSON.stringify(data, null, 2); } catch { return String(data); } }
function renderInline(v: any) {
  if (v === null || v === undefined) return <span className="text-neutral-500">—</span>;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return <span>{String(v)}</span>;
  return <code className="text-xs">{safeJSON(v)}</code>;
}
function renderCell(v: any) {
  if (v === null || v === undefined) return <span className="text-neutral-500">—</span>;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return <span className="whitespace-pre-wrap">{String(v)}</span>;
  if (Array.isArray(v)) return <span className="whitespace-pre-wrap">{v.map((x, i) => <span key={i}>{String(x)}{i < v.length - 1 ? ", " : ""}</span>)}</span>;
  if (isPlainObject(v)) return <code className="text-[11px]">{safeJSON(v)}</code>;
  return <span className="whitespace-pre-wrap">{String(v)}</span>;
}

function PreFallback({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-neutral-400">{title}</div>
      <pre className="text-xs bg-neutral-950/60 rounded p-2 overflow-auto">{safeJSON(data)}</pre>
    </div>
  );
}
