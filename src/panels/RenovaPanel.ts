// src/panels/RenovaPanel.ts
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { RenovaWorkspaceService } from "../services/RenovaWorkspaceService";

export class RenovaPanel {
  public static currentPanel: RenovaPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;

  public static postToWebview(message: unknown) {
    const p = RenovaPanel.currentPanel?.panel;
    if (p) p.webview.postMessage(message);
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.One;
    if (RenovaPanel.currentPanel) {
      RenovaPanel.currentPanel.panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel("renova", "Renova", column, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media", "renova-ui")],
      retainContextWhenHidden: true,
    });
    RenovaPanel.currentPanel = new RenovaPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.panel.webview.html = this.getHtmlForWebview(panel.webview);
    this.setMessageListener();
    this.panel.onDidDispose(() => (RenovaPanel.currentPanel = undefined));
  }

  private setMessageListener() {
    this.panel.webview.onDidReceiveMessage(async (message) => {
      const { type, token, payload } = message ?? {};
      const reply = (ok: boolean, data?: any, error?: string) =>
        this.panel.webview.postMessage({ token, ok, data, error });

      try {
        switch (type) {
          // ---- Workspaces ----
          case "workspace:list": {
            const data = await RenovaWorkspaceService.list();
            reply(true, data);
            break;
          }
          case "workspace:create": {
            const data = await RenovaWorkspaceService.create(payload);
            reply(true, data);
            break;
          }
          case "workspace:get": {
            const { id } = payload ?? {};
            const data = await RenovaWorkspaceService.get(id);
            reply(true, data);
            break;
          }
          case "workspace:update": {
            const { id, patch } = payload ?? {};
            const data = await RenovaWorkspaceService.update(id, patch);
            reply(true, data);
            break;
          }

          // ---- Workspace consolidated doc (artifacts + header) ----
          case "workspace:getDoc": {
            const { id } = payload ?? {};
            const data = await RenovaWorkspaceService.getDetail(id);
            reply(true, data);
            break;
          }

          // ---- Artifacts (read-only for now) ----
          case "artifact:get": {
            const { workspaceId, artifactId } = payload ?? {};
            const out = await RenovaWorkspaceService.getArtifact(workspaceId, artifactId);
            reply(true, out);
            break;
          }
          case "artifact:head": {
            const { workspaceId, artifactId } = payload ?? {};
            const etag = await RenovaWorkspaceService.headArtifact(workspaceId, artifactId);
            reply(true, { etag });
            break;
          }
          case "artifact:history": {
            const { workspaceId, artifactId } = payload ?? {};
            const data = await RenovaWorkspaceService.history(workspaceId, artifactId);
            reply(true, data);
            break;
          }

          // ---- Registry (kinds) ----
          case "registry:kinds:list": {
            const { limit = 200, offset = 0 } = payload ?? {};
            const data = await RenovaWorkspaceService.registryKindsList(limit, offset);
            reply(true, data);
            break;
          }
          case "registry:kind:get": {
            const { key } = payload ?? {};
            const data = await RenovaWorkspaceService.registryKindGet(key);
            reply(true, data);
            break;
          }

          // ---- Learning run ----
          case "runs:start": {
            const { requestBody } = payload ?? {};
            const data = await RenovaWorkspaceService.startLearning(requestBody);
            reply(true, data);
            break;
          }

          // ---- Learning runs (list/get/delete) ----
          case "runs:list": {
            const { workspaceId, limit, offset } = payload ?? {};
            const data = await RenovaWorkspaceService.listRuns(workspaceId, { limit, offset });
            reply(true, data);
            break;
          }
          case "runs:get": {
            const { runId } = payload ?? {};
            const data = await RenovaWorkspaceService.getRun(runId);
            reply(true, data);
            break;
          }
          case "runs:delete": {
            const { runId } = payload ?? {};
            await RenovaWorkspaceService.deleteRun(runId);
            reply(true, { ok: true });
            break;
          }

          // ---- Capability service bridge (packs) ----
          case "capability:pack:resolvedByKeyVersion": {
            const { key, version } = (payload ?? {}) as { key?: string; version?: string };
            if (!key || !version) {
              reply(false, undefined, "key and version are required");
              break;
            }

            // Prefer direct pack_id form (e.g. "cobol-mainframe@v1.0.2")
            const packId = `${key}@${version}`;

            // 1) Try /resolved on the direct id
            try {
              const resolved = await RenovaWorkspaceService.capabilityPackResolved(packId);
              // basic sanity: ensure playbooks/capabilities exist
              if (resolved && (resolved.playbooks || resolved.capabilities)) {
                reply(true, resolved);
                break;
              }
            } catch {
              /* fall through to non-resolved */
            }

            // 2) Fallback: non-resolved pack by id (already contains playbooks/capabilities in your service)
            try {
              const basic = await RenovaWorkspaceService.capabilityPackGetById(packId);
              if (basic && (basic.playbooks || basic.capabilities)) {
                reply(true, basic);
                break;
              }
            } catch {
              /* fall through to list */
            }

            // 3) Last resort: list with filters and resolve whichever id field is present
            try {
              const list = await RenovaWorkspaceService.capabilityPacksList({ key, version, limit: 1, offset: 0 });
              const first = Array.isArray(list) && list.length ? list[0] : null;
              const altId: string | undefined = first?.id ?? first?._id;
              if (!altId) throw new Error("Pack not found via list()");
              try {
                const resolved = await RenovaWorkspaceService.capabilityPackResolved(altId);
                reply(true, resolved);
              } catch {
                const basic = await RenovaWorkspaceService.capabilityPackGetById(altId);
                reply(true, basic);
              }
            } catch (e: any) {
              reply(false, undefined, e?.message ?? "Failed to load capability pack");
            }
            break;
          }

          case "capability:pack:get": {
            const { pack_id, key, version, resolved = true } = (payload ?? {}) as {
              pack_id?: string; key?: string; version?: string; resolved?: boolean;
            };

            if (!pack_id && !(key && version)) {
              reply(false, undefined, "capability:pack:get requires pack_id or key+version");
              break;
            }

            const id = pack_id ?? `${key}@${version}`;

            try {
              if (resolved) {
                try {
                  const data = await RenovaWorkspaceService.capabilityPackResolved(id);
                  reply(true, data);
                  break;
                } catch {/* fall back */ }
              }
              const basic = await RenovaWorkspaceService.capabilityPackGetById(id);
              reply(true, basic);
            } catch (e: any) {
              reply(false, undefined, e?.message ?? "Failed to fetch capability pack");
            }
            break;
          }

          case "hello": { reply(true, { ok: true }); break; }

          default:
            reply(false, undefined, `Unhandled message type: ${type}`);
        }
      } catch (e: any) {
        reply(false, undefined, e?.message ?? String(e) ?? "Unknown error");
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const manifestCandidates = [
      path.join(this.extensionUri.fsPath, "media", "renova-ui", ".vite", "manifest.json"),
      path.join(this.extensionUri.fsPath, "media", "renova-ui", "manifest.json"),
    ];
    const manifestPath = manifestCandidates.find(fs.existsSync);
    if (!manifestPath) {
      vscode.window.showErrorMessage("Vite build not found. Run `npm run build` in renova-ui.");
      return "<html><body><h3>Build missing</h3></body></html>";
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const entryKey = manifest["index.html"] ? "index.html" : Object.keys(manifest)[0];
    const entry = manifest[entryKey];
    const scriptFile: string = entry.file;
    const cssFile: string | undefined = entry.css?.[0];

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "renova-ui", scriptFile)
    );
    const styleUri = cssFile
      ? webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "renova-ui", cssFile))
      : undefined;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  html, body, #root { height:100%; width:100%; }
  body { margin:0 !important; padding:0 !important; background:#0a0a0a; }
  #root { position:fixed; inset:0; }
</style>
${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ""}
<title>Renova</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
