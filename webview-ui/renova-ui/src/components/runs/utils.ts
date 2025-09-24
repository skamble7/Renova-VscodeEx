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

export type DeltaCounts = { new: number; updated: number; unchanged: number; retired: number; deleted: number; };

export function countsOf(run: any): DeltaCounts {
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
  const len = (x: any) => (Array.isArray(x) ? x.length : 0);
  return { new: len(ad.new), updated: len(ad.updated), unchanged: len(ad.unchanged), retired: len(ad.retired), deleted: len(ad.deleted) };
}

export function kindAndName(nk: string): { kind: string; name: string } {
  const i = nk.indexOf(":");
  if (i <= 0) return { kind: nk, name: "" };
  return { kind: nk.slice(0, i), name: nk.slice(i + 1) };
}

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
