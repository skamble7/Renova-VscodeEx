/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { callHost } from "@/lib/host";

type Props = { workspaceId: string; onBack: () => void };

export default function WorkspaceDetail({ workspaceId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const ws = await callHost<any>({ type: "workspace:get", payload: { id: workspaceId } });
        if (!mounted) return;
        setName(ws?.name ?? "");
        setDesc(ws?.description ?? "");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [workspaceId]);

  async function save() {
    setSaving(true);
    try {
      await callHost({ type: "workspace:update", payload: { id: workspaceId, patch: { name, description: desc || undefined } } });
    } finally { setSaving(false); }
  }

  return (
    <div className="h-full w-full p-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-neutral-400 hover:text-neutral-200">← Back to Workspaces</button>
      </div>

      <div className="mt-6 space-y-4 max-w-2xl">
        {loading ? (
          <div className="text-neutral-400 text-sm">Loading…</div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Description</label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} disabled={saving} />
            </div>
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
