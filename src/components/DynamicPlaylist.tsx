"use client";
// Receives Boson.Template as a prop (fetched server-side in getServerSideProps),
// compiles it with sucrase at runtime, and renders it.
//
// Injected globals in every template — NO imports needed:
//   React, useState, useEffect, useMemo, useCallback, useRef
//   Button, Input, Textarea, Card, CardHeader, CardContent, CardFooter, CardTitle, Badge

import React, { useState, useEffect, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  template: string;
  playlist: any;
  section: any;
}

const componentCache = new Map<string, ComponentType<any>>();

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

function prepareSource(source: string): string {
  return source
    // directives
    .replace(/^[\s]*["']use client["'];?\s*\n?/m, "")
    .replace(/^[\s]*["']use server["'];?\s*\n?/m, "")
    // import statements
    .replace(/^import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*\n?/gm, "")
    .replace(/^import\s+['"][^'"]+['"]\s*;?\s*\n?/gm, "")
    // export default function → assign to module.exports.default
    .replace(/^export\s+default\s+function\s+(\w+)/m, "module.exports.default = function $1")
    // export default expression/arrow/class
    .replace(/^export\s+default\s+/m, "module.exports.default = ")
    // named exports — strip keyword, keep declaration
    .replace(/^export\s+(const|let|var|function|class)\s+/gm, "$1 ");
}

async function compile(source: string): Promise<ComponentType<any> | null> {
  const cleaned = prepareSource(source);
  const key = hash(cleaned);
  if (componentCache.has(key)) return componentCache.get(key)!;

  try {
    const { transform } = await import("sucrase");
    const lines = cleaned.split("\n");
    console.log("[DynamicPlaylist] cleaned source line 135-140:", lines.slice(134, 140).join("\n"));
    const { code } = transform(cleaned, {
      transforms: ["jsx", "typescript"],
      jsxRuntime: "classic",
      production: false,
    });

    const factory = new Function(
      "React", "useState", "useEffect", "useMemo", "useCallback", "useRef",
      "Button", "Input", "Textarea",
      "Card", "CardHeader", "CardContent", "CardFooter", "CardTitle",
      "Badge",
      `"use strict";
       const module = { exports: {} };
       const exports = module.exports;
       ${code}
       return module.exports.default ?? module.exports;`
    );

    const Component = factory(
      React, React.useState, React.useEffect, React.useMemo, React.useCallback, React.useRef,
      Button, Input, Textarea,
      ({ className, children, ...p }: any) =>
        React.createElement("div", { className: ["rounded-xl border bg-white shadow-sm", className].filter(Boolean).join(" "), ...p }, children),
      ({ className, children, ...p }: any) =>
        React.createElement("div", { className: ["flex flex-col space-y-1.5 p-6", className].filter(Boolean).join(" "), ...p }, children),
      ({ className, children, ...p }: any) =>
        React.createElement("div", { className: ["p-6 pt-0", className].filter(Boolean).join(" "), ...p }, children),
      ({ className, children, ...p }: any) =>
        React.createElement("div", { className: ["flex items-center p-6 pt-0", className].filter(Boolean).join(" "), ...p }, children),
      ({ className, children, ...p }: any) =>
        React.createElement("h3", { className: ["font-semibold leading-none tracking-tight", className].filter(Boolean).join(" "), ...p }, children),
      ({ className, variant, children, ...p }: any) => {
        const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
        const variants: Record<string, string> = {
          default: "bg-slate-900 text-white",
          secondary: "bg-slate-100 text-slate-900",
          destructive: "bg-red-600 text-white",
          outline: "border border-slate-200 text-slate-900",
        };
        return React.createElement("span", {
          className: [base, variants[variant ?? "default"] ?? variants.default, className].filter(Boolean).join(" "),
          ...p
        }, children);
      },
    );

    const result = typeof Component === "function" ? Component : null;
    if (result) componentCache.set(key, result);
    return result;
  } catch (err) {
    console.error("[DynamicPlaylist] compile error:", err);
    return null;
  }
}

export default function DynamicPlaylist({ template, playlist, section }: Props) {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    compile(template).then((comp) => {
      if (comp) setComponent(() => comp);
      else setError("Template compiled to nothing — check Boson.Template exports a default function.");
    });
  }, [template]);

  if (error) return (
    <div style={{ margin: 16, padding: 16, border: "1px solid #fca5a5", background: "#fef2f2", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>
      <strong>Renderer error:</strong> {error}
      <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 11, color: "#ef4444" }}>
        {playlist?.RendererBundlePath}
      </div>
    </div>
  );

  if (!Component) return (
    <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
      Loading…
    </div>
  );

  return <Component playlist={playlist} section={section} />;
}