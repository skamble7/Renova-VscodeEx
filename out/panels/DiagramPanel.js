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
exports.DiagramPanel = void 0;
const vscode = __importStar(require("vscode"));
class DiagramPanel {
    /**
     * Create a diagram webview in the desired editor group.
     * If `column` is omitted, we default to the current active group.
     */
    static createFromSvgs(title, svgs, column, preserveFocus = false) {
        // Use the provided column (typically Renova panel's viewColumn),
        // falling back to the current active editor group.
        const showOptions = column !== undefined
            ? { viewColumn: column, preserveFocus }
            : vscode.ViewColumn.Active;
        const panel = vscode.window.createWebviewPanel("renovaDiagram", title || "Diagram", showOptions, {
            enableScripts: false, // no scripts needed for static SVG
            retainContextWhenHidden: false,
        });
        panel.webview.html = this.htmlForSvgs(svgs);
        return panel;
    }
    static htmlForSvgs(svgs) {
        const safeSvgs = Array.isArray(svgs) ? svgs : [];
        const body = safeSvgs
            .map((svg, idx) => `
        <section class="svg-wrap" aria-label="diagram ${idx + 1}">
          ${svg}
        </section>`)
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
  .container { padding: 12px 16px 24px; }
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
exports.DiagramPanel = DiagramPanel;
//# sourceMappingURL=DiagramPanel.js.map