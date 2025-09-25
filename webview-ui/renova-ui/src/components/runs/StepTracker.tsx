/* eslint-disable no-empty */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleDot, Circle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useRenovaStore } from "@/stores/useRenovaStore";
import { callHost } from "@/lib/host";

type Props = {
    runId: string | null;
    className?: string;
    collapsible?: boolean;
};

type StepStatus = "pending" | "started" | "completed" | "failed";

function StatusIcon({ s }: { s: StepStatus }) {
    const cls = "inline-block";
    switch (s) {
        case "completed": return <CheckCircle2 className={cls} size={16} />;
        case "failed": return <XCircle className={cls} size={16} />;
        case "started": return <CircleDot className={cls} size={16} />;
        default: return <Circle className={cls} size={16} />;
    }
}

function derivePackFromRun(run: any): { key?: string; version?: string } {
    const pk = run?.options?.pack_key ?? run?.provenance?.pack_key;
    const pv = run?.options?.pack_version ?? run?.provenance?.pack_version;
    return { key: pk, version: pv };
}

export default function StepTracker({ runId, className, collapsible = true }: Props) {
    const run = useRenovaStore((s) => (runId ? s.runs.find((r) => r.run_id === runId) : undefined));
    const seed = useRenovaStore((s) => s.seedLiveSteps);
    const defaults = useRenovaStore((s) => s.capabilityDefaults);

    const [pbId, setPbId] = useState<string | null>(null);
    const [pack, setPack] = useState<{ key: string; version: string } | null>(null);

    // cancellation flags
    const resolveCancelledRef = useRef(false);
    const seedCancelledRef = useRef(false);

    // Resolve playbook + pack for the run (may need a full runs:get)
    useEffect(() => {
        resolveCancelledRef.current = false;

        (async () => {
            if (!runId) {
                if (!resolveCancelledRef.current) {
                    setPbId(null);
                    setPack(null);
                }
                return;
            }

            try {
                let pb = run?.playbook_id ?? null;
                let d = derivePackFromRun(run);

                if (!pb || !d.key || !d.version) {
                    const full = await callHost<any>({ type: "runs:get", payload: { runId } });
                    if (resolveCancelledRef.current) return;

                    pb = pb || full?.playbook_id || null;
                    const f = derivePackFromRun(full);
                    d = { key: d.key ?? f.key, version: d.version ?? f.version };
                }

                const finalKey = d.key ?? defaults.pack_key ?? null;
                const finalVer = d.version ?? defaults.pack_version ?? null;

                if (!resolveCancelledRef.current) {
                    setPbId(pb);
                    setPack(finalKey && finalVer ? { key: finalKey, version: finalVer } : null);
                }
            } catch {
                if (resolveCancelledRef.current) return;

                setPbId(run?.playbook_id ?? null);
                const d = derivePackFromRun(run);
                const finalKey = d.key ?? defaults.pack_key ?? null;
                const finalVer = d.version ?? defaults.pack_version ?? null;
                setPack(finalKey && finalVer ? { key: finalKey, version: finalVer } : null);
            }
        })();

        return () => { resolveCancelledRef.current = true; };
    }, [runId, run?.playbook_id, defaults.pack_key, defaults.pack_version]);

    // Persisted open/close
    const [open, setOpen] = useState<boolean>(() => {
        try { return localStorage.getItem("renova:runs:stepsOpen") !== "0"; } catch { return true; }
    });
    useEffect(() => {
        try { localStorage.setItem("renova:runs:stepsOpen", open ? "1" : "0"); } catch { }
    }, [open]);

    // Seed steps from the Capability service (resolved pack view)
    useEffect(() => {
        seedCancelledRef.current = false;

        async function seedNow(_pbId: string) {
            try {
                // Prefer pack_id if the run has it, else fall back to key+version
                const hint = (run ? {
                    pack_id:
                        (run as any)?.options?.pack_id ??
                        (run as any)?.provenance?.pack_id ??
                        (run as any)?.pack_id ??
                        (run as any)?.capability_pack_id,
                    key:
                        (run as any)?.options?.pack_key ??
                        (run as any)?.provenance?.pack_key ??
                        (run as any)?.pack_key ??
                        (run as any)?.pack?.key ??
                        (run as any)?.capability_pack?.key ??
                        pack?.key ?? defaults.pack_key,
                    version:
                        (run as any)?.options?.pack_version ??
                        (run as any)?.provenance?.pack_version ??
                        (run as any)?.pack_version ??
                        (run as any)?.pack?.version ??
                        (run as any)?.capability_pack?.version ??
                        pack?.version ?? defaults.pack_version,
                } : {}) as { pack_id?: string; key?: string; version?: string };

                if (!(hint.pack_id || (hint.key && hint.version))) return;

                const resolved = await callHost<{ capabilities?: any[]; playbooks?: any[] }>({
                    type: "capability:pack:get",
                    payload: { pack_id: hint.pack_id, key: hint.key, version: hint.version, resolved: true } as any,
                });

                if (seedCancelledRef.current) return;

                const caps: any[] = Array.isArray(resolved?.capabilities) ? resolved.capabilities : [];
                const capById = new Map<string, any>(caps.map((c) => [c.id, c]));
                const pb = (Array.isArray(resolved?.playbooks) ? resolved.playbooks : []).find((p: any) => p.id === _pbId);
                const steps: any[] = Array.isArray(pb?.steps) ? pb.steps : [];

                const metas = steps.map((s) => {
                    const c = capById.get(s.capability_id) || {};
                    return {
                        id: s.id,
                        capability_id: s.capability_id,
                        name: c.name || s.id,
                        produces_kinds: Array.isArray(c.produces_kinds) ? c.produces_kinds : [],
                    };
                });

                if (!seedCancelledRef.current && metas.length && run?.run_id) {
                    seed(run.run_id, metas, { markDoneIfRunCompleted: run.status === "completed" });
                }
            } catch {
                // best-effort; UI will still update from incoming step events
            }
        }

        const needsSeed = !!run && (!run.live_steps || Object.keys(run.live_steps).length === 0);
        if (needsSeed && pbId) void seedNow(pbId);

        return () => { seedCancelledRef.current = true; };
    }, [pbId, pack?.key, pack?.version, run?.run_id, run?.status, run?.live_steps, seed, defaults.pack_key, defaults.pack_version]);

    // Build display list from store's live_steps
    const items = useMemo(() => {
        const map = run?.live_steps || {};
        const arr = Object.values(map) as any[];
        arr.sort((a, b) => {
            const sa = a.started_at ? Date.parse(a.started_at) : 0;
            const sb = b.started_at ? Date.parse(b.started_at) : 0;
            if (sa !== sb) return sa - sb;
            const ia = a?.step?.id || a?.id || "";
            const ib = b?.step?.id || b?.id || "";
            return ia.localeCompare(ib);
        });
        return arr.map((e) => ({
            id: e?.step?.id || e?.id || "step",
            name: e?.step?.name || e?.name,
            capability_id: e?.step?.capability_id || e?.capability_id,
            status: (e?.status as StepStatus) ?? "pending",
            duration_s: e?.duration_s,
            produces_kinds: e?.produces_kinds,
            error: e?.error,
        }));
    }, [run?.live_steps]);

    const total = items.length;
    const done = items.filter(s => s.status === "completed").length;
    const failed = items.filter(s => s.status === "failed").length;
    const running = items.filter(s => s.status === "started").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
        <div className={["rounded-2xl border border-neutral-800 bg-neutral-900/60", className || ""].join(" ")}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <div className="text-sm font-medium text-neutral-200">
                    Playbook Steps
                    {run?.status && (
                        <span className="ml-2 rounded-full border border-neutral-700 px-2 py-[2px] text-[11px] text-neutral-300 capitalize">
                            {run.status}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-xs text-neutral-400">
                        {done}/{total} done{failed ? ` · ${failed} failed` : running ? ` · ${running} running` : ""}
                    </div>
                    {collapsible && (
                        <button className="text-neutral-300 hover:text-white" onClick={() => setOpen(v => !v)} title="Toggle">
                            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    )}
                </div>
            </div>

            {!open ? null : (
                <>
                    {/* Progress */}
                    <div className="px-4 pt-3">
                        <div className="h-2 w-full rounded bg-neutral-800 overflow-hidden">
                            <div className="h-2 bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-500">{pct}%</div>
                    </div>

                    {/* Steps */}
                    <ul className="px-2 py-2 space-y-1">
                        {items.length === 0 ? (
                            <li className="px-2 py-3 text-sm text-neutral-400">Waiting for steps…</li>
                        ) : (
                            items.map((s) => {
                                const subtle =
                                    s.status === "pending" ? "text-neutral-400" :
                                        s.status === "started" ? "text-blue-300" :
                                            s.status === "completed" ? "text-green-300" :
                                                "text-red-300";

                                const rowBorder =
                                    s.status === "failed" ? "border-red-800/60" :
                                        s.status === "completed" ? "border-green-800/40" :
                                            "border-neutral-800";

                                return (
                                    <li key={s.id} className={`px-3 py-2 rounded-xl border ${rowBorder} flex items-start gap-3`}>
                                        <div className={subtle}><StatusIcon s={s.status} /></div>
                                        <div className="min-w-0">
                                            <div className="text-sm text-neutral-200 truncate">
                                                {s.name || s.id}
                                                {s.capability_id && <span className="ml-2 text-[11px] text-neutral-500">{s.capability_id}</span>}
                                            </div>
                                            <div className="mt-0.5 text-[11px] text-neutral-400 flex items-center gap-3">
                                                <span className="capitalize">{s.status}</span>
                                                {s.duration_s != null && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} /> {typeof s.duration_s === "number" ? s.duration_s.toFixed(2) : s.duration_s}s
                                                    </span>
                                                )}
                                                {Array.isArray(s.produces_kinds) && s.produces_kinds.length > 0 && (
                                                    <span className="truncate">→ {s.produces_kinds.join(", ")}</span>
                                                )}
                                            </div>
                                            {s.error && <div className="mt-1 text-[12px] text-red-300/90">{s.error}</div>}
                                        </div>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </>
            )}
        </div>
    );
}
