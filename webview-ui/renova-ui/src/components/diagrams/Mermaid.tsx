/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useId, useRef, useState } from "react";

/**
 * Tiny wrapper around Mermaid that:
 * - dynamically imports mermaid to keep initial bundle smaller,
 * - renders into a shadow span via mermaid.render(),
 * - auto-re-renders when the instructions change,
 * - gracefully shows parse errors,
 * - supports client-side zoom via CSS transform.
 *
 * Works in VS Code webviews (no window globals required).
 */
export default function Mermaid({
  code,
  theme = "dark",
  fontSize = 14,
  maxWidth = "100%",
  className,
  config,
  /** NEW: scale factor for zoom (1 = 100%) */
  scale = 1,
}: {
  code: string;
  theme?: "dark" | "neutral" | "forest" | "base";
  fontSize?: number;
  maxWidth?: string | number;
  className?: string;
  /** extra mermaid.initialize config */
  config?: Record<string, any>;
  scale?: number;
}) {
  const rid = useId().replace(/:/g, "_");
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setErr(null);
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme,
          securityLevel: "strict",
          fontSize,
          flowchart: { useMaxWidth: true, htmlLabels: false },
          ...config,
        });

        const { svg } = await mermaid.render(`mmd_${rid}`, code);
        if (!mounted) return;
        if (innerRef.current) {
          innerRef.current.innerHTML = svg;
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? String(e));
      }
    }

    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, theme, fontSize, JSON.stringify(config)]);

  return (
    <div
      ref={outerRef}
      className={["w-full overflow-auto", className ?? ""].join(" ")}
      style={{ maxWidth }}
    >
      {err ? (
        <div className="text-xs text-red-400 rounded border border-red-800 bg-red-950/30 p-2 whitespace-pre-wrap">
          Mermaid render error: {err}
        </div>
      ) : (
        <div
          // This wrapper hosts the SVG and applies zoom
          ref={innerRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      )}
    </div>
  );
}
