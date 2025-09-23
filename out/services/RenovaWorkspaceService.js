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
const API_BASE = "http://127.0.0.1:8010"; // workspace-service only
async function json(res) {
    const text = await res.text();
    return text ? JSON.parse(text) : undefined;
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
};
//# sourceMappingURL=RenovaWorkspaceService.js.map