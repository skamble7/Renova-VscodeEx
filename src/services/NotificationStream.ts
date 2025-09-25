/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/NotificationStream.ts
import * as vscode from "vscode";
import WebSocket from "ws";

type Options = {
  url: string;
  channel: vscode.OutputChannel;
  autoStart?: boolean;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  heartbeatIntervalMs?: number;
  idleTimeoutMs?: number;

  /** Receive parsed JSON events (and raw text if not JSON) */
  onEvent?: (evt: any) => void;
};

export class NotificationStream {
  private ws: WebSocket | null = null;
  private disposed = false;

  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;

  private readonly url: string;
  private readonly channel: vscode.OutputChannel;

  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly heartbeatIntervalMs: number;
  private readonly idleTimeoutMs: number;

  private readonly onEvent?: (evt: any) => void;

  constructor(opts: Options) {
    this.url = opts.url;
    this.channel = opts.channel;
    this.onEvent = opts.onEvent;

    this.reconnectBaseDelayMs = opts.reconnectBaseDelayMs ?? 1000;
    this.reconnectMaxDelayMs  = opts.reconnectMaxDelayMs ?? 15000;
    this.heartbeatIntervalMs  = opts.heartbeatIntervalMs ?? 15000;
    this.idleTimeoutMs        = opts.idleTimeoutMs ?? 20000;

    if (opts.autoStart !== false) this.connect();
  }

  public connect() {
    if (this.disposed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.channel.appendLine(`[RENOVA] Connecting to ${this.url} ...`);
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      this.reconnectAttempts = 0;
      this.channel.appendLine("[RENOVA] Connected.");
      this.startHeartbeat();
    });

    this.ws.on("message", (data: any) => this.onMessage(data));

    this.ws.on("pong", () => {
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
    });

    this.ws.on("error", (err: { message: any; }) => {
      this.channel.appendLine(`[RENOVA] WebSocket error: ${err instanceof Error ? err.message : String(err)}`);
    });

    this.ws.on("close", (code: any, reason: any) => {
      this.stopHeartbeat();
      this.channel.appendLine(`[RENOVA] Disconnected (${code}${reason ? ` ${reason}` : ""}).`);
      if (!this.disposed) this.scheduleReconnect();
    });
  }

  private onMessage(raw: WebSocket.RawData) {
    try {
      const text = typeof raw === "string" ? raw : raw.toString("utf8");

      let parsed: any | undefined;
      try { parsed = JSON.parse(text); } catch { parsed = undefined; }

      // Pretty print to the Output channel
      let line = text;
      try {
        const obj = parsed ?? {};
        const evt  = obj.event ?? obj.type ?? "event";
        const lvl  = (obj.level ?? obj.severity ?? "info").toString().toUpperCase();
        const msg  = obj.message ?? obj.text ?? obj.detail ?? "";
        const rest = Object.keys(obj)
          .filter(k => !["event","type","level","severity","message","text","detail"].includes(k))
          .reduce((acc: any, k) => (acc[k] = obj[k], acc), {});
        const tail = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
        line = `[${lvl}] ${evt}: ${msg}${tail}`;
      } catch { /* not JSON; keep raw */ }
      this.channel.appendLine(line);

      // Forward to UI via callback (parsed JSON preferred; else raw)
      if (this.onEvent) {
        if (parsed !== undefined) this.onEvent(parsed);
        else this.onEvent({ type: "ws.raw", text });
      }
    } catch (err) {
      this.channel.appendLine(`[RENOVA] Failed to handle message: ${String(err)}`);
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts += 1;
    const exp = Math.min(
      this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      this.reconnectMaxDelayMs
    );
    const jitter = Math.floor(Math.random() * 250);
    const delay = exp + jitter;
    this.channel.appendLine(`[RENOVA] Reconnecting in ${Math.round(delay/1000)}s ...`);
    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try {
        this.ws.ping();
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
          this.channel.appendLine("[RENOVA] Heartbeat timeout; forcing reconnect.");
          try { this.ws?.terminate(); } catch {}
        }, this.idleTimeoutMs);
      } catch (e) {
        this.channel.appendLine(`[RENOVA] Heartbeat error: ${String(e)}`);
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  public dispose() {
    this.disposed = true;
    this.stopHeartbeat();
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }
}
