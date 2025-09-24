"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenovaWorkspaceService = void 0;
function normalizeWorkspace(w) {
    const id = w.id ?? w._id;
    if (!id)
        throw new Error("Workspace missing id/_id");
    return {
        id,
        name: w.name,
        description: w.description ?? null,
        created_by: w.created_by ?? null,
        created_at: w.created_at,
        updated_at: w.updated_at,
    };
}
const API_BASE = "http://127.0.0.1:8010"; // workspace-service
const ARTIFACT_BASE = "http://localhost:9011"; // artifact-service (registry + artifacts)
const LEARNING_BASE = "http://localhost:9013"; // learning-service
async function json(res) {
    const text = await res.text();
    return text ? JSON.parse(text) : undefined;
}
function qs(params) {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null)
            continue;
        u.set(k, String(v));
    }
    const s = u.toString();
    return s ? `?${s}` : "";
}
function getEtag(h) {
    return h.get("ETag") ?? h.get("etag") ?? undefined;
}
exports.RenovaWorkspaceService = {
    // ---- Workspaces (list/create/get/update) ----
    async list() {
        const res = await fetch(`${API_BASE}/workspace/`);
        if (!res.ok)
            throw new Error(`Failed to list workspaces (${res.status})`);
        const data = (await json(res)) ?? [];
        if (!Array.isArray(data))
            throw new Error("Expected array of workspaces");
        return data.map(normalizeWorkspace);
    },
    async create(payload) {
        const res = await fetch(`${API_BASE}/workspace/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok)
            throw new Error(`Failed to create workspace (${res.status})`);
        const data = await json(res);
        return normalizeWorkspace(data);
    },
    async get(id) {
        const res = await fetch(`${API_BASE}/workspace/${id}`);
        if (!res.ok)
            throw new Error(`Failed to get workspace (${res.status})`);
        const data = await json(res);
        return normalizeWorkspace(data);
    },
    async update(id, patch) {
        const res = await fetch(`${API_BASE}/workspace/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        });
        if (!res.ok)
            throw new Error(`Failed to update workspace (${res.status})`);
        const data = await json(res);
        return normalizeWorkspace(data);
    },
    // ---- Workspace detail (artifact-service consolidated doc) ----
    async getDetail(workspaceId) {
        const url = `${ARTIFACT_BASE}/artifact/${workspaceId}/parent?include_deleted=false`;
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Failed to get workspace detail (${res.status})`);
        return await json(res);
    },
    // ---- Artifacts ----
    async getArtifact(workspaceId, artifactId) {
        const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}`);
        if (!res.ok)
            throw new Error(`Failed to get artifact (${res.status})`);
        const etag = getEtag(res.headers);
        const data = await json(res);
        return { data, etag };
    },
    async headArtifact(workspaceId, artifactId) {
        const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}`, { method: "HEAD" });
        if (!res.ok)
            throw new Error(`Failed to head artifact (${res.status})`);
        return getEtag(res.headers);
    },
    async history(workspaceId, artifactId) {
        const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}/history`);
        if (!res.ok)
            throw new Error(`Failed to fetch history (${res.status})`);
        return await json(res);
    },
    // ---- Registry (kinds) ----
    async registryKindsList(limit = 200, offset = 0) {
        const res = await fetch(`${ARTIFACT_BASE}/registry/kinds${qs({ limit, offset })}`);
        if (!res.ok)
            throw new Error(`Failed to fetch kinds list (${res.status})`);
        return await json(res);
    },
    async registryKindGet(key) {
        const res = await fetch(`${ARTIFACT_BASE}/registry/kinds/${encodeURIComponent(key)}`);
        if (!res.ok)
            throw new Error(`Failed to fetch kind ${key} (${res.status})`);
        return await json(res);
    },
    // ---- Learning Runs ----
    async startLearning(requestBody) {
        // Ensure workspace_id is present
        if (!requestBody?.workspace_id)
            throw new Error("workspace_id is required");
        const res = await fetch(`${LEARNING_BASE}/runs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody ?? {}),
        });
        const txt = await res.text().catch(() => "");
        if (!res.ok)
            throw new Error(`Failed to start learning (${res.status}) ${txt}`);
        return txt ? JSON.parse(txt) : undefined;
    },
    async listRuns(workspaceId, opts) {
        const url = `${LEARNING_BASE}/runs${qs({
            workspace_id: workspaceId,
            limit: opts?.limit,
            offset: opts?.offset,
        })}`;
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Failed to list runs (${res.status})`);
        return await json(res); // expect array
    },
    async getRun(runId) {
        const res = await fetch(`${LEARNING_BASE}/runs/${encodeURIComponent(runId)}`);
        if (!res.ok)
            throw new Error(`Failed to get run (${res.status})`);
        return await json(res);
    },
    async deleteRun(runId) {
        const res = await fetch(`${LEARNING_BASE}/runs/${encodeURIComponent(runId)}`, { method: "DELETE" });
        if (!(res.ok || res.status === 204))
            throw new Error(`Failed to delete run (${res.status})`);
    },
};
//# sourceMappingURL=RenovaWorkspaceService.js.map