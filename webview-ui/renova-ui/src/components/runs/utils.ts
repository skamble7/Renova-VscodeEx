/* eslint-disable @typescript-eslint/no-explicit-any */

export type Artifact = {
  artifact_id: string;
  workspace_id: string;
  kind: string;
  name: string;
  natural_key?: string;
  fingerprint?: string;
  data?: any;
};

export type DeltaCounts = { new: number; updated: number; unchanged: number; retired: number; deleted: number };

/** --------------------- Diffs-by-kind (new) --------------------- */
export type DiffArtifact = {
  kind_id: string;
  schema_version?: string | number;
  identity?: any;
  data?: any;
  provenance?: any;
};
export type ChangedEntry = { before?: DiffArtifact | null; after?: DiffArtifact | null };

/**
 * Shape we expect from the learning service on each run:
 *   run.diffs_by_kind = {
 *     "cam.cobol.program": { added: DiffArtifact[], removed: DiffArtifact[], changed: ChangedEntry[], unchanged: DiffArtifact[] },
 *     ...
 *   }
 */
export type DiffsByKind = Record<
  string,
  { added?: DiffArtifact[]; removed?: DiffArtifact[]; changed?: ChangedEntry[]; unchanged?: DiffArtifact[] }
>;

function len(x: unknown): number {
  return Array.isArray(x) ? x.length : 0;
}

export function countsOf(run: any): DeltaCounts {
  // Prefer new diffs_by_kind when present
  const dbk: DiffsByKind | undefined = (run as any)?.diffs_by_kind;
  if (dbk && typeof dbk === "object") {
    let n = 0, u = 0, un = 0, r = 0;
    for (const k of Object.keys(dbk)) {
      const g = dbk[k] || {};
      n += len(g.added);
      u += len(g.changed);
      un += len(g.unchanged);
      r += len(g.removed);
    }
    return { new: n, updated: u, unchanged: un, retired: r, deleted: 0 };
  }

  // legacy paths
  const direct = run?.deltas?.counts;
  if (direct && typeof direct === "object") {
    return {
      new: Number(direct.new ?? 0),
      updated: Number(direct.updated ?? 0),
      unchanged: Number(direct.unchanged ?? 0),
      retired: Number(direct.retired ?? 0),
      deleted: Number(direct.deleted ?? 0),
    };
  }
  const ad = run?.artifacts_diff || {};
  return {
    new: len(ad.new),
    updated: len(ad.updated),
    unchanged: len(ad.unchanged),
    retired: len(ad.retired),
    deleted: len(ad.deleted),
  };
}

/** Keep for legacy callers */
export function kindAndName(nk: string): { kind: string; name: string } {
  const i = nk.indexOf(":");
  if (i <= 0) return { kind: nk, name: "" };
  return { kind: nk.slice(0, i), name: nk.slice(i + 1) };
}

/** Pretty name for a diff artifact row given its kind. */
export function displayNameFor(kind_id: string, art: DiffArtifact | undefined | null): string {
  if (!art) return "(unknown)";
  const d = (art as any)?.data || {};
  switch (kind_id) {
    case "cam.cobol.program": {
      const pid = d.program_id || d.id || "";
      return pid ? String(pid) : "(program)";
    }
    case "cam.asset.repo_snapshot": {
      const repo = d.repo || d.url || "";
      const commit = (d.commit || "").toString();
      const short = commit ? commit.slice(0, 7) : "";
      return `${repo}${short ? `@${short}` : ""}`;
    }
    default: {
      const id = (art as any)?.identity;
      const hash = id?.hash || id?.id || "";
      if (hash) return String(hash);
      try {
        return JSON.stringify(d).slice(0, 80);
      } catch {
        return "(artifact)";
      }
    }
  }
}

/** Normalize an artifact into a clean JSON blob for diff display */
export function normalizeForView(kind_id: string, art: DiffArtifact | undefined | null): any {
  if (!art) return {};
  return {
    kind_id,
    schema_version: art.schema_version,
    identity: art.identity,
    data: art.data,
  };
}

/** ------------- Legacy computeDiff kept for backward-compat ------------- */
export function computeDiff(left: Record<string, any>, right: Record<string, any>) {
  const leftKeys = new Set(Object.keys(left));
  const rightKeys = new Set(Object.keys(right));
  const unchanged: string[] = []; const updated: string[] = []; const newly: string[] = []; const retired: string[] = [];
  for (const nk of rightKeys) {
    if (!leftKeys.has(nk)) newly.push(nk);
    else {
      const l = left[nk], r = right[nk];
      const sameId = l.artifact_id && r.artifact_id && l.artifact_id === r.artifact_id;
      const sameFp = l.fingerprint && r.fingerprint && l.fingerprint === r.fingerprint;
      (sameId || sameFp ? unchanged : updated).push(nk);
    }
  }
  for (const nk of leftKeys) { if (!rightKeys.has(nk)) retired.push(nk); }
  newly.sort(); updated.sort(); unchanged.sort(); retired.sort();
  return { counts: { new: newly.length, updated: updated.length, unchanged: unchanged.length, retired: retired.length, deleted: 0 },
           groups: { new: newly, updated, unchanged, retired } };
}
