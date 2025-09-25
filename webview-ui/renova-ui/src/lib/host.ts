/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { vscode } from "./vscode";

type Resolver = { resolve: (v: any) => void; reject: (e: any) => void };
const pending = new Map<string, Resolver>();
let listenerAttached = false;

function ensureListener() {
  if (listenerAttached) return;
  window.addEventListener("message", (e: MessageEvent) => {
    const { token, ok, data, error } = (e.data ?? {}) as any;
    if (!token || !pending.has(token)) return;
    const { resolve, reject } = pending.get(token)!;
    pending.delete(token);
    ok ? resolve(data) : reject(new Error(error || "Host error"));
  });
  listenerAttached = true;
}

export type HostReq =
  // workspaces
  | { type: "workspace:list" }
  | { type: "workspace:create"; payload: { name: string; description?: string; created_by?: string } }
  | { type: "workspace:get"; payload: { id: string } }
  | { type: "workspace:update"; payload: { id: string; patch: { name?: string; description?: string } } }
  // consolidated doc
  | { type: "workspace:getDoc"; payload: { id: string } }
  // artifacts (read)
  | { type: "artifact:get"; payload: { workspaceId: string; artifactId: string } }
  | { type: "artifact:head"; payload: { workspaceId: string; artifactId: string } }
  | { type: "artifact:history"; payload: { workspaceId: string; artifactId: string } }
  // registry
  | { type: "registry:kinds:list"; payload?: { limit?: number; offset?: number } }
  | { type: "registry:kind:get"; payload: { key: string } }
  // learning runs
  | { type: "runs:start"; payload: { requestBody: any } }
  | { type: "runs:list";  payload: { workspaceId: string; limit?: number; offset?: number } }
  | { type: "runs:get";   payload: { runId: string } }
  | { type: "capability:pack:get"; payload: { pack_id?: string; key?: string; version?: string; resolved?: boolean } }
  | { type: "runs:delete";payload: { runId: string } }
  // capability service (NEW)
  | { type: "capability:pack:resolvedByKeyVersion"; payload: { key: string; version: string } };

export function callHost<T>(req: HostReq): Promise<T> {
  if (!vscode.available()) throw new Error("VS Code API not available");
  ensureListener();
  const token = crypto.randomUUID();
  const p = new Promise<T>((resolve, reject) => pending.set(token, { resolve, reject }));
  vscode.postMessage({ ...req, token });
  return p;
}
