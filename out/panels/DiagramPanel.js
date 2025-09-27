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
const getNonce_1 = require("../getNonce");
class DiagramPanel {
    /**
     * Create a diagram webview in the active editor group by default.
     */
    static createFromSvgs(title, svgs, column, preserveFocus = false) {
        const showOptions = column !== undefined
            ? { viewColumn: column, preserveFocus }
            : vscode.ViewColumn.Active;
        const panel = vscode.window.createWebviewPanel("renovaDiagram", title || "Diagram", showOptions, {
            enableScripts: true, // needed for zoom buttons
            retainContextWhenHidden: false,
        });
        const nonce = (0, getNonce_1.getNonce)();
        panel.webview.html = this.htmlForSvgs(svgs, nonce);
        return panel;
    }
    static htmlForSvgs(svgs, nonce) {
        const safeSvgs = Array.isArray(svgs) ? svgs : [];
        const isSingle = safeSvgs.length === 1;
        const body = safeSvgs
            .map((svg, idx) => `
        <section class="svg-wrap" aria-label="diagram ${idx + 1}">
          <div class="svg-inner">
            ${svg}
          </div>
        </section>`)
            .join('<hr class="sep" />');
        return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               img-src data: blob:;
               style-src 'unsafe-inline';
               script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Diagram</title>
<style>
  :root { color-scheme: dark; --zoom: 1; }
  html, body { height: 100%; }
  body {
    margin: 0;
    background: #0a0a0a;
    color: #e5e5e5;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* Toolbar */
  .topbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid #1f1f1f;
    background: #0d0d0d;
    position: sticky;
    top: 0;
    z-index: 2;
  }
  .topbar .title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: #9ca3af;
  }
  .topbar .spacer { flex: 1; }
  .iconbtn {
    height: 28px; width: 28px;
    border: 1px solid #2a2a2a;
    background: #111;
    color: #ddd;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    outline: none;
  }
  .iconbtn:hover { background: #141414; }
  .iconbtn:active { background: #101010; }
  .zoom-readout {
    font-size: 11px;
    color: #a3a3a3;
    min-width: 42px;
    text-align: right;
  }

  /* Fill the editor area */
  .main { flex: 1; min-height: 0; }
  .container {
    box-sizing: border-box;
    height: 100%;
    padding: 8px 12px 16px;
    overflow: auto;
  }

  /* If there's only one diagram, make it fill the space */
  .container.single { display: flex; flex-direction: column; }
  .container.single .svg-wrap { flex: 1; min-height: 0; }

  .svg-wrap {
    box-sizing: border-box;
    width: 100%;
    overflow: auto;
    border: 1px solid #2a2a2a;
    background: #0f0f0f;
    border-radius: 12px;
    padding: 8px;
  }

  /* Zoom target */
  .svg-inner {
    display: inline-block;
    transform: scale(var(--zoom));
    transform-origin: top left;
  }

  /* When single, stretch the SVG to fill the available area before zoom */
  .container.single .svg-inner { width: 100%; height: 100%; }
  .container.single .svg-wrap svg { width: 100%; height: 100%; }

  /* Default SVG sizing (multi-diagram stacks nicely) */
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
  <div class="topbar" role="toolbar" aria-label="Diagram controls">
    <div class="title">Diagram</div>
    <div class="spacer"></div>
    <div class="zoom-readout" id="zoomReadout">100%</div>
    <button id="zoomOut" class="iconbtn" title="Zoom out (−)">−</button>
    <button id="zoomIn" class="iconbtn" title="Zoom in (+)">+</button>
    <button id="zoomReset" class="iconbtn" title="Reset zoom">⟲</button>
  </div>

  <div class="main">
    <div class="container ${isSingle ? "single" : ""}">
      ${body || '<div style="opacity:.7">No diagram content.</div>'}
    </div>
  </div>

  <script nonce="${nonce}">
    (function(){
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      let zoom = 1;
      const root = document.documentElement;
      const readout = document.getElementById('zoomReadout');

      function apply() {
        root.style.setProperty('--zoom', String(zoom));
        if (readout) readout.textContent = Math.round(zoom * 100) + '%';
      }
      function zIn(){ zoom = clamp((zoom + 0.1), 0.25, 3); apply(); }
      function zOut(){ zoom = clamp((zoom - 0.1), 0.25, 3); apply(); }
      function zReset(){ zoom = 1; apply(); }

      document.getElementById('zoomIn')?.addEventListener('click', zIn);
      document.getElementById('zoomOut')?.addEventListener('click', zOut);
      document.getElementById('zoomReset')?.addEventListener('click', zReset);

      // Keyboard: Cmd/Ctrl + (+ / - / 0)
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) { e.preventDefault(); zIn(); }
        else if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zOut(); }
        else if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); zReset(); }
      });

      apply();
    })();
  </script>
</body>
</html>`;
    }
}
exports.DiagramPanel = DiagramPanel;
//# sourceMappingURL=DiagramPanel.js.map