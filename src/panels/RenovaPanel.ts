import * as vscode from 'vscode';
import { getNonce } from '../getNonce';
import * as path from 'path';
import * as fs from 'fs';

export class RenovaPanel {
  public static readonly viewType = 'renova.panel';
  private static panel: vscode.WebviewPanel | undefined;

  static show(context: vscode.ExtensionContext) {
    if (this.panel) { this.panel.reveal(vscode.ViewColumn.One); return; }

    this.panel = vscode.window.createWebviewPanel(
      this.viewType,
      'Renova',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media', 'renova-ui'))]
      }
    );

    this.panel.onDidDispose(() => { this.panel = undefined; });

    const nonce = getNonce();
    const uiRoot = path.join(context.extensionPath, 'media', 'renova-ui');
    const indexHtmlPath = path.join(uiRoot, 'index.html');
    let html = fs.readFileSync(indexHtmlPath, 'utf-8');

    // Replace asset placeholders with webview URIs
    html = html.replace(/"\/assets\//g, `"${this.panel.webview.asWebviewUri(vscode.Uri.file(path.join(uiRoot, 'assets'))).toString()}/`);

    // CSP
    const csp = [
      "default-src 'none'",
      `img-src ${this.panel.webview.cspSource} https: data:`,
      `style-src ${this.panel.webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${this.panel.webview.cspSource} https: data:`
    ].join('; ');

    html = html.replace('</head>', `<meta http-equiv="Content-Security-Policy" content="${csp}"></head>`);
    html = html.replace('<script type="module"', `<script nonce="${nonce}" type="module"`);

    this.panel.webview.html = html;

    this.panel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'ping':
          this.panel?.webview.postMessage({ type: 'pong' });
          break;
      }
    });
  }
}
