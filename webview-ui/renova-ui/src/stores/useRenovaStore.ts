/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { callHost } from "@/lib/host";

/* ---------------------- Artifact & Workspace Types ---------------------- */

export type Artifact = {
  artifact_id: string;
  kind: string;
  name: string;
  data: any;
  version?: number | { $numberInt: string };
  provenance?: any;
};

export type WorkspaceHeader = {
  _id: string;
  name: string;
  description?: string | null;
};

export type WorkspaceArtifactsDoc = {
  _id: string;
  workspace_id: string;
  workspace: WorkspaceHeader;
  artifacts: Artifact[];
};

/* ---------------------- Kind Registry Types ---------------------- */

type KindRegistryItem = {
  _id: string;
  title: string;
  latest_schema_version?: string;
  schema_versions?: Array<{ version: string; json_schema: any }>;
};

/* ---------------------- Step & Run Types (NEW) ---------------------- */

export type StepStatus = "pending" | "started" | "completed" | "failed";

export type StepInfo = { id: string; capability_id?: string; name?: string };
export type StepEvent = {
  run_id: string;
  workspace_id?: string;
  playbook_id?: string;
  step: StepInfo;
  status: StepStatus | string;
  params?: any;
  started_at?: string;
  ended_at?: string;
  duration_s?: number | string | { $numberDouble: string };
  produces_kinds?: string[];
  error?: string;
};

export type RunStatus = "created" | "pending" | "running" | "completed" | "failed" | "canceled";

/** New: shapes for diffs-by-kind kept generic */
export type DiffArtifact = {
  kind_id: string;
  schema_version?: string | number;
  identity?: any;
  data?: any;
  provenance?: any;
};
export type ChangedEntry = { before?: DiffArtifact | null; after?: DiffArtifact | null };
export type DiffsByKind = Record<
  string,
  { added?: DiffArtifact[]; removed?: DiffArtifact[]; changed?: ChangedEntry[]; unchanged?: DiffArtifact[] }
>;

export type LearningRun = {
  run_id: string;
  workspace_id: string;
  playbook_id: string;
  status: RunStatus;

  // Labels
  title?: string | null;
  description?: string | null;

  // Timestamps
  created_at?: string;
  updated_at?: string;

  // inputs/options snapshot (as returned by learning-service)
  inputs?: any;
  options?: {
    model?: string;
    validate?: boolean;
    dry_run?: boolean;
    pack_key?: string;
    pack_version?: string;
    [k: string]: any;
  };

  // run artifacts + diffs
  run_artifacts?: any[];
  artifacts_diff?: { new: string[]; updated: string[]; unchanged: string[]; retired: string[] }; // legacy
  deltas?: { counts?: Partial<Record<"new" | "updated" | "unchanged" | "retired" | "deleted", number>> }; // legacy
  diffs_by_kind?: DiffsByKind; // NEW

  // summary / error
  run_summary?: { started_at?: string; completed_at?: string; duration_s?: any; logs?: string[] } | null;
  error?: string | null;

  // live steps (NEW)
  step_events?: StepEvent[];
  live_steps?: Record<string, StepEvent>;
};

/* ---------------------- Store Shape ---------------------- */

type CapabilityDefaults = {
  pack_key?: string;
  pack_version?: string;
  model?: string;
};

type State = {
  loading: boolean;
  error?: string;

  currentWorkspaceId?: string;
  wsDoc?: WorkspaceArtifactsDoc;

  artifacts: Artifact[];
  etags: Record<string, string | undefined>;
  selectedArtifactId?: string;

  // registry cache
  kindIndex: Record<string, KindRegistryItem>;
  getKindSchema: (key: string) => Promise<KindRegistryItem | undefined>;

  // filters
  q: string;
  view: "grid" | "list";
  setQuery: (q: string) => void;
  setView: (v: "grid" | "list") => void;

  // runs
  runs: LearningRun[];
  selectedRunId?: string;

  loadRuns: () => Promise<void>;
  refreshRun: (runId: string) => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
  startRun: (requestBody: any) => Promise<string | undefined>;
  selectRun: (id?: string) => void;

  // steps (NEW)
  seedLiveSteps: (
    runId: string,
    metas: Array<{ id: string; capability_id: string; name?: string; produces_kinds?: string[] }>,
    opts?: { markDoneIfRunCompleted?: boolean }
  ) => void;
  applyStepEvent: (evt: any) => void;

  // backward-compat
  startLearning: (requestBody: any) => Promise<void>;

  // capability defaults (NEW)
  capabilityDefaults: CapabilityDefaults;
  setCapabilityDefaults: (d: Partial<CapabilityDefaults>) => void;
  deriveCapabilityDefaults: () => void;

  // workspace & artifacts
  switchWorkspace: (id?: string) => Promise<void>;
  filteredArtifacts: () => Artifact[];
  counts: () => { total: number };
  selectArtifact: (id?: string) => void;
  refreshArtifact: (artifactId: string) => Promise<void>;
};

/* ---------------------- Helpers ---------------------- */

function derivePackHint(run: any): { pack_id?: string; key?: string; version?: string } {
  const key =
    run?.options?.pack_key ??
    run?.provenance?.pack_key ??
    run?.pack_key ??
    run?.pack?.key ??
    run?.capability_pack?.key;

  const version =
    run?.options?.pack_version ??
    run?.provenance?.pack_version ??
    run?.pack_version ??
    run?.pack?.version ??
    run?.capability_pack?.version;

  const pack_id =
    run?.options?.pack_id ??
    run?.provenance?.pack_id ??
    run?.pack_id ??
    run?.capability_pack_id ??
    (key && version ? `${key}@${version}` : undefined);

  return { pack_id, key, version };
}

async function fetchPackForRun(run: any): Promise<{ capabilities?: any[]; playbooks?: any[] } | null> {
  const { pack_id, key, version } = derivePackHint(run);
  if (!(pack_id || (key && version))) return null;
  try {
    return await callHost<{ capabilities?: any[]; playbooks?: any[] }>({
      type: "capability:pack:get",
      payload: { pack_id, key, version, resolved: true } as any,
    } as any);
  } catch {
    return null;
  }
}

function buildStepMetasForPlaybook(packDoc: any, playbookId: string) {
  const caps: any[] = Array.isArray(packDoc?.capabilities) ? packDoc.capabilities : [];
  const capById = new Map<string, any>(caps.map((c) => [c.id, c]));
  const pb = (Array.isArray(packDoc?.playbooks) ? packDoc.playbooks : []).find((p: any) => p.id === playbookId);
  const steps: any[] = Array.isArray(pb?.steps) ? pb.steps : [];
  return steps.map((s) => {
    const c = capById.get(s.capability_id) || {};
    return {
      id: s.id,
      capability_id: s.capability_id,
      name: c.name || s.id,
      produces_kinds: Array.isArray(c.produces_kinds) ? c.produces_kinds : [],
    };
  });
}

function normalizeDuration(v: any): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (v && typeof v === "object" && typeof v.$numberDouble === "string") return Number(v.$numberDouble);
  return undefined;
}

/* ---------------------- Implementation ---------------------- */

export const useRenovaStore = create<State>((set, get) => ({
  loading: false,
  artifacts: [],
  etags: {},
  kindIndex: {},
  q: "",
  view: "grid",

  runs: [],
  selectedRunId: undefined,

  capabilityDefaults: {},
  setCapabilityDefaults: (d) => set((s) => ({ capabilityDefaults: { ...s.capabilityDefaults, ...d } })),
  deriveCapabilityDefaults() {
    for (const r of get().runs) {
      const pk = r.options?.pack_key;
      const pv = r.options?.pack_version;
      const model = r.options?.model;
      if (pk && pv && (!get().capabilityDefaults.pack_key || !get().capabilityDefaults.pack_version)) {
        get().setCapabilityDefaults({ pack_key: pk, pack_version: pv });
      }
      if (model && !get().capabilityDefaults.model) {
        get().setCapabilityDefaults({ model });
      }
      if (get().capabilityDefaults.pack_key && get().capabilityDefaults.pack_version && get().capabilityDefaults.model) break;
    }
  },

  setQuery: (q) => set({ q }),
  setView: (v) => set({ view: v }),

  async getKindSchema(key: string) {
    if (!key) return undefined;
    const existing = get().kindIndex[key];
    if (existing?.schema_versions?.length) return existing;
    try {
      const one = await callHost<KindRegistryItem>({ type: "registry:kind:get", payload: { key } } as any);
      set((s) => ({ kindIndex: { ...s.kindIndex, [key]: one } }));
      return one;
    } catch {
      return existing;
    }
  },

  /* Extend switchWorkspace to also load runs */
  async switchWorkspace(id) {
    set({
      loading: true,
      error: undefined,
      currentWorkspaceId: id,
      wsDoc: undefined,
      artifacts: [],
      selectedArtifactId: undefined,
      runs: [],
      selectedRunId: undefined,
      capabilityDefaults: {},
    });

    if (!id) {
      set({ loading: false });
      return;
    }

    try {
      const [doc, runs] = await Promise.all([
        callHost<WorkspaceArtifactsDoc>({ type: "workspace:getDoc", payload: { id } } as any),
        callHost<LearningRun[]>({ type: "runs:list", payload: { workspaceId: id, limit: 100, offset: 0 } } as any),
      ]);
      set({
        wsDoc: doc,
        artifacts: doc?.artifacts ?? [],
        runs: runs ?? [],
        loading: false,
      });
      get().deriveCapabilityDefaults();
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to load workspace", loading: false });
    }
  },

  filteredArtifacts() {
    const { artifacts, q } = get();
    const s = q.trim().toLowerCase();
    if (!s) return artifacts;
    return artifacts.filter((a) => (`${a.name} ${a.kind}`).toLowerCase().includes(s));
  },

  counts() {
    return { total: get().artifacts.length };
  },

  selectArtifact(id) {
    set({ selectedArtifactId: id });
  },

  async refreshArtifact(artifactId) {
    const ws = get().currentWorkspaceId;
    if (!ws) return;
    const { data, etag } = await callHost<{ data: Artifact; etag?: string }>({
      type: "artifact:get",
      payload: { workspaceId: ws, artifactId },
    } as any);
    set((s) => ({
      artifacts: s.artifacts.map((a) => (a.artifact_id === artifactId ? (data as any) : a)),
      etags: { ...s.etags, [artifactId]: etag },
    }));
  },

  /* ---------------------- Runs ---------------------- */

  async loadRuns() {
    const ws = get().currentWorkspaceId;
    if (!ws) return;
    const runs = await callHost<LearningRun[]>({
      type: "runs:list",
      payload: { workspaceId: ws, limit: 100, offset: 0 },
    } as any);
    set({ runs: runs ?? [] });

    const sel = get().selectedRunId;
    if (sel && !(runs ?? []).some((r) => r.run_id === sel)) {
      set({ selectedRunId: undefined });
    }

    get().deriveCapabilityDefaults();
  },

  async refreshRun(runId) {
    const full = await callHost<LearningRun>({ type: "runs:get", payload: { runId } } as any);
    const arr = get().runs.slice();
    const i = arr.findIndex((r) => r.run_id === runId);

    if (i >= 0) {
      const prev = arr[i];
      const next: LearningRun = {
        ...prev,
        ...full,
        step_events: prev.step_events ?? [],
        live_steps: { ...(prev.live_steps ?? {}) },
      };
      if (next.status === "completed" && next.live_steps && Object.keys(next.live_steps).length > 0) {
        const vals = Object.values(next.live_steps);
        const allPending = vals.every((e: any) => (e?.status ?? "pending") === "pending");
        if (allPending) {
          for (const k of Object.keys(next.live_steps)) {
            next.live_steps[k] = { ...next.live_steps[k], status: "completed" } as any;
          }
        }
      }
      if (!next.live_steps || Object.keys(next.live_steps).length === 0) {
        try {
          const packDoc = await fetchPackForRun(next);
          if (packDoc && next.playbook_id) {
            const metas = buildStepMetasForPlaybook(packDoc, next.playbook_id);
            if (metas.length) {
              get().seedLiveSteps(next.run_id, metas, { markDoneIfRunCompleted: next.status === "completed" });
            }
          }
        } catch { /* best-effort */ }
      }
      arr[i] = next;
    } else {
      arr.unshift(full);
    }
    set({ runs: arr });

    const model = full?.options?.model;
    if (model && !get().capabilityDefaults.model) get().setCapabilityDefaults({ model });
    const pk = full?.options?.pack_key;
    const pv = full?.options?.pack_version;
    if ((!get().capabilityDefaults.pack_key || !get().capabilityDefaults.pack_version) && pk && pv) {
      get().setCapabilityDefaults({ pack_key: pk, pack_version: pv });
    }
  },

  async deleteRun(runId) {
    await callHost({ type: "runs:delete", payload: { runId } } as any);
    set((s) => ({
      runs: s.runs.filter((r) => r.run_id !== runId),
      selectedRunId: s.selectedRunId === runId ? undefined : s.selectedRunId,
    }));
  },

  async startRun(requestBody) {
    const ws = get().currentWorkspaceId;
    if (!ws) throw new Error("No workspace selected");

    const defaults = get().capabilityDefaults ?? {};
    const optsIn = { ...(requestBody?.options ?? {}) };
    const opts = {
      pack_key: optsIn.pack_key ?? defaults.pack_key ?? "svc-micro",
      pack_version: optsIn.pack_version ?? defaults.pack_version ?? "v1.4",
      model: optsIn.model ?? defaults.model ?? "openai:gpt-4o-mini",
      validate: optsIn.validate ?? true,
      dry_run: optsIn.dry_run ?? false,
    };
    set((st) => ({ capabilityDefaults: { ...st.capabilityDefaults, ...opts } }));

    const body = { ...requestBody, workspace_id: requestBody?.workspace_id ?? ws, options: opts };
    const res = await callHost<{ run_id?: string }>({
      type: "runs:start",
      payload: { requestBody: body },
    } as any);
    await get().loadRuns();
    return res?.run_id;
  },

  selectRun(id) {
    set({ selectedRunId: id });
  },

  /* ---------------------- Steps: seed + apply (NEW) ---------------------- */

  seedLiveSteps(runId, metas, opts) {
    const { runs } = get();
    const idx = runs.findIndex((r) => r.run_id === runId);
    if (idx < 0) return;

    const prev = runs[idx];
    const live = { ...(prev.live_steps ?? {}) };

    for (const m of metas) {
      const ex = live[m.id];
      if (!ex) {
        live[m.id] = {
          run_id: prev.run_id,
          status: "pending",
          step: { id: m.id, capability_id: m.capability_id, name: m.name },
          produces_kinds: m.produces_kinds ?? [],
        } as any;
      } else {
        live[m.id] = {
          ...ex,
          step: {
            id: m.id,
            capability_id: ex.step?.capability_id ?? m.capability_id,
            name: ex.step?.name ?? m.name,
          },
          produces_kinds:
            (ex.produces_kinds && ex.produces_kinds.length > 0)
              ? ex.produces_kinds
              : (m.produces_kinds ?? []),
        };
      }
    }

    if (opts?.markDoneIfRunCompleted && prev.status === "completed") {
      const vals = Object.values(live);
      if (vals.length && vals.every((e: any) => (e?.status ?? "pending") === "pending")) {
        for (const k of Object.keys(live)) {
          live[k] = { ...live[k], status: "completed" } as any;
        }
      }
    }

    const next: LearningRun = { ...prev, live_steps: live, step_events: prev.step_events ?? [] };
    const arr = runs.slice();
    arr[idx] = next;
    set({ runs: arr });
  },

  applyStepEvent(evt: any) {
    const d = evt?.data ?? evt;
    const run_id: string | undefined = d?.run_id;
    const step = d?.step;
    const status: string | undefined = d?.status;
    if (!run_id || !step?.id || !status) return;

    const { runs } = get();
    const idx = runs.findIndex((r) => r.run_id === run_id);
    if (idx < 0) return;

    const prev = runs[idx];
    const ex = prev.live_steps?.[step.id];

    const merged: StepEvent = {
      ...(ex ?? {}),
      ...d,
      step: {
        id: step.id,
        capability_id: step.capability_id ?? ex?.step?.capability_id,
        name: step.name ?? ex?.step?.name,
      },
      produces_kinds:
        Array.isArray(d.produces_kinds) && d.produces_kinds.length
          ? d.produces_kinds
          : (Array.isArray(ex?.produces_kinds) ? ex?.produces_kinds : []),
      duration_s: normalizeDuration(d.duration_s),
    };

    const live_steps = { ...(prev.live_steps ?? {}) };
    live_steps[step.id] = merged;
    const step_events = [...(prev.step_events ?? []), merged];

    let statusPatch: Partial<LearningRun> = {};
    if (status === "started" && prev.status === "pending") {
      statusPatch = { status: "running" as LearningRun["status"] };
    }

    const next: LearningRun = { ...prev, ...statusPatch, live_steps, step_events };
    const arr = runs.slice();
    arr[idx] = next;
    set({ runs: arr });
  },

  /* Backward-compat */
  async startLearning(requestBody: any) {
    await get().startRun(requestBody);
  },
}));
