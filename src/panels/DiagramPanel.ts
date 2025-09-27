import * as vscode from "vscode";

export class DiagramPanel {
  static createFromSvgs(title: string, svgs: string[]) {
    const panel = vscode.window.createWebviewPanel(
      "renovaDiagram",
      title || "Diagram",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
      {
        enableScripts: false, // no scripts needed for static SVG
        retainContextWhenHidden: false,
      }
    );

    panel.webview.html = this.htmlForSvgs(svgs);
    return panel;
  }

  private static htmlForSvgs(svgs: string[]) {
    const safeSvgs = Array.isArray(svgs) ? svgs : [];
    const body = safeSvgs
      .map(
        (svg, idx) => `
        <section class="svg-wrap" aria-label="diagram ${idx + 1}">
          ${svg}
        </section>`
      )
      .join('<hr class="sep" />');

    // minimal CSP: inline styles only, no scripts.
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline';">
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Diagram</title>
<style>
  :root { color-scheme: dark; }
  html, body { height: 100%; }
  body {
    margin: 0;
    background: #0a0a0a;
    color: #e5e5e5;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
  }
  .container {
    padding: 12px 16px 24px;
  }
  .svg-wrap {
    overflow: auto;
    border: 1px solid #2a2a2a;
    background: #0f0f0f;
    border-radius: 12px;
    padding: 8px;
  }
  .svg-wrap svg {
    max-width: 100%;
    height: auto;
    display: block;
  }
  .sep {
    border: none;
    border-top: 1px solid #2a2a2a;
    margin: 12px 0;
  }
</style>
</head>
<body>
  <div class="container">
    ${body || '<div style="opacity:.7">No diagram content.</div>'}
  </div>
</body>
</html>`;
  }
}
