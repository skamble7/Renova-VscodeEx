/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRenovaStore } from "@/stores/useRenovaStore";
import { callHost } from "@/lib/host";
import ViewToggle from "./ViewToggle";
import NewWorkspaceDrawer from "./NewWorkspaceDrawer";
import WorkspaceCard from "./WorkspaceCard";
import { Separator } from "@/components/ui/separator";
import WorkspaceDetail from "./WorkspaceDetail";

type WorkspaceListItem = {
    id: string;
    name: string;
    description?: string | null;
    created_at?: string;
    updated_at?: string;
};

export default function WorkspaceLanding() {
    const currentWorkspaceId = useRenovaStore(s => s.currentWorkspaceId);
    const switchWorkspace = useRenovaStore(s => s.switchWorkspace);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);

    const [view, setView] = useState<"grid" | "list">(() => {
        try { return (localStorage.getItem("renova:workspaces:view") as "grid" | "list") || "grid"; }
        catch { return "grid"; }
    });
    useEffect(() => {
        try { localStorage.setItem("renova:workspaces:view", view); } catch { /* empty */ }
    }, [view]);

    const loadWorkspaces = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const items = await callHost<any[]>({ type: "workspace:list" });
            const toStr = (v: any) => (v == null ? "" : String(v));
            const normalized: WorkspaceListItem[] = (items ?? [])
                .map((w: any) => {
                    const id = w?.id ?? w?._id;
                    if (!id) return null;
                    return {
                        id: String(id),
                        name: w?.name ?? "Untitled workspace",
                        description: w?.description ?? null,
                        created_at: toStr(w?.created_at),
                        updated_at: toStr(w?.updated_at),
                    };
                })
                .filter(Boolean) as WorkspaceListItem[];

            normalized.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
            setWorkspaces(normalized);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load workspaces");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

    const landingBody = useMemo(() => {
        if (loading && workspaces.length === 0) return <div className="text-neutral-400 text-sm">Loading…</div>;
        if (error) return <div className="text-red-400 text-sm mb-3">{error}</div>;
        if (workspaces.length === 0) return <div className="text-neutral-400 text-sm">No workspaces yet. Create your first one.</div>;

        return view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {workspaces.map((w) => <WorkspaceCard key={w.id} workspace={w} variant="grid" />)}
            </div>
        ) : (
            <div className="flex flex-col gap-3">
                {workspaces.map((w) => <WorkspaceCard key={w.id} workspace={w} variant="list" />)}
            </div>
        );
    }, [loading, error, workspaces, view]);

    return (
        <div className="h-full w-full">
            {currentWorkspaceId ? (
                <WorkspaceDetail
                    workspaceId={currentWorkspaceId}
                    onBack={() => switchWorkspace(undefined)}
                />
            ) : (
                <div className="h-full w-full p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Your Workspaces</h2>
                        <div className="flex items-center gap-2">
                            <ViewToggle view={view} onChange={setView} />
                            <NewWorkspaceDrawer onCreated={() => loadWorkspaces()} />
                        </div>
                    </div>
                    <Separator className="my-4 opacity-30" />
                    {landingBody}
                </div>
            )}
        </div>
    );
}
