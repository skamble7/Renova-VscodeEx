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
exports.activate = activate;
exports.deactivate = deactivate;
// src/extension.ts
const vscode = __importStar(require("vscode"));
const RenovaPanel_1 = require("./panels/RenovaPanel");
const NotificationStream_1 = require("./services/NotificationStream");
// Change this to "close" if you prefer hiding the entire Side Bar after launch.
const DISMISS_MODE = "explorer";
let notifStream = null;
let output = null;
function activate(context) {
    // ---- Output panel + WebSocket stream -------------------------------------
    output = vscode.window.createOutputChannel("RENOVA Notifications");
    context.subscriptions.push(output);
    const cfg = vscode.workspace.getConfiguration("renova");
    // NOTE: fixed the typo "loaclhost" -> "localhost"
    const wsUrl = cfg.get("notificationWsUrl", "ws://localhost:8016/ws");
    const forward = (evt) => {
        // Always forward the raw event for any interested UI
        RenovaPanel_1.RenovaPanel.postToWebview({ type: "runs:event", payload: evt });
        // If this is a step event for Renova learning, forward a targeted message too
        const rk = evt?.meta?.routing_key || evt?.routing_key || evt?.topic;
        const isStep = (typeof rk === "string" && rk.startsWith("renova.learning.step")) ||
            evt?.type === "learning.step" || evt?.event === "learning.step";
        if (isStep) {
            const payload = evt?.data ?? evt;
            RenovaPanel_1.RenovaPanel.postToWebview({ type: "runs:step", payload });
        }
    };
    notifStream = new NotificationStream_1.NotificationStream({
        url: wsUrl,
        channel: output,
        autoStart: true,
        onEvent: forward,
    });
    context.subscriptions.push({ dispose: () => notifStream?.dispose() });
    // React to config changes (URL)
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("renova.notificationWsUrl")) {
            const newUrl = vscode.workspace
                .getConfiguration("renova")
                .get("notificationWsUrl", wsUrl);
            output?.appendLine(`[RENOVA] WS URL changed to ${newUrl}. Reconnecting...`);
            notifStream?.dispose();
            notifStream = new NotificationStream_1.NotificationStream({
                url: newUrl,
                channel: output,
                autoStart: true,
                onEvent: forward,
            });
        }
    }));
    // Quick command to show the notifications output
    context.subscriptions.push(vscode.commands.registerCommand("renova.notifications.openOutput", () => output?.show(true)));
    // ---- Command to open the Renova webview ---
    const openCmd = vscode.commands.registerCommand("renova.open", () => {
        RenovaPanel_1.RenovaPanel.createOrShow(context.extensionUri);
    });
    context.subscriptions.push(openCmd);
    // ---- Activity Bar launcher view (empty tree that just hosts the welcome) ---
    const provider = new (class {
        onDidChangeTreeData;
        getTreeItem(element) { return element; }
        getChildren() { return []; }
    })();
    const view = vscode.window.createTreeView("renovaLauncher", { treeDataProvider: provider });
    context.subscriptions.push(view);
    // ---- Optional: auto-launch Renova when the launcher view first becomes visible ---
    let launchedThisVisibility = false;
    const launchAndDismiss = async () => {
        await vscode.commands.executeCommand("renova.open");
        if (DISMISS_MODE === "close") {
            await vscode.commands.executeCommand("workbench.action.closeSidebar");
        }
        else {
            await vscode.commands.executeCommand("workbench.view.explorer");
        }
    };
    const maybeLaunch = () => {
        if (view.visible && !launchedThisVisibility) {
            launchedThisVisibility = true;
            void launchAndDismiss();
        }
    };
    if (view.visible)
        maybeLaunch();
    const visSub = view.onDidChangeVisibility((e) => {
        if (e.visible)
            maybeLaunch();
        else
            launchedThisVisibility = false;
    });
    context.subscriptions.push(visSub);
    // Show the notifications panel on activation so users see live events
    output.show(true);
}
function deactivate() {
    notifStream?.dispose();
    notifStream = null;
    output?.dispose();
    output = null;
}
//# sourceMappingURL=extension.js.map