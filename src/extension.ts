// src/extension.ts
import * as vscode from "vscode";
import { RenovaPanel } from "./panels/RenovaPanel";

// Change this to "close" if you prefer hiding the entire Side Bar after launch.
const DISMISS_MODE: "explorer" | "close" = "explorer";

export function activate(context: vscode.ExtensionContext) {
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

  if (view.visible) {
    maybeLaunch();
  }

  const visSub = view.onDidChangeVisibility((e) => {
    if (e.visible) {
      maybeLaunch();
    } else {
      launchedThisVisibility = false;
    }
  });
  context.subscriptions.push(visSub);
}

export function deactivate() {}
