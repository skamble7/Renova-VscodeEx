"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenovaPanel = void 0;
// src/panels/RenovaPanel.ts
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const RenovaWorkspaceService_1 = require("../services/RenovaWorkspaceService");
class RenovaPanel {
    static currentPanel;
    panel;
    extensionUri;
    static postToWebview(message) {
        const p = RenovaPanel.currentPanel?.panel;
        if (p)
            p.webview.postMessage(message);
    }
    static createOrShow(extensionUri) {
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
    constructor(panel, extensionUri) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.panel.webview.html = this.getHtmlForWebview(panel.webview);
        this.setMessageListener();
        this.panel.onDidDispose(() => (RenovaPanel.currentPanel = undefined));
    }
    setMessageListener() {
        this.panel.webview.onDidReceiveMessage(async (message) => {
            const { type, token, payload } = message ?? {};
            const reply = (ok, data, error) => this.panel.webview.postMessage({ token, ok, data, error });
            try {
                switch (type) {
                    // ---- Workspaces ----
                    case "workspace:list": {
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.list();
                        reply(true, data);
                        break;
                    }
                    case "workspace:create": {
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.create(payload);
                        reply(true, data);
                        break;
                    }
                    case "workspace:get": {
                        const { id } = payload ?? {};
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.get(id);
                        reply(true, data);
                        break;
                    }
                    case "workspace:update": {
                        const { id, patch } = payload ?? {};
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.update(id, patch);
                        reply(true, data);
                        break;
                    }
                    // ---- Workspace consolidated doc (artifacts + header) ----
                    case "workspace:getDoc": {
                        const { id } = payload ?? {};
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.getDetail(id);
                        reply(true, data);
                        break;
                    }
                    // ---- Artifacts (read-only for now) ----
                    case "artifact:get": {
                        const { workspaceId, artifactId } = payload ?? {};
                        const out = await RenovaWorkspaceService_1.RenovaWorkspaceService.getArtifact(workspaceId, artifactId);
                        reply(true, out);
                        break;
                    }
                    case "artifact:head": {
                        const { workspaceId, artifactId } = payload ?? {};
                        const etag = await RenovaWorkspaceService_1.RenovaWorkspaceService.headArtifact(workspaceId, artifactId);
                        reply(true, { etag });
                        break;
                    }
                    case "artifact:history": {
                        const { workspaceId, artifactId } = payload ?? {};
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.history(workspaceId, artifactId);
                        reply(true, data);
                        break;
                    }
                    // ---- Registry (kinds) ----
                    case "registry:kinds:list": {
                        const { limit = 200, offset = 0 } = payload ?? {};
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.registryKindsList(limit, offset);
                        reply(true, data);
                        break;
                    }
                    case "registry:kind:get": {
                        const { key } = payload ?? {};
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.registryKindGet(key);
                        reply(true, data);
                        break;
                    }
                    // ---- Learning run ----
                    case "runs:start": {
                        const { requestBody } = payload ?? {};
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.startLearning(requestBody);
                        reply(true, data);
                        break;
                    }
                    // ---- Learning runs (list/get/delete) ----
                    case "runs:list": {
                        const { workspaceId, limit, offset } = payload ?? {};
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.listRuns(workspaceId, { limit, offset });
                        reply(true, data);
                        break;
                    }
                    case "runs:get": {
                        const { runId } = payload ?? {};
                        const data = await RenovaWorkspaceService_1.RenovaWorkspaceService.getRun(runId);
                        reply(true, data);
                        break;
                    }
                    case "runs:delete": {
                        const { runId } = payload ?? {};
                        await RenovaWorkspaceService_1.RenovaWorkspaceService.deleteRun(runId);
                        reply(true, { ok: true });
                        break;
                    }
                    case "hello": {
                        reply(true, { ok: true });
                        break;
                    }
                    default:
                        reply(false, undefined, `Unhandled message type: ${type}`);
                }
            }
            catch (e) {
                reply(false, undefined, e?.message ?? String(e) ?? "Unknown error");
            }
        });
    }
    getHtmlForWebview(webview) {
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
        const scriptFile = entry.file;
        const cssFile = entry.css?.[0];
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "renova-ui", scriptFile));
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
exports.RenovaPanel = RenovaPanel;
//# sourceMappingURL=RenovaPanel.js.map