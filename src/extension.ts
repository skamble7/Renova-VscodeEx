// src/extension.ts
import * as vscode from "vscode";
import { RenovaPanel } from "./panels/RenovaPanel";
import { NotificationStream } from "./services/NotificationStream";

// Change this to "close" if you prefer hiding the entire Side Bar after launch.
const DISMISS_MODE: "explorer" | "close" = "explorer";

let notifStream: NotificationStream | null = null;
let output: vscode.OutputChannel | null = null;

export function activate(context: vscode.ExtensionContext) {
  // ---- Output panel + WebSocket stream -------------------------------------
  output = vscode.window.createOutputChannel("RENOVA Notifications");
  context.subscriptions.push(output);

  const cfg = vscode.workspace.getConfiguration("renova");
  // NOTE: fixed the typo "loaclhost" -> "localhost"
  const wsUrl = cfg.get<string>("notificationWsUrl", "ws://localhost:8016/ws");

  const forward = (evt: any) => {
    // Always forward the raw event for any interested UI
    RenovaPanel.postToWebview({ type: "runs:event", payload: evt });

    // If this is a step event for Renova learning, forward a targeted message too
    const rk: string | undefined = evt?.meta?.routing_key || evt?.routing_key || evt?.topic;
    const isStep =
      (typeof rk === "string" && rk.startsWith("renova.learning.step")) ||
      evt?.type === "learning.step" || evt?.event === "learning.step";
    if (isStep) {
      const payload = evt?.data ?? evt;
      RenovaPanel.postToWebview({ type: "runs:step", payload });
    }
  };

  notifStream = new NotificationStream({
    url: wsUrl!,
    channel: output!,
    autoStart: true,
    onEvent: forward,
  });
  context.subscriptions.push({ dispose: () => notifStream?.dispose() });

  // React to config changes (URL)
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("renova.notificationWsUrl")) {
        const newUrl = vscode.workspace
          .getConfiguration("renova")
          .get<string>("notificationWsUrl", wsUrl);
        output?.appendLine(`[RENOVA] WS URL changed to ${newUrl}. Reconnecting...`);
        notifStream?.dispose();
        notifStream = new NotificationStream({
          url: newUrl!,
          channel: output!,
          autoStart: true,
          onEvent: forward,
        });
      }
    })
  );

  // Quick command to show the notifications output
  context.subscriptions.push(
    vscode.commands.registerCommand("renova.notifications.openOutput", () => output?.show(true))
  );

  // ---- Command to open the Renova webview ---
  const openCmd = vscode.commands.registerCommand("renova.open", () => {
    RenovaPanel.createOrShow(context.extensionUri);
  });
  context.subscriptions.push(openCmd);

  // ---- Activity Bar launcher view (empty tree that just hosts the welcome) ---
  const provider = new (class implements vscode.TreeDataProvider<vscode.TreeItem> {
    onDidChangeTreeData?: vscode.Event<void | vscode.TreeItem | null | undefined> | undefined;
    getTreeItem(element: vscode.TreeItem) { return element; }
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
    } else {
      await vscode.commands.executeCommand("workbench.view.explorer");
    }
  };

  const maybeLaunch = () => {
    if (view.visible && !launchedThisVisibility) {
      launchedThisVisibility = true;
      void launchAndDismiss();
    }
  };

  if (view.visible) maybeLaunch();

  const visSub = view.onDidChangeVisibility((e) => {
    if (e.visible) maybeLaunch();
    else launchedThisVisibility = false;
  });
  context.subscriptions.push(visSub);

  // Show the notifications panel on activation so users see live events
  output.show(true);
}

export function deactivate() {
  notifStream?.dispose();
  notifStream = null;
  output?.dispose();
  output = null;
}
