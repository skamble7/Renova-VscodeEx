import * as vscode from 'vscode';
import { RenovaPanel } from './panels/RenovaPanel';

export function activate(context: vscode.ExtensionContext) {
  const open = vscode.commands.registerCommand('renova.openPanel', () => RenovaPanel.show(context));
  context.subscriptions.push(open);
}

export function deactivate() {}
