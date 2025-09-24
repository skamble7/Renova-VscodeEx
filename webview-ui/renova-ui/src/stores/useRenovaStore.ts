/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
//webview-ui/renova-ui/src/stores/useRenovaStore.ts
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

/* ---------------------- Runs (NEW) ---------------------- */

export type RunStatus = "created" | "pending" | "running" | "completed" | "failed" | "canceled";

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
  options?: any;

  // run artifacts + diffs (+ counts if present)
  run_artifacts?: any[];
  artifacts_diff?: { new: string[]; updated: string[]; unchanged: string[]; retired: string[] };
  deltas?: { counts?: Partial<Record<"new" | "updated" | "unchanged" | "retired" | "deleted", number>> };

  // summary / error
  run_summary?: { started_at?: string; completed_at?: string; duration_s?: any; logs?: string[] } | null;
  error?: string | null;
};

/* ---------------------- Store Shape ---------------------- */

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

  // actions: workspace & artifacts
  switchWorkspace: (id?: string) => Promise<void>;
  filteredArtifacts: () => Artifact[];
  counts: () => { total: number };
  selectArtifact: (id?: string) => void;
  refreshArtifact: (artifactId: string) => Promise<void>;

  // runs (NEW)
  runs: LearningRun[];
  selectedRunId?: string;

  loadRuns: () => Promise<void>;
  refreshRun: (runId: string) => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
  startRun: (requestBody: any) => Promise<string | undefined>;
  selectRun: (id?: string) => void;

  // backward-compat (calls startRun under the hood)
  startLearning: (requestBody: any) => Promise<void>;
};

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

  /* Extend switchWorkspace to also load runs (NEW) */
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
    });

    if (!id) {
      set({ loading: false });
      return;
    }

    try {
      const [doc, runs] = await Promise.all([
        callHost<WorkspaceArtifactsDoc>({ type: "workspace:getDoc", payload: { id } } as any),
        callHost<LearningRun[]>({
          type: "runs:list",
          payload: { workspaceId: id, limit: 100, offset: 0 },
        } as any),
      ]);
      set({
        wsDoc: doc,
        artifacts: doc?.artifacts ?? [],
        runs: runs ?? [],
        loading: false,
      });
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

  /* ---------------------- Runs (NEW) ---------------------- */

  async loadRuns() {
    const ws = get().currentWorkspaceId;
    if (!ws) return;
    const runs = await callHost<LearningRun[]>({
      type: "runs:list",
      payload: { workspaceId: ws, limit: 100, offset: 0 },
    } as any);
    set({ runs: runs ?? [] });

    // if the selected run vanished, clear selection
    const sel = get().selectedRunId;
    if (sel && !(runs ?? []).some((r) => r.run_id === sel)) {
      set({ selectedRunId: undefined });
    }
  },

  async refreshRun(runId) {
    const full = await callHost<LearningRun>({ type: "runs:get", payload: { runId } } as any);
    const arr = get().runs.slice();
    const i = arr.findIndex((r) => r.run_id === runId);
    i >= 0 ? (arr[i] = { ...arr[i], ...full }) : arr.unshift(full);
    set({ runs: arr });
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
    const body = { ...requestBody, workspace_id: requestBody?.workspace_id ?? ws };
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

  /* Backward-compat: delegate to startRun */
  async startLearning(requestBody: any) {
    await get().startRun(requestBody);
  },
}));
