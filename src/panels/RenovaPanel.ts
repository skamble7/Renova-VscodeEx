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
          // -------- Workspaces only --------
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
