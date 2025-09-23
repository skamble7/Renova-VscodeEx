/* eslint-disable @typescript-eslint/no-explicit-any */

// src/services/RenovaWorkspaceService.ts
export type RawWorkspace = {
  id?: string;
  _id?: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type BackendWorkspace = {
  id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeWorkspace(w: RawWorkspace): BackendWorkspace {
  const id = w.id ?? w._id;
  if (!id) throw new Error("Workspace missing id/_id");
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

async function json<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as any);
}

export const RenovaWorkspaceService = {
  // ---- Workspaces (list/create/get/update) ----
  async list(): Promise<BackendWorkspace[]> {
    const res = await fetch(`${API_BASE}/workspace/`);
    if (!res.ok) throw new Error(`Failed to list workspaces (${res.status})`);
    const data = (await json<RawWorkspace[]>(res)) ?? [];
    if (!Array.isArray(data)) throw new Error("Expected array of workspaces");
    return data.map(normalizeWorkspace);
  },

  async create(payload: { name: string; description?: string; created_by?: string }) {
    const res = await fetch(`${API_BASE}/workspace/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create workspace (${res.status})`);
    const data = await json<RawWorkspace>(res);
    return normalizeWorkspace(data);
  },

  async get(id: string) {
    const res = await fetch(`${API_BASE}/workspace/${id}`);
    if (!res.ok) throw new Error(`Failed to get workspace (${res.status})`);
    const data = await json<RawWorkspace>(res);
    return normalizeWorkspace(data);
  },

  async update(id: string, patch: { name?: string; description?: string }) {
    const res = await fetch(`${API_BASE}/workspace/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Failed to update workspace (${res.status})`);
    const data = await json<RawWorkspace>(res);
    return normalizeWorkspace(data);
  },
};
