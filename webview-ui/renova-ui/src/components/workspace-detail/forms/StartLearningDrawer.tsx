/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { z } from "zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRenovaStore } from "@/stores/useRenovaStore";
import { useToast } from "@/hooks/use-toast";

/* =========================
 * Schema = sample payload
 * ========================= */
const Schema = z.object({
  playbook_id: z.string().min(1, "Playbook id is required"),
  pack_id: z.string().min(1, "Pack id is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),

  // Convenience fields to fill inputs.repos + inputs.extra
  git_url: z.string().url("Valid Git URL required"),
  git_branch: z.string().min(1, "Git branch is required"),
  repo_dest: z.string().min(1, "Local destination is required"),
  shallow: z.boolean().default(true),

  options: z.object({
    validate: z.boolean().default(true),
    strict_json: z.boolean().default(true),
  }),

  // Optional raw override (if present, sent as-is)
  advanced_body: z.string().optional(),
});
type FormValues = z.infer<typeof Schema>;

/* =========================
 * Defaults (from screenshot)
 * ========================= */
const defaults: FormValues = {
  playbook_id: "pb.core",
  pack_id: "cobol-mainframe@v1.0.2",
  title: "Minimal COBOL Pack Run",
  description: "Clone + Parse using MCP servers",
  git_url: "https://github.com/aws-samples/aws-mainframe-modernization-carddemo",
  git_branch: "main",
  repo_dest: "/mnt/src",
  shallow: true,
  options: { validate: true, strict_json: true },
  advanced_body: "",
};

export default function StartLearningDrawer({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
}) {
  const { toast } = useToast();
  const { startLearning } = useRenovaStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema) as any,
    defaultValues: defaults,
    mode: "onSubmit",
  });

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    try {
      const advanced = (values.advanced_body || "").trim();
      const body = advanced
        ? JSON.parse(advanced)
        : {
            playbook_id: values.playbook_id,
            pack_id: values.pack_id,
            workspace_id: workspaceId,
            inputs: {
              repos: [
                {
                  url: values.git_url,
                  revision: values.git_branch,
                  shallow: !!values.shallow,
                  dest: values.repo_dest,
                },
              ],
              extra: {
                git: { url: values.git_url, branch: values.git_branch },
                repo: { dest: values.repo_dest },
              },
            },
            options: {
              validate: !!values.options.validate,
              strict_json: !!values.options.strict_json,
            },
            title: values.title,
            description: values.description,
          };

      if (!body.workspace_id) body.workspace_id = workspaceId;

      await startLearning(body);
      toast({ title: "Run submitted", description: "Learning run was started." });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Failed to start run",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="right-0 left-auto w-full sm:max-w-xl md:max-w-2xl">
        <DrawerHeader className="border-b">
          <DrawerTitle>Start Learning Run</DrawerTitle>
          <DrawerDescription>
            Sends a <code>POST</code> to <code>http://localhost:9013/runs</code> with the
            COBOL pack payload.
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-4 md:p-6 space-y-8 max-h-[calc(100vh-9rem)] overflow-auto">
          <form id="learning-form" className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
            {/* Basics */}
            <section className="space-y-3">
              <Label>Playbook ID</Label>
              <Input placeholder="pb.core" {...form.register("playbook_id")} />
              <Label>Pack ID</Label>
              <Input placeholder="cobol-mainframe@v1.0.2" {...form.register("pack_id")} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Title</Label>
                  <Input placeholder="Minimal COBOL Pack Run" {...form.register("title")} />
                </div>
                <div>
                  <Label>Shallow clone</Label>
                  <div className="h-9 flex items-center gap-3">
                    <Switch
                      checked={!!form.watch("shallow")}
                      onCheckedChange={(v) => form.setValue("shallow", v)}
                    />
                    <span className="text-sm text-neutral-400">Use shallow clone</span>
                  </div>
                </div>
              </div>
              <Label>Description</Label>
              <Textarea
                rows={3}
                placeholder="Clone + Parse using MCP servers"
                {...form.register("description")}
              />
            </section>

            {/* Git / Repo */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium tracking-wide">Repository</h3>
              <Label>Git URL</Label>
              <Input
                placeholder="https://github.com/aws-samples/aws-mainframe-modernization-carddemo"
                {...form.register("git_url")}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Branch</Label>
                  <Input placeholder="main" {...form.register("git_branch")} />
                </div>
                <div>
                  <Label>Local destination (folder)</Label>
                  <Input placeholder="/mnt/src" {...form.register("repo_dest")} />
                </div>
              </div>
              <div className="text-xs text-neutral-500">
                These three fields populate both <code>inputs.repos[0]</code> and <code>inputs.extra</code>.
              </div>
            </section>

            {/* Options */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium tracking-wide">Options</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Label className="m-0">Validate</Label>
                  <Switch
                    checked={!!form.watch("options.validate")}
                    onCheckedChange={(v) => form.setValue("options.validate", v)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label className="m-0">Strict JSON</Label>
                  <Switch
                    checked={!!form.watch("options.strict_json")}
                    onCheckedChange={(v) => form.setValue("options.strict_json", v)}
                  />
                </div>
              </div>
            </section>

            {/* Advanced override */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium tracking-wide">Advanced (raw JSON override)</h3>
              <Textarea
                rows={8}
                placeholder={`Paste full JSON body to send as-is.\nIf present, it will override the fields above.\n\nExample:\n{\n  "playbook_id": "pb.core",\n  "pack_id": "cobol-mainframe@v1.0.2",\n  "workspace_id": "${workspaceId}",\n  "inputs": {\n    "repos": [{ "url": "https://github.com/aws-samples/aws-mainframe-modernization-carddemo", "revision": "main", "shallow": true, "dest": "/mnt/src" }],\n    "extra": { "git": { "url": "https://github.com/aws-samples/aws-mainframe-modernization-carddemo", "branch": "main" }, "repo": { "dest": "/mnt/src" } }\n  },\n  "options": { "validate": true, "strict_json": true },\n  "title": "Minimal COBOL Pack Run",\n  "description": "Clone + Parse using MCP servers"\n}`}
                {...form.register("advanced_body")}
              />
            </section>
          </form>
        </div>

        <DrawerFooter className="border-t">
          <div className="flex items-center justify-end gap-2">
            <DrawerClose asChild><Button variant="ghost">Cancel</Button></DrawerClose>
            <Button type="submit" form="learning-form">Start</Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
