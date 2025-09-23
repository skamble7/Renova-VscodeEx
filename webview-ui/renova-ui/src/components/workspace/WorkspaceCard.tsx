/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardContent } from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { WorkspaceSummary } from "@/types/workspace";
import { useRenovaStore } from "@/stores/useRenovaStore";
import clsx from "clsx";

type Props = { workspace: WorkspaceSummary; variant?: "grid" | "list" };

export default function WorkspaceCard({ workspace, variant = "grid" }: Props) {
  const switchWorkspace = useRenovaStore((s: { switchWorkspace: any; }) => s.switchWorkspace);

  return (
    <Card
      className={clsx(
        "bg-neutral-900/60 hover:bg-neutral-900 transition-colors border-neutral-800 cursor-pointer",
        "rounded-2xl"
      )}
      onClick={() => switchWorkspace(workspace.id)}
    >
      <CardContent className={clsx("p-5", variant === "list" && "py-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-base font-medium">{workspace.name}</div>
            {workspace.description && (
              <div className="text-sm text-neutral-400 line-clamp-2">{workspace.description}</div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-1.5 rounded-lg hover:bg-neutral-800" aria-label="More">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => switchWorkspace(workspace.id)}>Open</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
