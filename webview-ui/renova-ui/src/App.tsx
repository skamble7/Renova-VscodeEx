/* eslint-disable @typescript-eslint/no-explicit-any */
import WorkspaceLanding from "@/components/workspace/WorkspaceLanding";
import { useRenovaStore } from "@/stores/useRenovaStore";
import { vscode } from "./lib/vscode";
import { useEffect } from "react";

export default function App() {
  const currentWorkspaceId = useRenovaStore((s) => s.currentWorkspaceId);
  const switchWorkspace = useRenovaStore((s) => s.switchWorkspace);

  // Restore last selected workspace
  useEffect(() => {
    const saved = vscode.getState<{ currentWorkspaceId?: string }>();
    if (saved?.currentWorkspaceId && !currentWorkspaceId) {
      switchWorkspace(saved.currentWorkspaceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist selection
  useEffect(() => {
    const saved = vscode.getState<any>() || {};
    vscode.setState({ ...saved, currentWorkspaceId });
  }, [currentWorkspaceId]);

  return (
    <div className="min-h-screen w-screen bg-neutral-950 text-neutral-100">
      <WorkspaceLanding />
    </div>
  );
}
