// src/extension.ts
import * as vscode from "vscode";
import { RenovaPanel } from "./panels/RenovaPanel";

export function activate(context: vscode.ExtensionContext) {
  const openCmd = vscode.commands.registerCommand("renova.open", () => {
    RenovaPanel.createOrShow(context.extensionUri);
  });
  context.subscriptions.push(openCmd);

  // Optional: Activity Bar launcher (empty view just to host a welcome link)
  const provider = new (class implements vscode.TreeDataProvider<vscode.TreeItem> {
    onDidChangeTreeData?: vscode.Event<void | vscode.TreeItem | null | undefined> | undefined;
    getTreeItem(element: vscode.TreeItem) { return element; }
    getChildren() { return []; }
  })();
  const view = vscode.window.createTreeView("renovaLauncher", { treeDataProvider: provider });
  context.subscriptions.push(view);
}

export function deactivate() {}
